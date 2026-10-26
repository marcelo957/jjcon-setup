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
export async function syncStoredFiles(): Promise<void> {
  if (!supabase) return;
  const [stored, removed] = await Promise.all([supabase.rpc('stored_files'), supabase.rpc('removed_demo_files')]);
  if (stored.error || removed.error) return;
  opsStore().applyStoredFiles(stored.data as StoredFile[], removed.data as { sector_id: string; slot: string }[]);
}

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
