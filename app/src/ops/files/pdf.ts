import type { PDFDocumentProxy } from 'pdfjs-dist';

// pdf.js is loaded on first use so it stays out of the main bundle. The legacy build carries the
// polyfills older phone browsers need (pdf.js 6 uses Map.prototype.getOrInsertComputed).
let lib: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;
function pdfjs() {
  if (!lib) {
    lib = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([m, w]) => {
      m.GlobalWorkerOptions.workerSrc = w.default;
      return m;
    });
  }
  return lib;
}

/**
 * Opens a PDF for display. Uploaded files are untrusted: only the page canvas is rendered,
 * never the annotation layer or document scripts.
 */
export async function openPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  return m.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
}

export const closePdf = (doc: PDFDocumentProxy) => doc.loadingTask.destroy();

export async function countPages(blob: Blob): Promise<number> {
  const doc = await openPdf(blob);
  const n = doc.numPages;
  await closePdf(doc);
  return n;
}
