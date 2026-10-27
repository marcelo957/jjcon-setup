import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { opsStore } from '../data/store';

/** One stored file per sector and plan folder, the newest, as Supabase reports it. */
export interface StoredFile {
  sector_id: string; slot: string; path: string; name: string; size: number | null; pages: number;
  uploaded_at: string; uploaded_by: string | null; replaced_uploaded_at: string | null;
}

/**
 * Brings this browser's plans in line with what is actually in Storage: files others uploaded
 * appear, and files deleted anywhere disappear (so the plan is outstanding again).
 */
export async function syncStoredFiles(): Promise<SyncReport | null> {
  if (!supabase) return null;
  const [stored, removed] = await Promise.all([supabase.rpc('stored_files'), supabase.rpc('removed_demo_files')]);
  const error = stored.error ?? removed.error;
  if (error) {
    console.warn('Floorplan storage check failed:', error);
    return { error: error.message };
  }
  const files = stored.data as StoredFile[];
  opsStore().applyStoredFiles(files, removed.data as { sector_id: string; slot: string }[]);
  return { files: files.map((f) => `${f.sector_id} / ${f.slot}`) };
}

/** What the last check against Storage found, for the access page. */
export type SyncReport = { files: string[]; error?: undefined } | { error: string; files?: undefined };

/** Keep in step while the console is open: on load, when the tab comes back, and every two minutes. */
export function useStoredFileSync() {
  useEffect(() => {
    if (!supabase) return;
    void syncStoredFiles();
    const onVisible = () => { if (document.visibilityState === 'visible') void syncStoredFiles(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(() => void syncStoredFiles(), 120_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t); };
  }, []);
}
