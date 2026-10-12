import { opsStore } from '../data/store';
import { dateLabel } from '../data/selectors';
import type { FileRef } from '../data/types';
import { samplePlanPdf } from './samplePdf';

/**
 * Uploaded PDFs, kept in IndexedDB until there is a real file service. The demo data's
 * plans point at `sample:<sector>:<plan>` ids, which are drawn on demand instead of stored.
 */

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

export async function readFile(file: FileRef): Promise<Blob | null> {
  if (file.id.startsWith('sample:')) {
    const [, sectorId, key] = file.id.split(':');
    const s = opsStore().sector(sectorId);
    const bytes = samplePlanPdf(sectorId, s?.name ?? sectorId, key as never, file.pages, dateLabel(file.uploadedAt));
    return new Blob([bytes.slice().buffer], { type: 'application/pdf' });
  }
  return (await tx<Blob | undefined>('readonly', (s) => s.get(file.id))) ?? null;
}

export const MAX_PDF_BYTES = 50 * 1_048_576;

/** Checks the file really is a PDF, stores it and returns its record. `pages` is read by pdf.js. */
export async function storePdf(file: File, uploadedBy: string | null, countPages: (b: Blob) => Promise<number>): Promise<FileRef> {
  if (file.size > MAX_PDF_BYTES) throw new Error('That file is over 50 MB. Export the plan at a lower resolution and try again.');
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') throw new Error('That file is not a PDF. Export the plan as PDF and upload it again.');
  const pages = await countPages(file);
  const id = `f-${crypto.randomUUID()}`;
  await tx('readwrite', (s) => s.put(file, id));
  return { id, name: file.name, size: file.size, pages, uploadedAt: new Date().toISOString(), uploadedBy };
}
