import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Icon } from '../../ds/Icon';
import { dateLabel, sizeLabel } from '../data/selectors';
import type { FileRef } from '../data/types';
import { readFile } from '../files/fileStore';
import { closePdf, openPdf } from '../files/pdf';

export function usePdf(file: FileRef | undefined) {
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
function PageCanvas({ doc, page, scale, onSize, onDone, minDpr = 1 }: {
  doc: PDFDocumentProxy; page: number; scale: number; onSize?: (w: number, h: number) => void; onDone?: () => void; minDpr?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: RenderTask | null = null;
    let live = true;
    doc.getPage(page).then((p) => {
      if (!live || !ref.current) return;
      const base = p.getViewport({ scale: 1 });
      onSize?.(base.width, base.height);
      const dpr = Math.max(minDpr, window.devicePixelRatio || 1);
      const vp = p.getViewport({ scale: scale * dpr });
      const c = ref.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(base.width * scale)}px`;
      c.style.height = `${Math.floor(base.height * scale)}px`;
      task = p.render({ canvas: c, viewport: vp });
      task.promise.then(() => { if (live) onDone?.(); }, () => {});
    });
    return () => { live = false; task?.cancel(); };
  }, [doc, page, scale]);
  return <canvas ref={ref} role="img" aria-label={`Page ${page}`} style={{ display: 'block', background: '#fff', boxShadow: 'var(--ib-elevation-1)' }} />;
}

/** How the floorplan card shows a PDF: a set zoom (1 = 100%, true size), or fitted to the card. */
export type PdfView = { mode: 'zoom'; zoom: number } | { mode: 'width' } | { mode: 'page' };

/** CSS pixels per PDF point at 100%: true size, as Acrobat and browsers show it (96 dpi screens). */
const TRUE_SIZE = 96 / 72;
const PAD = 8;
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
/** Phones fit the plan to the screen and pinch to zoom; desktops open at true size. */
export const defaultPdfView = (): PdfView =>
  (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 600px)').matches ? { mode: 'width' } : { mode: 'zoom', zoom: 1 });

/**
 * The floorplan card's viewer. Opens at 100% (true size) at the top of the page; scrolls and
 * drags to pan when the page is bigger than the card; presets for 100%, fit to width and fit
 * to page. Pass `view`/`onView` to keep one zoom across several plans.
 */
export function PdfViewer({ file, prevUploadedAt, view: viewProp, onView }: { file: FileRef; prevUploadedAt?: string; view?: PdfView; onView?: (v: PdfView) => void }) {
  const { doc, blob, error } = usePdf(file);
  const [page, setPage] = useState(1);
  const [ownView, setOwnView] = useState<PdfView>(defaultPdfView);
  const view = viewProp ?? ownView;
  const setView = (v: PdfView) => { setOwnView(v); onView?.(v); };
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pageSize, setPageSize] = useState({ w: 612, h: 792 });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [file.id]);
  // Every plan, and every page, opens at its top-left corner.
  useEffect(() => { const el = boxRef.current; if (el) { el.scrollTop = 0; el.scrollLeft = 0; } }, [file.id, page]);
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

  const fitWidth = box.w ? Math.max(0.1, (box.w - 2 * PAD) / (pageSize.w * TRUE_SIZE)) : 1;
  const fitPage = box.w && box.h ? Math.max(0.1, Math.min(fitWidth, (box.h - 2 * PAD) / (pageSize.h * TRUE_SIZE))) : 1;
  const zoom = view.mode === 'zoom' ? view.zoom : view.mode === 'width' ? fitWidth : fitPage;
  const scale = zoom * TRUE_SIZE;
  const pages = doc?.numPages ?? file.pages;
  const contentW = pageSize.w * scale + 2 * PAD;
  const contentH = pageSize.h * scale + 2 * PAD;
  const pans = contentW > box.w + 1 || contentH > box.h + 1;
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? STEPS.find((z) => z > zoom + 0.001) ?? STEPS[STEPS.length - 1] : [...STEPS].reverse().find((z) => z < zoom - 0.001) ?? STEPS[0];
    setView({ mode: 'zoom', zoom: next });
  };
  const preset = (label: string, v: PdfView, on: boolean) => (
    <button type="button" aria-pressed={on} onClick={() => setView(v)}
      style={{ minHeight: 30, padding: '0 10px', border: 0, borderRight: '1px solid var(--border-divider)', background: on ? 'var(--brand-primary)' : 'var(--color-neutral-white)', color: on ? '#fff' : 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );

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
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" className="icon-btn icon-btn--30" aria-label="Zoom out" onClick={() => step(-1)}><Icon fa="minus" size={14} /></button>
          <span className="mono" style={{ fontSize: 13, minWidth: 48, textAlign: 'center' }} aria-live="polite" aria-label={`Zoom ${Math.round(zoom * 100)}%`}>{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn icon-btn--30" aria-label="Zoom in" onClick={() => step(1)}><Icon fa="plus" size={14} /></button>
          <span role="group" aria-label="Zoom presets" style={{ display: 'inline-flex', border: '1px solid var(--border-divider)', borderRadius: 4, overflow: 'hidden' }}>
            {preset('100%', { mode: 'zoom', zoom: 1 }, view.mode === 'zoom' && view.zoom === 1)}
            {preset('Fit width', { mode: 'width' }, view.mode === 'width')}
            {preset('Fit page', { mode: 'page' }, view.mode === 'page')}
          </span>
          <a href={href ?? undefined} download={file.name} aria-disabled={!href}
            style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 30, padding: '0 10px', border: '1px solid var(--brand-primary)', borderRadius: 4, fontSize: 13 }}>
            <Icon fa="download" size={11} />Download PDF
          </a>
        </span>
      </div>
      <div ref={boxRef} data-testid="pdf-box"
        style={{ height: 'clamp(420px, calc(100vh - 200px), 1100px)', background: 'var(--color-neutral-surface-300)', overflow: 'auto', touchAction: 'pan-x pan-y pinch-zoom', cursor: pans ? (dragging ? 'grabbing' : 'grab') : 'default', userSelect: dragging ? 'none' : undefined }}
        onPointerDown={(e) => {
          // Click and drag to pan, like a hand tool. Touch keeps its own scrolling and pinch.
          if (e.pointerType !== 'mouse' || e.button !== 0 || !pans) return;
          const el = e.currentTarget;
          drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
          el.setPointerCapture?.(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          e.currentTarget.scrollLeft = d.left - (e.clientX - d.x);
          e.currentTarget.scrollTop = d.top - (e.clientY - d.y);
        }}
        onPointerUp={(e) => { drag.current = null; setDragging(false); e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}>
        {error && <div className="notice" style={{ margin: 16 }}><div className="notice__title">Can't show this PDF</div><div className="notice__text">{error}</div></div>}
        {!error && !doc && <div className="muted" style={{ padding: 16, fontSize: 13 }}>Loading the PDF…</div>}
        {doc && (
          // Top-aligned; centred across while it's narrower than the card, panned when wider.
          <div style={{ width: 'max-content', margin: '0 auto', padding: PAD }}>
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

/**
 * The phone's floorplan: a fixed-height pane the lead scrolls and pinches, with large
 * zoom and page buttons. Opens fitted to the pane's width.
 */
export function PhonePdf({ file }: { file: FileRef }) {
  const { doc, error } = usePdf(file);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [w, setW] = useState(0);
  const [pageSize, setPageSize] = useState({ w: 880, h: 660 });
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { setPage(1); setZoom(null); }, [file.id]);
  const fit = w ? Math.max(0.2, (w - 24) / pageSize.w) : 0.38;
  const scale = zoom ?? fit;
  const pages = doc?.numPages ?? file.pages;
  const big = { width: 44, height: 44, border: '1px solid var(--border-divider)', borderRadius: 8, background: 'var(--color-neutral-white)', color: 'var(--text-primary)', cursor: 'pointer' } as const;
  return (
    <div className="field-card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-neutral-gray-300)' }}>
          <Icon fa="file-pdf" size={14} style={{ color: 'var(--feedback-danger-text)' }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name} · {sizeLabel(file.size)} · {dateLabel(file.uploadedAt)}</span>
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button type="button" style={big} aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><Icon fa="angle-left" size={14} /></button>
            <span className="mono" style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>Page {Math.min(page, pages)} of {pages}</span>
            <button type="button" style={big} aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}><Icon fa="angle-right" size={14} /></button>
          </div>
        )}
      </div>
      <div ref={boxRef} style={{ height: 340, overflow: 'auto', background: 'var(--color-neutral-surface-300)', touchAction: 'pan-x pan-y pinch-zoom' }}>
        {error && <div className="notice" style={{ margin: 12 }}><div className="notice__title">Can't show this PDF</div><div className="notice__text">{error}</div></div>}
        {!error && !doc && <div className="muted" style={{ padding: 12, fontSize: 14 }}>Loading the floorplan…</div>}
        {doc && (
          <div style={{ width: 'max-content', padding: 12 }}>
            <PageCanvas doc={doc} page={Math.min(page, pages)} scale={scale} onSize={(pw, ph) => { if (pw !== pageSize.w || ph !== pageSize.h) setPageSize({ w: pw, h: ph }); }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: '1px solid var(--border-subtle)' }}>
        <button type="button" style={big} aria-label="Zoom out" onClick={() => setZoom(Math.max(0.2, +(scale - 0.2).toFixed(2)))}><Icon fa="minus" size={14} /></button>
        <span className="mono" style={{ fontSize: 15, minWidth: 56, textAlign: 'center' }} aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" style={big} aria-label="Zoom in" onClick={() => setZoom(Math.min(3, +(scale + 0.2).toFixed(2)))}><Icon fa="plus" size={14} /></button>
        <button type="button" onClick={() => setZoom(null)} style={{ ...big, width: 'auto', padding: '0 12px', color: 'var(--brand-primary)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>Fit</button>
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto', textAlign: 'right' }}>Pinch to zoom</span>
      </div>
    </div>
  );
}

/**
 * One PDF page fitted inside a fixed box, for the print packet. Rendered at print resolution;
 * `onReady` fires once the page is drawn (or can't be), so printing waits for it.
 */
export function PdfPageFit({ file, page, width, height, onReady }: { file: FileRef; page: number; width: number; height: number; onReady?: () => void }) {
  const { doc, error } = usePdf(file);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const reported = useRef(false);
  const ready = () => { if (!reported.current) { reported.current = true; onReady?.(); } };
  useEffect(() => { if (error) ready(); }, [error]);
  // Measure first, so the page is drawn once at its final scale.
  useEffect(() => {
    if (!doc) return;
    let live = true;
    doc.getPage(Math.min(page, doc.numPages)).then((p) => { const v = p.getViewport({ scale: 1 }); if (live) setSize({ w: v.width, h: v.height }); }, ready);
    return () => { live = false; };
  }, [doc, page]);
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff' }}>
      {error && <span style={{ fontSize: 14 }}>This PDF could not be opened. Print it from the sector page instead.</span>}
      {doc && size && <PageCanvas doc={doc} page={Math.min(page, doc.numPages)} scale={Math.min(width / size.w, height / size.h)} minDpr={2} onDone={ready} />}
    </div>
  );
}
