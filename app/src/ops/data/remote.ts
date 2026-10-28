import { useEffect, useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { diffRows, fromRows, TABLES, toRows, type Row, type RowChanges, type Table, type Tables } from '../../supabase/rows';
import { opsStore, type OpsStore } from './store';
import type { OpsData } from './types';

/**
 * The console's data lives in the Supabase tables. The store keeps a copy in the browser; every change
 * is written to the database as soon as it's made, and everyone's copy is refreshed from the database
 * on load, when the tab comes back, and every 15 seconds.
 */

export type RemoteStatus =
  | { state: 'loading' }
  | { state: 'ready'; saveError?: string }
  | { state: 'error'; error: string };

const PAGE = 1000;
export const REFRESH_MS = 15_000;

export class RemoteData {
  private status: RemoteStatus = { state: 'loading' };
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private pending = 0;
  /** Counts local changes, so a refresh that started before one isn't applied over it. */
  private edits = 0;

  constructor(private sb: SupabaseClient, private store: OpsStore) {}

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getStatus = () => this.status;
  private set(s: RemoteStatus) { this.status = s; this.listeners.forEach((fn) => fn()); }

  /** Reads every table and replaces the browser's copy, unless a change of ours is still on its way. */
  async refresh(): Promise<void> {
    const startedAt = this.edits;
    let data: OpsData;
    try {
      data = fromRows(await this.readAll());
    } catch (e) {
      if (this.status.state === 'loading' || this.status.state === 'error') this.set({ state: 'error', error: message(e) });
      return;
    }
    if (this.pending || this.edits !== startedAt) return;
    this.store.replaceFromRemote(data);
    if (this.status.state !== 'ready') this.set({ state: 'ready' });
  }

  private async readAll(): Promise<Tables> {
    const read = async (table: Table) => {
      const rows: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await this.sb.from(table).select('*').order('id').range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data as Row[]));
        if (data.length < PAGE) return rows;
      }
    };
    const all = await Promise.all(TABLES.map(read));
    const t = Object.fromEntries(TABLES.map((name, i) => [name, all[i]])) as Tables;
    // Signed in but not (or no longer) an active team member: the database shows nothing at all.
    if (!t.people.length) throw new Error("Your login can't see the team's data. Your account may be inactive; ask an admin.");
    return t;
  }

  /** Called by the store with each change: writes just the rows that differ. */
  push(before: OpsData, after: OpsData) {
    const changes = diffRows(toRows(before), toRows(after));
    if (!changes.count) return;
    this.edits++;
    this.pending++;
    this.writes = this.writes
      .then(() => write(this.sb, changes))
      .then(() => { if (this.status.state === 'ready' && this.status.saveError) this.set({ state: 'ready' }); })
      .catch((e) => {
        this.set({ state: 'ready', saveError: message(e) });
        // Show what the database actually holds again.
        this.edits++;
      })
      .finally(() => { this.pending--; if (this.status.state === 'ready' && this.status.saveError) void this.refresh(); });
  }

  /** Resolves once every change made so far is written. */
  settled = () => this.writes;
}

/** New and changed rows first, parents before children; then deletions, children before parents. */
async function write(sb: SupabaseClient, c: RowChanges) {
  for (const table of TABLES) {
    const rows = c.upsert[table];
    if (rows?.length) { const { error } = await sb.from(table).upsert(rows); if (error) throw error; }
  }
  for (const table of [...TABLES].reverse()) {
    const ids = c.remove[table];
    if (ids?.length) { const { error } = await sb.from(table).delete().in('id', ids); if (error) throw error; }
  }
}

function message(e: unknown): string {
  const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/row-level security|permission denied/i.test(m)) return "The database didn't allow this change for your login.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No connection to the database. Check your internet connection.';
  return m;
}

let remote: RemoteData | null = null;
export function remoteData(): RemoteData | null {
  if (!supabase) return null;
  if (!remote) {
    remote = new RemoteData(supabase, opsStore());
    opsStore().connect(remote);
  }
  return remote;
}

const READY: RemoteStatus = { state: 'ready' };
const none = () => () => {};

/** Loads the team's data from the database and keeps it current while the console is open. */
export function useRemoteData(): RemoteStatus {
  const r = remoteData();
  useEffect(() => {
    if (!r) return;
    void r.refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void r.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(() => void r.refresh(), REFRESH_MS);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t); };
  }, [r]);
  return useSyncExternalStore(r?.subscribe ?? none, r?.getStatus ?? (() => READY));
}
