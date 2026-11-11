import type { SupabaseClient } from '@supabase/supabase-js';
import { createSession } from './session';
import type {
  AccessInfo, AuthService, Invitation, InvitationLookup, PasswordRefused, ResetLookup, Role, Session, SignInResult
} from './types';

/**
 * Sign-in through Supabase Auth. Supabase keeps emails and passwords and sends the emails;
 * the database (supabase/03_logins.sql) links each login to a person and a role.
 * There is no public sign-up: a login exists only when an admin invites someone.
 */

interface Me {
  person_id: string; name: string; email: string; role: Role; active: boolean;
  deactivated_at: string | null; deactivated_by_name: string | null;
  invited_by_name: string | null; invited_by_email: string | null;
}

type LinkKind = 'recovery' | 'invite';

/** How the session from an emailed link signed in, by link kind (the access token's "amr"). */
const LINK_METHODS: Record<LinkKind, string[]> = { recovery: ['recovery', 'otp'], invite: ['invite', 'otp', 'magiclink'] };
/** A browser that signed in with the link this long ago still counts as having opened it. */
const LINK_GRACE_SECONDS = 15 * 60;

/** Errors that mean the session behind the link is gone, rather than the new password being turned down. */
const isSessionGone = (e: { status?: number; code?: string; name?: string }) =>
  e.status === 401 || e.name === 'AuthSessionMissingError' || e.code === 'session_not_found' || e.code === 'bad_jwt';

/** Where emailed links land. Supabase must list these under Authentication → URL Configuration. */
export const linkTarget = (path: 'reset-password/link' | 'invite/link') =>
  `${window.location.origin}${import.meta.env.BASE_URL}${path}`;

/** The error an emailed link came back with, if any (#error_code=otp_expired). */
function linkError(hash: string): 'expired' | 'not-found' | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const code = p.get('error_code') ?? p.get('error');
  if (!code) return null;
  return code === 'otp_expired' ? 'expired' : 'not-found';
}

/** Where the app's People list comes from, so an invitation carries the person's name and email. */
export interface InviteDirectory { list(): { id: string; name: string; email: string }[] }

export class SupabaseAuthService implements AuthService {
  constructor(private sb: SupabaseClient, private hash = '', private people: InviteDirectory = { list: () => [] }, private search = '') {}

  /** The emailed link's one-time code, while it hasn't been used: ?token_hash=…&type=recovery|invite. */
  private pendingLink(kind: LinkKind): string | null {
    const p = new URLSearchParams(this.search);
    return p.get('type') === kind ? p.get('token_hash') : null;
  }

  /**
   * The session this browser got from a link of this kind in the last few minutes. An email link
   * opened twice (by a mail scanner, a preview, a second click) fails the second time; if this
   * browser already signed in with it, carry on instead of saying it expired.
   */
  private async recentLinkSession(kind: LinkKind) {
    const { data } = await this.sb.auth.getSession();
    const s = data.session;
    if (!s) return null;
    try {
      const claims = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { amr?: { method: string; timestamp: number }[] };
      const now = Date.now() / 1000;
      return claims.amr?.some((a) => LINK_METHODS[kind].includes(a.method) && now - a.timestamp < LINK_GRACE_SECONDS) ? s : null;
    } catch {
      return null;
    }
  }

  private clearPendingLink() {
    this.search = '';
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }

  async confirmLink(kind: LinkKind): Promise<void> {
    const tokenHash = this.pendingLink(kind);
    if (!tokenHash) return;
    // Used once, here and only here; take it out of the address so a reload doesn't try again.
    this.clearPendingLink();
    const { error } = await this.sb.auth.verifyOtp({ token_hash: tokenHash, type: kind });
    if (error && !(await this.recentLinkSession(kind))) this.hash = `#error_code=${error.code === 'otp_expired' || error.status === 403 ? 'otp_expired' : 'invalid'}`;
  }

  private async me(): Promise<Me | null> {
    const { data, error } = await this.sb.rpc('me');
    if (error || !data?.length) return null;
    return data[0] as Me;
  }

  private session(me: Me, keep: boolean): Session {
    return createSession({ id: me.person_id, name: me.name, email: me.email, role: me.role }, keep);
  }

  async signIn(email: string, password: string, keep: boolean): Promise<SignInResult> {
    let error: { status?: number; name?: string } | null;
    try { ({ error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })); } catch { return { ok: false, reason: 'unavailable' }; }
    if (error) return { ok: false, reason: !error.status || error.name === 'AuthRetryableFetchError' ? 'unavailable' : 'invalid' };
    const me = await this.me();
    if (!me) { await this.sb.auth.signOut(); return { ok: false, reason: 'invalid' }; }
    if (!me.active) {
      await this.sb.auth.signOut();
      return { ok: false, reason: 'deactivated', deactivatedAt: me.deactivated_at ?? new Date().toISOString(), contactName: me.deactivated_by_name ?? 'the office' };
    }
    return { ok: true, session: this.session(me, keep) };
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async checkSession(current: Session): Promise<Session | null> {
    // getUser asks Supabase, so a login that was removed or signed out everywhere fails here.
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) return null;
    const me = await this.me();
    if (!me || !me.active) { await this.sb.auth.signOut(); return null; }
    // Supabase is signed in as someone else now (an emailed link for another person was opened here):
    // end the old app session, but keep that sign-in so the link's page can finish.
    if (me.person_id !== current.personId) return null;
    if (me.name === current.name && me.email === current.email && me.role === current.role) return current;
    return { ...current, name: me.name, email: me.email, role: me.role };
  }

  async requestPasswordReset(email: string): Promise<{ devLink?: string }> {
    // Same answer whether or not the email has a login.
    await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: linkTarget('reset-password/link') });
    return {};
  }

  /** A reset link signs the person in for long enough to choose a new password. */
  async lookupReset(): Promise<ResetLookup> {
    if (this.pendingLink('recovery')) {
      // Already used in this browser a moment ago: carry on as if it had just been confirmed.
      if (!(await this.recentLinkSession('recovery'))) return { status: 'confirm' };
      this.clearPendingLink();
    }
    const err = linkError(this.hash);
    if (err && !(await this.recentLinkSession('recovery'))) return { status: err };
    const { data } = await this.sb.auth.getSession();
    const email = data.session?.user.email;
    return email ? { status: 'valid', email } : { status: 'not-found' };
  }

  async resetPassword(_token: string, password: string, keep: boolean) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) return isSessionGone(error) ? { ok: false as const, status: 'expired' as const } : ({ ok: false, refused: error.message } satisfies PasswordRefused);
    const me = await this.me();
    if (!me || !me.active) { await this.sb.auth.signOut(); return { ok: false as const, status: 'not-found' as const }; }
    return { ok: true as const, session: this.session(me, keep) };
  }

  async lookupInvitation(): Promise<InvitationLookup> {
    if (this.pendingLink('invite')) {
      if (!(await this.recentLinkSession('invite'))) return { status: 'confirm' };
      this.clearPendingLink();
    }
    const err = (await this.recentLinkSession('invite')) ? null : linkError(this.hash);
    if (err === 'expired') return { status: 'expired', invitation: blankInvitation() };
    if (err) return { status: 'not-found' };
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return { status: 'not-found' };
    const me = await this.me();
    if (!me) return { status: 'not-found' };
    const u = data.session.user;
    const invitation: Invitation = {
      token: 'link', personId: me.person_id, name: me.name, email: me.email, role: me.role,
      invitedBy: me.invited_by_name ?? 'The office', invitedByEmail: me.invited_by_email ?? '',
      sentAt: u.invited_at ?? u.created_at, expiresAt: ''
    };
    // Someone who already chose a password should sign in instead.
    return u.user_metadata?.password_set ? { status: 'used', invitation } : { status: 'valid', invitation };
  }

  async acceptInvitation(_token: string, input: { name: string; password: string; keep: boolean }) {
    const { error } = await this.sb.auth.updateUser({ password: input.password, data: { password_set: true } });
    if (error) return isSessionGone(error) ? { ok: false as const, status: 'expired' as const } : ({ ok: false, refused: error.message } satisfies PasswordRefused);
    await this.sb.rpc('set_my_name', { new_name: input.name });
    const me = await this.me();
    if (!me) return { ok: false as const, status: 'revoked' as const };
    return { ok: true as const, session: this.session(me, input.keep) };
  }

  access = {
    listAccess: async (): Promise<AccessInfo[]> => {
      const { data, error } = await this.sb.rpc('access_list');
      if (error) throw new Error(error.message);
      return (data as { person_id: string; role: Role; login: 'active' | 'invited'; last_sign_in_at: string | null; invited_at: string | null; invited_by_name: string | null }[])
        .map((r) => ({
          personId: r.person_id, role: r.role, login: r.login, lastSignInAt: r.last_sign_in_at ?? undefined,
          invitation: r.login === 'invited' && r.invited_at
            ? { sentAt: r.invited_at, sentBy: r.invited_by_name ?? '', expiresAt: new Date(new Date(r.invited_at).getTime() + 86_400_000).toISOString(), expired: Date.now() - new Date(r.invited_at).getTime() > 86_400_000 }
            : undefined
        }));
    },
    /** Sent by the `invite` Edge Function, which checks the caller is an admin. Re-inviting replaces an unused invitation. */
    invite: async (personId: string, role: Role): Promise<{ devLink?: string }> => {
      const p = this.people.list().find((x) => x.id === personId);
      if (!p?.email) throw new Error('Add an email address for this person first.');
      const { error } = await this.sb.functions.invoke('invite', {
        body: { personId, name: p.name, email: p.email, role, redirectTo: linkTarget('invite/link') }
      });
      if (error) throw new Error(await functionError(error));
      return {};
    },
    revokeInvite: async (personId: string) => { await this.call('revoke_invite', { target_person: personId }); },
    setRole: async (personId: string, role: Role) => { await this.call('set_role', { target_person: personId, new_role: role }); },
    signOutEverywhere: async (personId: string) => { await this.call('sign_out_everywhere', { target_person: personId }); }
  };

  private async call(fn: string, args: Record<string, unknown>) {
    const { error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(error.message);
  }
}

/** The message an Edge Function sent back, or a plain explanation when it couldn't be reached. */
async function functionError(error: { message: string; context?: unknown }): Promise<string> {
  const res = error.context;
  if (res instanceof Response) {
    try { const body = await res.json(); if (body?.error) return String(body.error); } catch { /* not JSON */ }
    if (res.status === 404) return 'The invitation service isn\'t set up in Supabase yet (Edge Function "invite").';
  }
  return 'The invitation could not be sent. Check your connection and try again.';
}

function blankInvitation(): Invitation {
  return { token: 'link', personId: '', name: '', email: '', role: 'crew', invitedBy: 'The office', invitedByEmail: '', sentAt: '', expiresAt: '' };
}
