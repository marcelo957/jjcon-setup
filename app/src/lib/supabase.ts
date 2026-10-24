import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase project this app talks to. Both values come from environment variables, never
 * from the code: `app/.env.local` on a developer's machine (git-ignored), and repository
 * secrets for the published site. The anon key is the public, browser-safe key; what it can
 * read and change is decided by row level security in the database, not by hiding it.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const supabaseConfigured = url !== '' && anonKey !== '';

export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url, anonKey) : null;

export type ConnectionCheck =
  | { state: 'not-configured' }
  | { state: 'connected'; host: string }
  | { state: 'bad-key'; host: string }
  | { state: 'unreachable'; host: string; reason: string };

/** Asks the project's auth service for its public settings: proves the URL is reachable and the key is accepted. */
export async function checkConnection(fetcher: typeof fetch = fetch): Promise<ConnectionCheck> {
  if (!supabaseConfigured) return { state: 'not-configured' };
  let host = url;
  try { host = new URL(url).host; } catch { return { state: 'unreachable', host: url, reason: 'The project URL is not a valid web address.' }; }
  try {
    const res = await fetcher(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (res.ok) return { state: 'connected', host };
    if (res.status === 401 || res.status === 403) return { state: 'bad-key', host };
    return { state: 'unreachable', host, reason: `The project answered with an error (${res.status}).` };
  } catch {
    return { state: 'unreachable', host, reason: 'No answer from the project. Check the URL and your connection.' };
  }
}
