// JJCON SetUp · step 4b · the "invite" Edge Function.
// Deploy in Supabase → Edge Functions → Deploy a new function → Via Editor, name it `invite`,
// paste this whole file, Deploy. Leave "Verify JWT" on.
//
// The People page calls this to send (or re-send) an invitation. It runs inside Supabase
// because sending invitations needs the service-role key, which must never be in the app.
// Only an active admin can use it.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const ROLES = ['admin', 'editor', 'crew'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Env = { url: string; anonKey: string; serviceKey: string };
type MakeClient = typeof createClient;

export async function handleInvite(req: Request, env: Env, make: MakeClient = createClient): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  // Who is asking: the signed-in person, through their own login.
  const asCaller = make(env.url, env.anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: me } = await asCaller.rpc('me');
  const caller = Array.isArray(me) ? me[0] : null;
  if (!caller || caller.role !== 'admin' || !caller.active) return reply(403, { error: 'Only an admin can send invitations.' });

  let body: { personId?: unknown; name?: unknown; email?: unknown; role?: unknown; redirectTo?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'The request was not readable.' }); }
  const personId = typeof body.personId === 'string' ? body.personId.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
  if (!personId || !name) return reply(400, { error: 'Pick someone from the People list to invite.' });
  if (!EMAIL.test(email)) return reply(400, { error: 'That email address doesn\'t look right.' });
  if (!ROLES.includes(role)) return reply(400, { error: 'Pick a role: admin, editor or crew.' });

  const admin = make(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // The People list still lives in the app for now: make sure this person is in the database.
  const { error: upErr } = await admin.from('people').upsert({ id: personId, name, email }, { onConflict: 'id' });
  if (upErr) {
    return reply(400, { error: upErr.code === '23505' ? 'Someone else on the People list already uses this email.' : upErr.message });
  }

  // A previous invitation nobody used is replaced. A login that has been used is left alone.
  const { data: acct } = await admin.from('accounts').select('user_id').eq('person_id', personId).maybeSingle();
  if (acct?.user_id) {
    const { data: existing } = await admin.auth.admin.getUserById(acct.user_id);
    if (existing?.user?.last_sign_in_at) return reply(409, { error: `${name} already has a login. They can use "Forgot your password?" if they need a new one.` });
    await admin.auth.admin.deleteUser(acct.user_id);
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role, invited_by: caller.person_id, name },
    redirectTo
  });
  if (error) {
    const taken = /already.*registered|already exists/i.test(error.message);
    return reply(taken ? 409 : 400, { error: taken ? `${email} already has a login.` : error.message });
  }
  return reply(200, { ok: true });
}

// Running inside Supabase.
declare const Deno: { serve(h: (r: Request) => Promise<Response>): void; env: { get(k: string): string | undefined } } | undefined;
if (typeof Deno !== 'undefined') {
  const env = {
    url: Deno.env.get('SUPABASE_URL') ?? '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  };
  Deno.serve((req) => handleInvite(req, env));
}
