import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EVENT_NAME, HELP_DESK, VENUE } from '../../config';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { BUILD, groupName } from '../data/meta';
import { packetPages, type PacketPage } from '../data/packet';
import { activeSectors, dateLabel, packetState, personName, sizeLabel, windowLabel } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import type { OpsData, Sector } from '../data/types';
import { Modal, PageHead } from '../ui/bits';
import { PdfPageFit } from '../ui/PdfViewer';

const PAGE_W = 816;
const PAGE_H = 1056;
const MAX_PREVIEW = 0.78;
/** Longest wait for PDF sheets to draw before printing anyway. */
export const PRINT_WAIT_MS = 10_000;

const venueShort = VENUE.split(', ').pop();
const version = (s: Sector) => (s.contentChangedAt ? dateLabel(s.contentChangedAt) : '1');

/**
 * Print packets: pick sectors, preview each packet as Letter pages, and print the batch in
 * black and white. One packet per sector: floorplans, material list and instructions.
 */
export function PrintPage() {
  const data = useOps();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const active = activeSectors(data);
  const ids = new Set(active.map((s) => s.id));
  const sel = (params.get('sel') ?? '').split(',').filter((id) => ids.has(id));
  const previewId = params.get('sector');
  // A sector opened for preview from elsewhere joins the batch.
  const selected = new Set(previewId && ids.has(previewId) && !params.has('sel') ? [...sel, previewId] : sel);
  const preview = active.find((s) => s.id === previewId) ?? active.find((s) => selected.has(s.id)) ?? active[0];
  const chosen = active.filter((s) => selected.has(s.id));
  const owner = (s: Sector) => personName(data.people, s.ownerId);
  const pageCount = chosen.reduce((n, s) => n + packetPages(s, owner(s)).length, 0);

  const write = (next: Set<string>, sector = preview?.id) => setParams((p) => {
    p.set('sel', active.filter((s) => next.has(s.id)).map((s) => s.id).join(','));
    if (sector) p.set('sector', sector);
    return p;
  }, { replace: true });
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); write(n); };
  const allOn = chosen.length === active.length;

  const [printing, setPrinting] = useState(false);
  const [ask, setAsk] = useState<string[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  return (
    <div>
      <PageHead overline="Office · batch output" title="Print packets"
        lead="Black and white, one packet per sector: floorplan, material list and instructions. Posted at the sector or carried by a lead with no phone."
        actions={<>
          <Button variant="neutral" outlined icon="arrow-left" onClick={() => navigate('/prep')}>Dashboard</Button>
          <Button icon="print" disabled={!chosen.length || printing} onClick={() => { setBanner(null); setPrinting(true); }}>
            {printing && !ask ? 'Preparing…' : `Print ${chosen.length} packet${chosen.length === 1 ? '' : 's'}`}
          </Button>
        </>} />

      {banner && (
        <div role="status" className="print-banner"><Icon fa="circle-check" size={14} style={{ color: 'var(--feedback-success-text)' }} />{banner}
          <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Dismiss" onClick={() => setBanner(null)}><Icon fa="xmark" size={12} /></button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <section className="card print-batch" aria-label="Batch">
          <div className="overline overline--secondary" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Batch</div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {active.map((s) => {
              const st = packetState(s);
              return (
                <div key={s.id} className="print-batch__row" data-preview={s.id === preview?.id || undefined}>
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Include ${s.name}`} />
                  <button type="button" onClick={() => write(selected, s.id)} aria-label={`Preview ${s.name}`} aria-current={s.id === preview?.id || undefined}>
                    <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className="mono muted" style={{ display: 'block', fontSize: 11 }}>{groupName(s.group)} · {personName(data.people, s.leadId)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 2, color: st === 'stale' ? 'var(--feedback-danger-text)' : 'var(--color-neutral-gray-300)' }}>
                      <Icon fa={st === 'stale' ? 'triangle-exclamation' : st === 'current' ? 'circle-check' : 'circle'} size={9} />
                      {st === 'none' ? 'Not printed yet' : st === 'current' ? `Printed ${dateLabel(s.packetPrintedAt!)}` : 'Changed since printed'}
                    </span>
                  </button>
                  {s.id === preview?.id && <Icon fa="eye" size={12} style={{ color: 'var(--brand-primary)' }} label="Previewing" />}
                </div>
              );
            })}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{chosen.length} sector{chosen.length === 1 ? '' : 's'} · {pageCount} page{pageCount === 1 ? '' : 's'}</span>
            <Button size="small" variant="neutral" ghost onClick={() => write(allOn ? new Set() : new Set(ids))}>{allOn ? 'Clear selection' : 'Select all sectors'}</Button>
          </div>
        </section>

        {preview && <Preview s={preview} data={data} />}
      </div>

      {printing && <PrintRun sectors={chosen} data={data} onDone={() => setAsk(chosen.map((s) => s.id))} />}

      {ask && (
        <Modal title="Did the packets print?" icon="print" iconColor="var(--brand-primary)" onClose={() => { setAsk(null); setPrinting(false); }}
          footer={<>
            <Button ghost onClick={() => { setAsk(null); setPrinting(false); }}>Not printed</Button>
            <Button icon="circle-check" onClick={() => {
              opsStore().markPrinted(ask);
              setBanner(`${ask.length} packet${ask.length === 1 ? '' : 's'} marked as printed. Each sector page shows its packet as current until the content changes.`);
              setAsk(null);
              setPrinting(false);
            }}>Mark as printed</Button>
          </>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '22px' }}>
            Mark {ask.length === 1 ? 'this packet' : `these ${ask.length} packets`} as printed today so the sector page can tell when a copy on the floor goes out of date.
          </p>
        </Modal>
      )}
    </div>
  );
}

function Preview({ s, data }: { s: Sector; data: OpsData }) {
  const pages = packetPages(s, personName(data.people, s.ownerId));
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = w ? Math.min(MAX_PREVIEW, w / PAGE_W) : MAX_PREVIEW;
  return (
    <section ref={ref} style={{ flex: '1 1 320px', minWidth: 0 }} aria-label={`Preview of ${s.name}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 16, color: 'var(--text-secondary)' }}>Preview · {s.name}</span>
        <span className="mono muted" style={{ fontSize: 13 }}>Letter · {pages.length} page{pages.length === 1 ? '' : 's'} · grayscale</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
        {pages.map((p, i) => (
          <div key={i} className="print-thumb" style={{ width: Math.round(PAGE_W * scale), height: Math.round(PAGE_H * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <Sheet s={s} data={data} page={p} n={i + 1} total={pages.length} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Lays every chosen packet out at full size in a print-only layer, waits for the PDF sheets
 * to draw, opens the browser's print dialog, then hands back.
 */
function PrintRun({ sectors, data, onDone }: { sectors: Sector[]; data: OpsData; onDone: () => void }) {
  const all = sectors.map((s) => ({ s, pages: packetPages(s, personName(data.people, s.ownerId)) }));
  const need = all.reduce((n, x) => n + x.pages.filter((p) => p.kind === 'plan' && p.file).length, 0);
  const [drawn, setDrawn] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const done = useRef(false);
  useEffect(() => { const t = setTimeout(() => setTimedOut(true), PRINT_WAIT_MS); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (done.current || (drawn < need && !timedOut)) return;
    done.current = true;
    // Let the last canvases paint before the dialog snapshots the page.
    const t = setTimeout(() => { window.print(); onDone(); }, 50);
    return () => clearTimeout(t);
  }, [drawn, need, timedOut]);
  return createPortal(
    <div className="print-root" aria-hidden="true">
      {all.map(({ s, pages }) => pages.map((p, i) => (
        <div key={`${s.id}-${i}`} className="print-page">
          <Sheet s={s} data={data} page={p} n={i + 1} total={pages.length} onReady={() => setDrawn((d) => d + 1)} />
        </div>
      )))}
    </div>,
    document.body
  );
}

const ink = '#000';
const rule = `1px solid ${ink}`;
const overline = { font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase' } as const;

/** One Letter page of a packet, at 96 dpi. Black on white only, so it copies cleanly. */
function Sheet({ s, data, page, n, total, onReady }: { s: Sector; data: OpsData; page: PacketPage; n: number; total: number; onReady?: () => void }) {
  const b = BUILD[s.build];
  return (
    <div className="packet-sheet" style={{ width: PAGE_W, height: PAGE_H, background: '#fff', color: ink, padding: '56px 56px 48px', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, borderBottom: `3px solid ${ink}`, paddingBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={overline}>{EVENT_NAME} · {venueShort} · Setup packet</div>
          <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 38, lineHeight: '44px', fontWeight: 700 }}>{s.name}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 14, lineHeight: '20px' }}>
          <div className="mono">v{version(s)}</div>
          <div>Lead: <strong>{personName(data.people, s.leadId)}</strong></div>
          <div className="mono">Page {n} of {total}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '8px 0 14px', borderBottom: rule, fontSize: 14 }}>
        <span>Category: <strong>{groupName(s.group)}</strong></span>
        <span>Window: <strong className="mono">{windowLabel(s)}</strong></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Build status: <Icon fa={b.icon} size={14} /><strong>{b.label}</strong></span>
        <span style={{ marginLeft: 'auto' }}>Sheet: <strong>{page.sheet}</strong></span>
      </div>

      <div style={{ paddingTop: 16, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {page.kind === 'plan' && (page.file ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 16 }}>{page.sheet}{page.pages > 1 ? ` · page ${page.page} of ${page.pages}` : ''}</span>
              <span className="mono" style={{ fontSize: 13, marginLeft: 'auto' }}>{page.file.name} · {sizeLabel(page.file.size)} · uploaded {dateLabel(page.file.uploadedAt)}</span>
            </div>
            <div style={{ border: `2px solid ${ink}`, alignSelf: 'flex-start' }}>
              <PdfPageFit file={page.file} page={page.page} width={700} height={640} onReady={onReady} />
            </div>
            <div style={{ marginTop: 'auto', borderTop: rule, paddingTop: 10, fontSize: 14, lineHeight: '20px' }}>Printed from the uploaded PDF. One sheet per plan — request a missing sheet at the set up desk, {HELP_DESK.room}.</div>
          </>
        ) : (
          <Blocked title={page.notice!.title} text={page.notice!.text} then={`Do not build this sector from memory. Request the plan at the set up desk, ${HELP_DESK.room}.`} />
        ))}

        {page.kind === 'rows' && (
          <>
            {page.notice ? (
              <Blocked title={page.notice.title} text={page.notice.text} then="Record what arrives on the blank lines below and hand this sheet to the set up desk." lines />
            ) : (
              <>
                <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 16, marginBottom: 10 }}>{page.title}</div>
                {page.notFinal && <NotFinal />}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th(34)}>OK</th>
                      <th style={th()}>{page.qty ? 'Item' : 'Photo · what to match'}</th>
                      {page.qty && <th style={{ ...th(74), textAlign: 'right' }}>Qty sent</th>}
                      {page.qty && <th style={th(110)}>Qty received</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((r, i) => r.group ? (
                      <tr key={i}><td colSpan={page.qty ? 4 : 2} style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 15, fontWeight: 700, borderBottom: `1.5px solid ${ink}`, padding: '12px 8px 4px' }}>{r.item}</td></tr>
                    ) : (
                      <tr key={i}>
                        <td style={td}><span style={{ display: 'block', width: 17, height: 17, border: `1.5px solid ${ink}` }} /></td>
                        <td style={{ ...td, fontSize: 15 }}>{r.item}{r.note && <span style={{ display: 'block', fontSize: 13 }}>{r.note}</span>}</td>
                        {page.qty && <td className="mono" style={{ ...td, textAlign: 'right', fontSize: 15 }}>{r.qty}</td>}
                        {page.qty && <td style={td} />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {page.sign && <SignLine />}
            {page.continues && <div style={{ ...overline, marginTop: 'auto', paddingTop: 20, borderTop: rule }}>List continues on the next page.{page.sheet === 'Material list' ? ' Sign on the last material page.' : ''}</div>}
          </>
        )}

        {page.kind === 'steps' && (
          <>
            {page.notice ? (
              <Blocked title={page.notice.title} text={page.notice.text} then={`Take the brief in person at the set up desk, ${HELP_DESK.room}, before the window opens.`} />
            ) : (
              <>
                <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 16, marginBottom: 10 }}>{page.title}</div>
                {page.notFinal && <NotFinal />}
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {page.steps.map((st) => (
                    <li key={st.n} style={{ display: 'flex', gap: 14, borderBottom: rule, paddingBottom: 12 }}>
                      <span className="mono" style={{ fontSize: 17, flex: '0 0 28px' }}>{st.n}.</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '23px' }}>{st.text}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {page.last && (
              <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, border: `2px solid ${ink}`, padding: '12px 14px' }}>
                  <div style={{ ...overline, marginBottom: 4 }}>Need help</div>
                  <div style={{ fontSize: 16, lineHeight: '23px' }}>{HELP_DESK.where}<br /><span className="mono">{HELP_DESK.phone}</span> · {HELP_DESK.contact}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ borderBottom: `1.5px solid ${ink}`, height: 40 }} />
                  <div style={{ ...overline, paddingTop: 4 }}>Build complete · lead signature</div>
                </div>
              </div>
            )}
          </>
        )}

        {page.kind === 'empty' && <Blocked title="This sector has no printable blocks yet" text="Add a floorplan, a material list or instructions on the sector page, then print again." />}
      </div>

      <div style={{ ...overline, borderTop: rule, marginTop: 14, paddingTop: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>{s.name} · packet v{version(s)}</span>
        <span>Printed from JJCON SetUp · discard superseded copies</span>
      </div>
    </div>
  );
}

const th = (width?: number) => ({ textAlign: 'left', borderBottom: `2px solid ${ink}`, padding: '6px 8px', width, font: 'var(--ib-text-subtitle-2)' } as const);
const td = { borderBottom: rule, padding: '7px 8px', verticalAlign: 'top' } as const;

function Blocked({ title, text, then, lines }: { title: string; text: string; then?: string; lines?: boolean }) {
  return (
    <div style={{ border: `3px solid ${ink}`, padding: 24, marginTop: 20 }}>
      <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 26 }}>{title}</div>
      <div style={{ fontSize: 16, lineHeight: '24px', marginTop: 8 }}>{text}</div>
      {then && <div style={{ fontSize: 16, lineHeight: '24px', marginTop: 12, borderTop: rule, paddingTop: 10 }}>{then}</div>}
      {lines && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 22 }}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ borderBottom: rule, height: 1 }} />)}
        </div>
      )}
    </div>
  );
}

/** Printed on content nobody has marked final: the crew knows the sheet may still change. */
function NotFinal() {
  return (
    <div style={{ border: `1.5px dashed ${ink}`, padding: '6px 10px', marginBottom: 12, fontSize: 14 }}>
      <strong>Not final</strong> — this may still change. Check JJCON SetUp for the current version before you build.
    </div>
  );
}

function SignLine() {
  const cell = (label: string, flex: string) => (
    <div style={{ flex }}>
      <div style={{ borderBottom: `1.5px solid ${ink}`, height: 34 }} />
      <div style={{ ...overline, paddingTop: 4 }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 32, marginTop: 'auto', paddingTop: 28 }}>
      {cell('Received by · print name', '1')}
      {cell('Signature', '1')}
      {cell('Date · time', '0 0 140px')}
    </div>
  );
}
