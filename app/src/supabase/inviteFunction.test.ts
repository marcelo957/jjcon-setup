import { vi } from 'vitest';
import { handleInvite } from '../../../supabase/functions/invite/index';

const ENV = { url: 'https://x.supabase.co', anonKey: 'anon', serviceKey: 'service' };
const ADMIN = { person_id: 'p-marcelo', role: 'admin', active: true };

/** Two fake clients: the caller's (rpc me) and the service one (tables and auth admin). */
function world(opts: { caller?: unknown; account?: { user_id: string } | null; lastSignIn?: string | null; upsertError?: { code: string; message: string } } = {}) {
  const calls: Record<string, unknown[]> = { upsert: [], deleteUser: [], invite: [] };
  const callerClient = { rpc: vi.fn(async () => ({ data: opts.caller === undefined ? [ADMIN] : opts.caller })) };
  const serviceClient = {
    from: (table: string) => ({
      upsert: async (row: unknown) => { calls.upsert.push([table, row]); return { error: opts.upsertError ?? null }; },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.account ?? null }) }) })
    }),
    auth: { admin: {
      getUserById: async () => ({ data: { user: { last_sign_in_at: opts.lastSignIn ?? null } } }),
      deleteUser: async (id: string) => { calls.deleteUser.push(id); return { error: null }; },
      inviteUserByEmail: async (email: string, o: unknown) => { calls.invite.push([email, o]); return { error: null }; }
    } }
  };
  const make = vi.fn((_u: string, key: string) => (key === 'anon' ? callerClient : serviceClient)) as never;
  return { make, calls };
}

const post = (body: unknown) => new Request('https://x.supabase.co/functions/v1/invite', {
  method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const BODY = { personId: 'p-diego', name: 'Diego', email: 'Diego@IBJJF.com', role: 'editor', redirectTo: 'https://marcelo957.github.io/jjcon-setup/invite/link' };

describe('invite Edge Function', () => {
  it('lets an admin invite someone with a role, recording who invited them', async () => {
    const w = world();
    const res = await handleInvite(post(BODY), ENV, w.make);
    expect(res.status).toBe(200);
    expect(w.calls.upsert[0]).toEqual(['people', { id: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com' }]);
    expect(w.calls.invite[0]).toEqual(['diego@ibjjf.com', { data: { role: 'editor', invited_by: 'p-marcelo', name: 'Diego' }, redirectTo: BODY.redirectTo }]);
  });

  it('refuses anyone who is not an active admin', async () => {
    for (const caller of [[], [{ ...ADMIN, role: 'editor' }], [{ ...ADMIN, active: false }], null]) {
      const w = world({ caller });
      const res = await handleInvite(post(BODY), ENV, w.make);
      expect(res.status).toBe(403);
      expect(w.calls.invite).toHaveLength(0);
    }
  });

  it('replaces an unused invitation but never a login that has been used', async () => {
    const unused = world({ account: { user_id: 'u-1' }, lastSignIn: null });
    expect((await handleInvite(post(BODY), ENV, unused.make)).status).toBe(200);
    expect(unused.calls.deleteUser).toEqual(['u-1']);
    const used = world({ account: { user_id: 'u-1' }, lastSignIn: '2026-10-20T10:00:00Z' });
    const res = await handleInvite(post(BODY), ENV, used.make);
    expect(res.status).toBe(409);
    expect(used.calls.deleteUser).toHaveLength(0);
    expect((await res.json()).error).toMatch(/already has a login/);
  });

  it('checks the email and role, and explains a clash with an email already on the list', async () => {
    expect((await handleInvite(post({ ...BODY, email: 'not-an-email' }), ENV, world().make)).status).toBe(400);
    expect((await handleInvite(post({ ...BODY, role: 'owner' }), ENV, world().make)).status).toBe(400);
    const clash = await handleInvite(post(BODY), ENV, world({ upsertError: { code: '23505', message: 'duplicate' } }).make);
    expect((await clash.json()).error).toBe('Someone else on the People list already uses this email.');
  });
});
