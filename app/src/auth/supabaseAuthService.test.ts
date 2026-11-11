import { vi } from 'vitest';
import { SupabaseAuthService } from './supabaseAuthService';

const ME = { person_id: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com', role: 'editor', active: true, deactivated_at: null, deactivated_by_name: null, invited_by_name: 'Marcelo', invited_by_email: 'marcelo@ibjjf.com' };

function fakeClient(over: { signInError?: boolean; me?: unknown[] | null; session?: unknown; userError?: boolean } = {}) {
  const auth = {
    signInWithPassword: vi.fn(async () => ({ error: over.signInError ? { message: 'Invalid login credentials', status: 400, name: 'AuthApiError' } : null })),
    signOut: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => (over.userError ? { data: { user: null }, error: { message: 'session not found' } } : { data: { user: { id: 'u1' } }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: over.session ?? null } })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null }))
  };
  const rpc = vi.fn(async (fn: string) => (fn === 'me' ? { data: over.me === undefined ? [ME] : over.me, error: null } : { data: null, error: null }));
  return { auth, rpc };
}

describe('Supabase sign-in', () => {
  it('signs in with the person and role from the database', async () => {
    const sb = fakeClient();
    const r = await new SupabaseAuthService(sb as never).signIn(' diego@ibjjf.com ', 'pw-123456789', true);
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'diego@ibjjf.com', password: 'pw-123456789' });
    expect(r).toMatchObject({ ok: true, session: { personId: 'p-diego', role: 'editor', keep: true } });
  });

  it('turns away a wrong password, a login with no person, and a deactivated person', async () => {
    expect(await new SupabaseAuthService(fakeClient({ signInError: true }) as never).signIn('x@y.z', 'nope', false)).toEqual({ ok: false, reason: 'invalid' });
    const stranger = fakeClient({ me: [] });
    expect(await new SupabaseAuthService(stranger as never).signIn('x@y.z', 'pw', false)).toEqual({ ok: false, reason: 'invalid' });
    expect(stranger.auth.signOut).toHaveBeenCalled();
    const gone = fakeClient({ me: [{ ...ME, active: false, deactivated_at: '2026-10-01T00:00:00Z', deactivated_by_name: 'Marcelo' }] });
    expect(await new SupabaseAuthService(gone as never).signIn('diego@ibjjf.com', 'pw', false)).toEqual({ ok: false, reason: 'deactivated', deactivatedAt: '2026-10-01T00:00:00Z', contactName: 'Marcelo' });
  });

  it('ends a session Supabase no longer accepts, and picks up a role change', async () => {
    const session = { personId: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com', role: 'crew' as const, keep: true, expiresAt: null };
    expect(await new SupabaseAuthService(fakeClient({ userError: true }) as never).checkSession(session)).toBeNull();
    expect(await new SupabaseAuthService(fakeClient() as never).checkSession(session)).toMatchObject({ role: 'editor' });
  });

  it('sends reset links to the app and reads expired links', async () => {
    const sb = fakeClient();
    await new SupabaseAuthService(sb as never).requestPasswordReset('diego@ibjjf.com');
    expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('diego@ibjjf.com', { redirectTo: expect.stringMatching(/\/reset-password\/link$/) });
    expect(await new SupabaseAuthService(fakeClient() as never, '#error=access_denied&error_code=otp_expired').lookupReset()).toEqual({ status: 'expired' });
    expect(await new SupabaseAuthService(fakeClient({ session: { user: { email: 'diego@ibjjf.com' } } }) as never).lookupReset()).toEqual({ status: 'valid', email: 'diego@ibjjf.com' });
  });

  it('lets an invited person set their password and name', async () => {
    const sb = fakeClient({ session: { user: { email: 'diego@ibjjf.com', invited_at: '2026-10-20T00:00:00Z', created_at: '2026-10-20T00:00:00Z', user_metadata: {} } } });
    const svc = new SupabaseAuthService(sb as never);
    expect(await svc.lookupInvitation()).toMatchObject({ status: 'valid', invitation: { name: 'Diego', role: 'editor', invitedBy: 'Marcelo' } });
    const r = await svc.acceptInvitation('link', { name: 'Diego R.', password: 'pw-123456789', keep: true });
    expect(sb.auth.updateUser).toHaveBeenCalledWith({ password: 'pw-123456789', data: { password_set: true } });
    expect(sb.rpc).toHaveBeenCalledWith('set_my_name', { new_name: 'Diego R.' });
    expect(r.ok).toBe(true);
  });
});

/** A session as an emailed link leaves it: the access token says how and when it signed in. */
const linkSession = (method: string, secondsAgo = 5) => {
  const claims = btoa(JSON.stringify({ amr: [{ method, timestamp: Math.floor(Date.now() / 1000) - secondsAgo }] })).replace(/=+$/, '');
  return { access_token: `h.${claims}.s`, user: { email: 'diego@ibjjf.com', invited_at: '2026-10-20T00:00:00Z', created_at: '2026-10-20T00:00:00Z', user_metadata: {} } };
};

describe('Emailed links opened twice, or by a mail scanner', () => {
  it('uses a reset link only when the person presses Continue', async () => {
    const sb = fakeClient();
    const verifyOtp = vi.fn(async () => { (sb.auth as { getSession: unknown }).getSession = vi.fn(async () => ({ data: { session: linkSession('otp') } })); return { error: null }; });
    Object.assign(sb.auth, { verifyOtp });
    const svc = new SupabaseAuthService(sb as never, '', undefined, '?token_hash=abc&type=recovery');
    expect(await svc.lookupReset()).toEqual({ status: 'confirm' });
    expect(verifyOtp).not.toHaveBeenCalled();
    await svc.confirmLink('recovery');
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' });
    expect(await svc.lookupReset()).toEqual({ status: 'valid', email: 'diego@ibjjf.com' });
  });

  it('says a used-up link expired when this browser never signed in with it', async () => {
    const sb = fakeClient();
    Object.assign(sb.auth, { verifyOtp: vi.fn(async () => ({ error: { status: 403, code: 'otp_expired', message: 'Email link is invalid or has expired' } })) });
    const svc = new SupabaseAuthService(sb as never, '', undefined, '?token_hash=abc&type=invite');
    expect(await svc.lookupInvitation()).toEqual({ status: 'confirm' });
    await svc.confirmLink('invite');
    expect(await svc.lookupInvitation()).toMatchObject({ status: 'expired' });
  });

  it('carries on when the second opening fails but this browser signed in with the first moments ago', async () => {
    const expiredHash = '#error=access_denied&error_code=otp_expired';
    expect(await new SupabaseAuthService(fakeClient({ session: linkSession('recovery') }) as never, expiredHash).lookupReset()).toEqual({ status: 'valid', email: 'diego@ibjjf.com' });
    expect(await new SupabaseAuthService(fakeClient({ session: linkSession('invite') }) as never, expiredHash).lookupInvitation()).toMatchObject({ status: 'valid' });
    // An ordinary sign-in, or a link used long ago, doesn't count.
    expect(await new SupabaseAuthService(fakeClient({ session: linkSession('password') }) as never, expiredHash).lookupReset()).toEqual({ status: 'expired' });
    expect(await new SupabaseAuthService(fakeClient({ session: linkSession('recovery', 3600) }) as never, expiredHash).lookupReset()).toEqual({ status: 'expired' });
  });

  it("passes on Supabase's own reason when it turns a new password down, instead of calling the link expired", async () => {
    const weak = fakeClient();
    weak.auth.updateUser = vi.fn(async () => ({ error: { status: 422, code: 'same_password', name: 'AuthApiError', message: 'New password should be different from the old password.' } })) as never;
    expect(await new SupabaseAuthService(weak as never).resetPassword('link', 'pw-123456789', true)).toEqual({ ok: false, refused: 'New password should be different from the old password.' });
    const gone = fakeClient();
    gone.auth.updateUser = vi.fn(async () => ({ error: { status: 401, name: 'AuthApiError', message: 'Invalid JWT' } })) as never;
    expect(await new SupabaseAuthService(gone as never).resetPassword('link', 'pw-123456789', true)).toEqual({ ok: false, status: 'expired' });
  });

  it("doesn't sign out a link opened here for someone other than whoever was signed in to the app", async () => {
    const sb = fakeClient();
    const crew = { personId: 'p-dandre', name: "D'Andre", email: 'jackson@ibjjf.com', role: 'crew' as const, keep: true, expiresAt: null };
    expect(await new SupabaseAuthService(sb as never).checkSession(crew)).toBeNull();
    expect(sb.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('Supabase sign-in, offline', () => {
  it('says the service is unreachable rather than blaming the password', async () => {
    const sb = { auth: { signInWithPassword: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) }, rpc: vi.fn() };
    expect(await new SupabaseAuthService(sb as never).signIn('a@b.c', 'pw', false)).toEqual({ ok: false, reason: 'unavailable' });
    const sb2 = { auth: { signInWithPassword: vi.fn(async () => ({ error: { name: 'AuthRetryableFetchError', status: 0 } })) }, rpc: vi.fn() };
    expect(await new SupabaseAuthService(sb2 as never).signIn('a@b.c', 'pw', false)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
