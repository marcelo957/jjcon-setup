import { createSession } from './session';
import type { AccessInfo, AuthService, Invitation, InvitationLookup, ResetLookup, Role, Session } from './types';

/**
 * In-browser stand-in for the real auth API. It keeps accounts, invitations and reset tokens
 * in localStorage so flows survive a reload (reset a password, then sign in with it).
 * Passwords are stored in plain text: this is demo data only, never a pattern for the server.
 *
 * Profiles (name, email, active) come from a PeopleDirectory: in the app that is the console's
 * People list, so renaming, inviting and deactivating someone stays consistent everywhere.
 * Without one (unit tests) the seeded profiles below stand in.
 */

const DB_KEY = 'jjcon.mockdb.v2';
const DAY = 86_400_000;
const INVITE_DAYS = 7;
const RESET_MINUTES = 60;

/** A person as the directory knows them. */
export interface Profile {
  id: string;
  name: string;
  email: string;
  active: boolean;
  deactivatedAt?: string;
  deactivatedBy?: string;
}

export interface PeopleDirectory {
  list(): Profile[];
  rename(id: string, name: string): void;
}

interface Account {
  personId: string;
  role: Role;
  login: 'active' | 'invited' | 'none';
  password?: string;
  lastSignInAt?: string;
  /** Sessions issued before this were ended by "Sign out of all devices". */
  signedOutAt?: string;
}

interface ResetToken { token: string; personId: string; expiresAt: string; usedAt?: string }

interface Db {
  accounts: Account[];
  /** Demo-only profiles for people not in the directory (the deactivated and expired-invitation examples). */
  profiles: Profile[];
  invitations: Invitation[];
  resets: ResetToken[];
}

/** Demo passwords, printed on the /access index so every state can be reached. */
export const DEMO_PASSWORDS = {
  admin: 'jjcon-admin-2027',
  editor: 'jjcon-editor-2027',
  crew: 'jjcon-crew-2027'
} as const;

/** Tokens seeded into the mock store, one per designed state. */
export const DEMO_TOKENS = {
  invite: 'demo-invite',
  inviteExpired: 'demo-invite-expired',
  inviteUsed: 'demo-invite-used',
  reset: 'demo-reset'
} as const;

export function seedDb(now: Date): Db {
  const t = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
  const profiles: Profile[] = [
    { id: 'p-marcelo', name: 'Marcelo', email: 'marcelo@ibjjf.com', active: true },
    { id: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com', active: true },
    { id: 'p-dandre', name: "D'Andre", email: 'jackson@ibjjf.com', active: true },
    { id: 'p-gordo', name: 'Gordo', email: 'aleal@ibjjf.com', active: true },
    { id: 'p-daniela', name: 'Daniela', email: 'cardoso@ibjjf.com', active: true },
    { id: 'p-rafa', name: 'Rafa', email: 'rafa@ibjjf.com', active: true },
    { id: 'p-nakamura', name: 'P. Nakamura', email: 'p.nakamura@ibjjf.com', active: false, deactivatedAt: t(-10 * DAY), deactivatedBy: 'p-marcelo' }
  ];
  const accounts: Account[] = [
    { personId: 'p-marcelo', role: 'admin', login: 'active', password: DEMO_PASSWORDS.admin, lastSignInAt: t(-0.1 * DAY) },
    { personId: 'p-diego', role: 'editor', login: 'active', password: DEMO_PASSWORDS.editor, lastSignInAt: t(-0.6 * DAY) },
    { personId: 'p-dandre', role: 'crew', login: 'active', password: DEMO_PASSWORDS.crew, lastSignInAt: t(-0.2 * DAY) },
    { personId: 'p-gordo', role: 'editor', login: 'invited' },
    { personId: 'p-daniela', role: 'crew', login: 'none' },
    { personId: 'p-rafa', role: 'crew', login: 'invited' },
    { personId: 'p-nakamura', role: 'crew', login: 'active', password: DEMO_PASSWORDS.crew }
  ];
  const invite = (token: string, personId: string, sentAt: string, extra: Partial<Invitation> = {}): Invitation => {
    const p = profiles.find((x) => x.id === personId)!;
    return {
      token, personId, name: p.name, email: p.email, role: accounts.find((a) => a.personId === personId)!.role,
      invitedBy: 'Marcelo', invitedByEmail: 'marcelo@ibjjf.com', sentAt,
      expiresAt: new Date(new Date(sentAt).getTime() + INVITE_DAYS * DAY).toISOString(), ...extra
    };
  };
  return {
    accounts,
    profiles,
    invitations: [
      invite(DEMO_TOKENS.invite, 'p-gordo', t(-1 * DAY)),
      invite(DEMO_TOKENS.inviteExpired, 'p-rafa', t(-9 * DAY)),
      invite(DEMO_TOKENS.inviteUsed, 'p-diego', t(-20 * DAY), { usedAt: t(-19 * DAY) })
    ],
    resets: [{ token: DEMO_TOKENS.reset, personId: 'p-diego', expiresAt: t(RESET_MINUTES * 60_000) }]
  };
}

export interface MockOptions {
  /** Simulated network latency, so loading states are visible. 0 in tests. */
  latencyMs?: number;
  now?: () => Date;
  storage?: Storage;
  directory?: PeopleDirectory;
}

export class MockAuthService implements AuthService {
  private latencyMs: number;
  private now: () => Date;
  private storage: Storage;
  private directory?: PeopleDirectory;

  constructor(opts: MockOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 400;
    this.now = opts.now ?? (() => new Date());
    this.storage = opts.storage ?? localStorage;
    this.directory = opts.directory;
  }

  /** Restore the seeded demo data. */
  reset() {
    this.write(seedDb(this.now()));
  }

  private read(): Db {
    try {
      const raw = this.storage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch {
      /* fall through to a fresh seed */
    }
    const db = seedDb(this.now());
    this.write(db);
    return db;
  }

  private write(db: Db) {
    this.storage.setItem(DB_KEY, JSON.stringify(db));
  }

  private wait() {
    return this.latencyMs ? new Promise((r) => setTimeout(r, this.latencyMs)) : Promise.resolve();
  }

  /** Directory people first; demo-only profiles fill in anyone the directory doesn't have. */
  private profiles(db: Db): Profile[] {
    const dir = this.directory?.list() ?? [];
    const ids = new Set(dir.map((p) => p.id));
    return [...dir, ...db.profiles.filter((p) => !ids.has(p.id))];
  }

  private profile(db: Db, id: string) {
    return this.profiles(db).find((p) => p.id === id);
  }

  private findByEmail(db: Db, email: string) {
    const e = email.trim().toLowerCase();
    return e ? this.profiles(db).find((p) => p.email?.toLowerCase() === e) : undefined;
  }

  private account(db: Db, personId: string) {
    return db.accounts.find((a) => a.personId === personId);
  }

  private session(p: Profile, a: Account, keep: boolean): Session {
    return createSession({ id: p.id, name: p.name, email: p.email, role: a.role }, keep, this.now());
  }

  async signIn(email: string, password: string, keep: boolean) {
    await this.wait();
    const db = this.read();
    const p = this.findByEmail(db, email);
    const a = p && this.account(db, p.id);
    // Only a correct password reveals that an account is deactivated.
    if (!p || !a?.password || a.password !== password) return { ok: false as const, reason: 'invalid' as const };
    if (!p.active) {
      const by = p.deactivatedBy ? this.profile(db, p.deactivatedBy)?.name : undefined;
      return { ok: false as const, reason: 'deactivated' as const, deactivatedAt: p.deactivatedAt ?? this.now().toISOString(), contactName: by ?? 'the office' };
    }
    if (a.login !== 'active') return { ok: false as const, reason: 'invalid' as const };
    a.lastSignInAt = this.now().toISOString();
    this.write(db);
    return { ok: true as const, session: this.session(p, a, keep) };
  }

  async checkSession(s: Session): Promise<Session | null> {
    const db = this.read();
    const p = this.profile(db, s.personId);
    const a = this.account(db, s.personId);
    if (!p || !p.active || !a || a.login !== 'active') return null;
    if (a.signedOutAt && (!s.issuedAt || s.issuedAt < a.signedOutAt)) return null;
    if (p.name === s.name && p.email === s.email && a.role === s.role) return s;
    return { ...s, name: p.name, email: p.email, role: a.role };
  }

  async requestPasswordReset(email: string) {
    await this.wait();
    const db = this.read();
    const p = this.findByEmail(db, email);
    if (!p || !p.active || this.account(db, p.id)?.login !== 'active') return {};
    const token = `reset-${crypto.randomUUID()}`;
    db.resets.push({ token, personId: p.id, expiresAt: new Date(this.now().getTime() + RESET_MINUTES * 60_000).toISOString() });
    this.write(db);
    // A real backend emails this link; the mock hands it back so the demo can follow it.
    return { devLink: `/reset-password/${token}` };
  }

  private resetStatus(db: Db, token: string): { status: ResetLookup['status']; reset?: ResetToken; person?: Profile; account?: Account } {
    const reset = db.resets.find((r) => r.token === token);
    if (!reset) return { status: 'not-found' };
    if (reset.usedAt) return { status: 'used' };
    if (new Date(reset.expiresAt) <= this.now()) return { status: 'expired' };
    const person = this.profile(db, reset.personId);
    const account = this.account(db, reset.personId);
    if (!person?.email || !person.active || account?.login !== 'active') return { status: 'not-found' };
    return { status: 'valid', reset, person, account };
  }

  async lookupReset(token: string): Promise<ResetLookup> {
    await this.wait();
    const r = this.resetStatus(this.read(), token);
    return r.status === 'valid' ? { status: 'valid', email: r.person!.email } : { status: r.status };
  }

  async resetPassword(token: string, password: string, keep: boolean) {
    await this.wait();
    const db = this.read();
    const r = this.resetStatus(db, token);
    if (r.status !== 'valid') return { ok: false as const, status: r.status };
    r.account!.password = password;
    r.reset!.usedAt = this.now().toISOString();
    this.write(db);
    return { ok: true as const, session: this.session(r.person!, r.account!, keep) };
  }

  private invitationStatus(db: Db, token: string): InvitationLookup {
    const invitation = db.invitations.find((i) => i.token === token);
    if (!invitation) return { status: 'not-found' };
    if (invitation.usedAt) return { status: 'used', invitation };
    if (invitation.revokedAt) return { status: 'revoked', invitation };
    if (new Date(invitation.expiresAt) <= this.now()) return { status: 'expired', invitation };
    if (!this.profile(db, invitation.personId)?.active) return { status: 'revoked', invitation };
    return { status: 'valid', invitation };
  }

  async lookupInvitation(token: string) {
    await this.wait();
    return this.invitationStatus(this.read(), token);
  }

  async acceptInvitation(token: string, input: { name: string; password: string; keep: boolean }) {
    await this.wait();
    const db = this.read();
    const lookup = this.invitationStatus(db, token);
    if (lookup.status !== 'valid') return { ok: false as const, status: lookup.status };
    const inv = db.invitations.find((i) => i.token === token)!;
    const a = this.account(db, inv.personId)!;
    // Accepting keeps the existing person record, so everything already assigned stays with them.
    const name = input.name.trim();
    this.directory?.rename(inv.personId, name);
    const local = db.profiles.find((p) => p.id === inv.personId);
    if (local) local.name = name;
    a.password = input.password;
    a.login = 'active';
    a.role = inv.role;
    a.lastSignInAt = this.now().toISOString();
    inv.usedAt = this.now().toISOString();
    this.write(db);
    return { ok: true as const, session: this.session({ ...this.profile(db, inv.personId)!, name }, a, input.keep) };
  }

  /* ---------- Admin: logins on the People page ---------- */

  access = {
    listAccess: async (): Promise<AccessInfo[]> => {
      const db = this.read();
      const now = this.now();
      return this.profiles(db).map((p) => {
        const a = this.account(db, p.id) ?? { personId: p.id, role: 'crew' as Role, login: 'none' as const };
        const inv = a.login === 'invited'
          ? db.invitations.filter((i) => i.personId === p.id && !i.usedAt && !i.revokedAt).sort((x, y) => (x.sentAt < y.sentAt ? 1 : -1))[0]
          : undefined;
        return {
          personId: p.id, role: a.role, login: a.login, lastSignInAt: a.lastSignInAt,
          invitation: inv && { sentAt: inv.sentAt, sentBy: inv.invitedBy, expiresAt: inv.expiresAt, expired: new Date(inv.expiresAt) <= now }
        };
      });
    },

    invite: async (personId: string, role: Role, invitedBy: string) => {
      await this.wait();
      const db = this.read();
      const p = this.profile(db, personId);
      if (!p?.email) throw new Error('Add an email before inviting.');
      const by = this.profile(db, invitedBy);
      // A new invitation replaces any earlier link.
      db.invitations.forEach((i) => { if (i.personId === personId && !i.usedAt && !i.revokedAt) i.revokedAt = this.now().toISOString(); });
      const token = `inv-${crypto.randomUUID()}`;
      const sentAt = this.now().toISOString();
      db.invitations.push({
        token, personId, name: p.name, email: p.email, role, invitedBy: by?.name ?? 'The office', invitedByEmail: by?.email ?? '',
        sentAt, expiresAt: new Date(this.now().getTime() + INVITE_DAYS * DAY).toISOString()
      });
      const a = this.account(db, personId);
      if (a) { a.role = role; if (a.login !== 'active') a.login = 'invited'; }
      else db.accounts.push({ personId, role, login: 'invited' });
      this.write(db);
      // A real backend emails this link; the mock hands it back so the demo can follow it.
      return { devLink: `/invite/${token}` };
    },

    revokeInvite: async (personId: string) => {
      const db = this.read();
      db.invitations.forEach((i) => { if (i.personId === personId && !i.usedAt && !i.revokedAt) i.revokedAt = this.now().toISOString(); });
      const a = this.account(db, personId);
      if (a && a.login === 'invited') a.login = 'none';
      this.write(db);
    },

    setRole: async (personId: string, role: Role) => {
      const db = this.read();
      const a = this.account(db, personId);
      if (a) a.role = role;
      this.write(db);
    },

    signOutEverywhere: async (personId: string) => {
      const db = this.read();
      const a = this.account(db, personId);
      if (a) a.signedOutAt = this.now().toISOString();
      this.write(db);
    }
  };
}
