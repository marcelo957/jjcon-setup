import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Icon } from '../../ds/Icon';
import { dateLabel, sizeLabel } from '../data/selectors';
import type { FileRef } from '../data/types';
import { readFile } from '../files/fileStore';
import { closePdf, openPdf } from '../files/pdf';

function usePdf(file: FileRef | undefined) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    let live = true;
    let opened: PDFDocumentProxy | null = null;
    setDoc(null); setError(null); setBlob(null);
    readFile(file)
      .then((b) => {
        if (!b) throw new Error('missing');
        if (live) setBlob(b);
        return openPdf(b);
      })
      .then((d) => { opened = d; if (live) setDoc(d); else void closePdf(d); })
      .catch(() => { if (live) setError('This PDF could not be opened. Download it to check the file, or upload it again.'); });
    return () => { live = false; if (opened) void closePdf(opened); };
  }, [file?.id]);
  return { doc, blob, error };
}

/** Renders one page into a canvas at `scale` CSS pixels per PDF point, sharp on high-density screens. */
function PageCanvas({ doc, page, scale, onSize }: { doc: PDFDocumentProxy; page: number; scale: number; onSize?: (w: number, h: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: RenderTask | null = null;
    let live = true;
    doc.getPage(page).then((p) => {
      if (!live || !ref.current) return;
      const base = p.getViewport({ scale: 1 });
      onSize?.(base.width, base.height);
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: scale * dpr });
      const c = ref.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(base.width * scale)}px`;
      c.style.height = `${Math.floor(base.height * scale)}px`;
      task = p.render({ canvas: c, viewport: vp });
      task.promise.catch(() => {});
    });
    return () => { live = false; task?.cancel(); };
  }, [doc, page, scale]);
  return <canvas ref={ref} role="img" aria-label={`Page ${page}`} style={{ display: 'block', background: '#fff', boxShadow: 'var(--ib-elevation-1)' }} />;
}

/**
 * The floorplan card's viewer: the uploaded PDF fitted to the box, page navigation for
 * multi-page files, zoom with a "Fit to page" reset, and a download of the original.
 */
export function PdfViewer({ file, prevUploadedAt }: { file: FileRef; prevUploadedAt?: string }) {
  const { doc, blob, error } = usePdf(file);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pageSize, setPageSize] = useState({ w: 880, h: 660 });
  const boxRef = useRef<HTMLDivElement>(null);
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => { setPage(1); setZoom(null); }, [file.id]);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setHref(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = box.w && box.h ? Math.max(0.2, Math.min(1.6, Math.min((box.w - 20) / pageSize.w, (box.h - 20) / pageSize.h))) : 0.8;
  const scale = zoom ?? fit;
  const pages = doc?.numPages ?? file.pages;
  const contentH = pageSize.h * scale;

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 12px', background: 'var(--color-neutral-surface-300)', borderBottom: '1px solid var(--border-divider)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 14, color: 'var(--text-primary)' }}>
          <Icon fa="file-pdf" size={14} style={{ color: 'var(--feedback-danger-text)' }} />{file.name}
        </span>
        <span className="mono muted" style={{ fontSize: 12 }}>{sizeLabel(file.size)} · uploaded {dateLabel(file.uploadedAt)}</span>
        {pages > 1 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <button type="button" className="icon-btn icon-btn--30" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><Icon fa="angle-left" size={14} /></button>
            <span className="mono" style={{ fontSize: 13, minWidth: 86, textAlign: 'center' }}>Page {page} of {pages}</span>
            <button type="button" className="icon-btn icon-btn--30" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}><Icon fa="angle-right" size={14} /></button>
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button type="button" className="icon-btn icon-btn--30" aria-label="Zoom out" onClick={() => setZoom(Math.max(0.2, +(scale - 0.2).toFixed(2)))}><Icon fa="minus" size={14} /></button>
          <span className="mono" style={{ fontSize: 13, minWidth: 48, textAlign: 'center' }} aria-live="polite">{Math.round(scale * 100)}%</span>
          <button type="button" className="icon-btn icon-btn--30" aria-label="Zoom in" onClick={() => setZoom(Math.min(2.4, +(scale + 0.2).toFixed(2)))}><Icon fa="plus" size={14} /></button>
          <button type="button" className="text-btn" onClick={() => setZoom(null)}>Fit to page</button>
          <a href={href ?? undefined} download={file.name} aria-disabled={!href}
            style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 30, padding: '0 10px', border: '1px solid var(--brand-primary)', borderRadius: 4, fontSize: 13 }}>
            <Icon fa="download" size={11} />Download PDF
          </a>
        </span>
      </div>
      <div ref={boxRef} style={{ height: 'min(660px, max(300px, calc(100vh - 430px)))', background: 'var(--color-neutral-surface-300)', overflow: 'auto' }}>
        {error && <div className="notice" style={{ margin: 16 }}><div className="notice__title">Can't show this PDF</div><div className="notice__text">{error}</div></div>}
        {!error && !doc && <div className="muted" style={{ padding: 16, fontSize: 13 }}>Loading the PDF…</div>}
        {doc && (
          <div style={{ width: 'max-content', margin: `${Math.max(0, Math.round((box.h - contentH) / 2))}px auto 0`, padding: zoom ? 10 : 0 }}>
            <PageCanvas doc={doc} page={Math.min(page, pages)} scale={scale} onSize={(w, h) => { if (w !== pageSize.w || h !== pageSize.h) setPageSize({ w, h }); }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12, color: 'var(--color-neutral-gray-300)' }}>
        <Icon fa="circle-info" size={14} />
        <span>{prevUploadedAt ? `Replaced the PDF uploaded ${dateLabel(prevUploadedAt)}` : 'First upload of this plan'}. The legend is part of the uploaded drawing.</span>
      </div>
    </div>
  );
}

/** First page, small, for the upload list in edit mode. */
export function PdfThumb({ file }: { file?: FileRef }) {
  const { doc } = usePdf(file);
  return (
    <div style={{ flex: '0 0 96px', height: 68, border: '1px solid var(--border-divider)', background: 'var(--color-neutral-white)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {file && doc ? <PageCanvas doc={doc} page={1} scale={0.105} /> : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-neutral-surface-100)', color: 'var(--color-neutral-gray-300)' }}>
          <Icon fa="file-pdf" size={22} />
        </div>
      )}
    </div>
  );
}
