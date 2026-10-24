import { vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function load(url?: string, key?: string) {
  if (url !== undefined) vi.stubEnv('VITE_SUPABASE_URL', url);
  if (key !== undefined) vi.stubEnv('VITE_SUPABASE_ANON_KEY', key);
  return import('./supabase');
}

describe('Supabase connection', () => {
  it('stays off without both values', async () => {
    const m = await load('', '');
    expect(m.supabaseConfigured).toBe(false);
    expect(m.supabase).toBeNull();
    expect(await m.checkConnection()).toEqual({ state: 'not-configured' });
  });

  it('reports connected when the project accepts the key', async () => {
    const m = await load('https://abcd.supabase.co', 'anon-key');
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await m.checkConnection(fetcher as never)).toEqual({ state: 'connected', host: 'abcd.supabase.co' });
    expect(fetcher).toHaveBeenCalledWith('https://abcd.supabase.co/auth/v1/settings', { headers: { apikey: 'anon-key' } });
  });

  it('tells a wrong key from an unreachable project', async () => {
    const m = await load('https://abcd.supabase.co', 'wrong');
    expect((await m.checkConnection((async () => new Response('', { status: 401 })) as never)).state).toBe('bad-key');
    expect((await m.checkConnection((async () => { throw new TypeError('Failed to fetch'); }) as never)).state).toBe('unreachable');
  });
});
