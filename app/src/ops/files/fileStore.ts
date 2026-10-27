import { supabase } from '../../lib/supabase';
import { opsStore } from '../data/store';
import { dateLabel } from '../data/selectors';
import type { FileRef } from '../data/types';
import { slotFolder } from './paths';
import { samplePlanPdf } from './samplePdf';

/**
 * Uploaded PDFs. With Supabase set up they go to the private "floorplans" Storage bucket, kept
 * per sector and plan (`sb:<sector>/<plan-G | custom id>/<file>`); without it, to this browser's
 * IndexedDB. The demo data's plans point at `sample:<sector>:<plan>` ids, drawn on demand.
 */

export const BUCKET = 'floorplans';
/** Which plan or PDF block a file belongs to: `plan:G` … or a custom block's id. */
export interface FileWhere { sectorId: string; slot: string }
const safeName = (n: string) => n.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'plan.pdf';
const storagePath = (id: string) => id.slice(3);

const DB = 'jjcon-files';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Storage refused or failed to hand back a file; the message is Storage's own reason. */
export class StorageReadError extends Error {}

export async function readFile(file: FileRef): Promise<Blob | null> {
  if (file.id.startsWith('sb:')) {
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath(file.id));
    if (error) throw new StorageReadError(error.message || 'no reason given');
    return data;
  }
  if (file.id.startsWith('sample:')) {
    const [, sectorId, key] = file.id.split(':');
    const s = opsStore().sector(sectorId);
    const bytes = samplePlanPdf(sectorId, s?.name ?? sectorId, key as never, file.pages, dateLabel(file.uploadedAt));
    return new Blob([bytes.slice().buffer], { type: 'application/pdf' });
  }
  return (await tx<Blob | undefined>('readonly', (s) => s.get(file.id))) ?? null;
}

export const MAX_PDF_BYTES = 50 * 1_048_576;

/**
 * Checks the file really is a PDF, stores it and returns its record. `pages` is read by pdf.js.
 * With Supabase and `where`, the file goes to Storage; `replaces` is the date of the file it replaces.
 */
export async function storePdf(file: File, uploadedBy: string | null, countPages: (b: Blob) => Promise<number>, where?: FileWhere, replaces?: string): Promise<FileRef> {
  if (file.size > MAX_PDF_BYTES) throw new Error('That file is over 50 MB. Export the plan at a lower resolution and try again.');
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') throw new Error('That file is not a PDF. Export the plan as PDF and upload it again.');
  const pages = await countPages(file);
  if (supabase && where) {
    const path = `${where.sectorId}/${slotFolder(where.slot)}/${Date.now()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: 'application/pdf', upsert: false,
      metadata: { name: file.name, pages: String(pages), ...(replaces ? { replaces } : {}) }
    });
    if (error) throw new Error(/row-level security|403|unauthor/i.test(error.message)
      ? 'You can\'t upload plans for this sector. Ask an admin or the sector\'s lead.'
      : 'The upload failed. Check your connection and try again.');
    return { id: `sb:${path}`, name: file.name, size: file.size, pages, uploadedAt: new Date().toISOString(), uploadedBy };
  }
  const id = `f-${crypto.randomUUID()}`;
  await tx('readwrite', (s) => s.put(file, id));
  return { id, name: file.name, size: file.size, pages, uploadedAt: new Date().toISOString(), uploadedBy };
}

/**
 * Takes a file away for good: deletes it from Storage, or marks one of the demo's drawn plans
 * as removed. Throws when Supabase refuses, so the plan stays as it was.
 */
export async function discardPdf(file: FileRef, where: FileWhere): Promise<void> {
  if (!supabase) return;
  if (file.id.startsWith('sb:')) {
    const { data, error } = await supabase.storage.from(BUCKET).remove([storagePath(file.id)]);
    if (error || !data?.length) throw new Error('The file could not be removed. Only an admin or this sector\'s lead can remove plans.');
  } else if (file.id.startsWith('sample:')) {
    const { error } = await supabase.rpc('remove_demo_file', { sid: where.sectorId, block_slot: where.slot });
    if (error) throw new Error('The plan could not be removed. Only an admin or this sector\'s lead can remove plans.');
  }
}
