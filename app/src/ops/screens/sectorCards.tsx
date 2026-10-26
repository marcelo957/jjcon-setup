import { useRef, useState, type ReactNode } from 'react';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { slotState } from '../data/content';
import { customKind } from '../data/meta';
import { dateLabel, dayLabel, materialGroups, plansOf, sizeLabel } from '../data/selectors';
import type { CustomBlock, FileRef, MatRow, PlanKey, Sector, Step } from '../data/types';
import { opsStore } from '../data/store';
import { plural } from '../data/tasks';
import { discardPdf, storePdf, type FileWhere } from '../files/fileStore';
import { countPages } from '../files/pdf';
import { Modal, UploadChip } from '../ui/bits';
import { PdfThumb, PdfViewer, type PdfView } from '../ui/PdfViewer';

export interface CardProps {
  s: Sector;
  editing: boolean;
  /** Change the draft (edit mode only). */
  change: (fn: (d: Sector) => void) => void;
  ownerName: string;
  canCheck: boolean;
  meId: string;
  /** Deadline facts and who may mark it final, per task slot. */
  info: (slot: string) => SlotInfo;
  /** A person's name from their id. */
  pn: (id: string) => string;
}

export interface SlotInfo { due: string; late: boolean; lateDays: number; canFinal: boolean }

const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function Card({ id, children, title, aside }: { id?: string; children: ReactNode; title?: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="card card--pad" style={{ minWidth: 0, scrollMarginTop: 12 }} aria-label={typeof title === 'string' ? title : undefined}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <h2 className="card__title" style={{ margin: 0, fontWeight: 400 }}>{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ title, text, big, icon, action }: { title: string; text: string; big?: boolean; icon?: string; action?: ReactNode }) {
  return (
    <div className={`notice${big ? ' notice--big' : ''}`}>
      {icon && <Icon fa={icon} size={36} style={{ color: 'var(--border-divider)' }} />}
      <div className="notice__title">{title}</div>
      <div className="notice__text">{text}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/**
 * A written block's facts, in place of a status: what it holds and who last edited it, or that it
 * is empty and when it is due (red once late). Final shows who froze it, with Unlock; otherwise
 * the responsible person can Mark final. Nothing here is required.
 */
export function BlockStatus({ s, slot, info, pn, meId, editing }: { s: Sector; slot: string; info: CardProps['info']; pn: CardProps['pn']; meId: string; editing: boolean }) {
  const st = slotState(s, slot);
  if (!st) return null;
  const m = st.meta;
  const i = info(slot);
  return (
    <div className="block-status">
      {st.empty ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: i.late ? 'var(--feedback-danger-text)' : 'var(--text-secondary)', fontWeight: i.late ? 600 : 400 }}>
          <Icon fa={i.late ? 'triangle-exclamation' : 'circle'} outline={!i.late} size={12} />
          {i.late ? `Empty · was due ${dayLabel(i.due)}, ${plural(i.lateDays, 'day')} late` : `Empty · due ${dayLabel(i.due)}`}
        </span>
      ) : (
        <span>
          <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{st.summary}</strong>
          {m.edited ? ` · last edited by ${pn(m.edited.by)}, ${dateLabel(m.edited.at)}` : ' · no edits recorded yet'}
        </span>
      )}
      {m.final && <span className="final-tag"><Icon fa="lock" size={11} />Final · {pn(m.final.by)}, {dateLabel(m.final.at)}</span>}
      {!m.final && m.unlocked && <span className="muted">Unlocked by {pn(m.unlocked.by)}, {dateLabel(m.unlocked.at)}</span>}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
        {m.final && i.canFinal && <Button size="small" variant="neutral" outlined icon="lock-open" onClick={() => opsStore().unlockFinal(s.id, slot, meId)}>Unlock to edit</Button>}
        {!m.final && !st.empty && !editing && i.canFinal && (
          <span title="Locks this block so nobody can change it until someone unlocks it. Optional.">
            <Button size="small" variant="neutral" outlined icon="lock" onClick={() => opsStore().markFinal(s.id, slot, meId)}>Mark final</Button>
          </span>
        )}
      </span>
    </div>
  );
}

const Locked = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
    <Icon fa="lock" size={12} />Final. Unlock it to edit.
  </div>
);

const emptyText = (what: string, owner: string) => `Nothing written yet. ${owner === 'Unassigned' ? 'Nobody is responsible yet.' : `${owner} is responsible for the ${what}.`}`;

function CheckBox({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} className="checkbox-box" onClick={onClick} disabled={disabled}
      style={disabled ? { cursor: 'default' } : undefined}>
      <Icon fa="check" size={11} />
    </button>
  );
}

/* ---------- Floorplans ---------- */

export function FloorplanCard({ s, editing, change, ownerName, plan, setPlan, startEdit, canEdit, meId, info }: CardProps & {
  plan: PlanKey | null; setPlan: (k: PlanKey) => void; startEdit: () => void; canEdit: boolean;
}) {
  const plans = plansOf(s);
  const req = plans.filter((p) => p.required);
  const pick = plans.find((p) => p.key === plan && (p.required || editing)) ?? req[0] ?? (editing ? plans[0] : undefined);
  const unset = req.length === 0;
  const ready = req.filter((p) => p.done).length;
  const slot = pick ? s.plans[pick.key] : undefined;
  // The zoom someone picks holds while they switch between this sector's plans.
  const [view, setView] = useState<PdfView | null>(null);

  return (
    <Card id="block-plans" title="Floorplans" aside={<>
      <span className="muted" style={{ fontSize: 13 }}>{req.length ? `${ready} of ${req.length} required plans uploaded` : 'No plans chosen yet'}</span>
      {editing && <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>Pick the plans this sector requires. A plan is done once its PDF is uploaded.</span>}
    </>}>
      <div role="tablist" aria-label="Floorplans" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {plans.map((p) => {
          const on = pick?.key === p.key;
          const muted = !p.required;
          return (
            <div key={p.key} style={{
              flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', padding: '10px 12px',
              // A defined outline in every state, the top edge strongest. Border widths never change,
              // so the row stays aligned as the selection moves: the selected plan's heavier marker
              // is an inset band on top of its border (default + emphasis weights = 6 px), plus a
              // brand tint, more elevation and a bolder name, so it reads without relying on colour.
              border: `var(--ib-border-width-subtle) solid ${on ? 'var(--brand-primary)' : 'var(--border-default)'}`,
              borderTop: `var(--ib-border-width-default) solid ${on ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
              boxShadow: on ? 'inset 0 var(--ib-border-width-emphasis) 0 var(--brand-primary), var(--ib-elevation-2)' : undefined,
              borderRadius: 4,
              background: on ? 'color-mix(in srgb, var(--color-brand-ibjjf-primary-100) 45%, var(--color-neutral-white))' : muted ? 'var(--color-neutral-surface-100)' : 'var(--color-neutral-white)'
            }}>
              <button type="button" role="tab" aria-selected={on} disabled={muted && !editing} onClick={() => setPlan(p.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 0, background: 'transparent', padding: 0, cursor: muted && !editing ? 'default' : 'pointer', textAlign: 'left', opacity: muted && !editing ? 0.65 : 1 }}>
                <Icon fa={p.icon} size={12} style={{ color: 'var(--icon-tertiary)' }} />
                <span style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 15, fontWeight: on ? 700 : 500, letterSpacing: '.02em', color: on ? 'var(--brand-primary)' : muted ? 'var(--color-neutral-gray-300)' : 'var(--text-primary)' }}>{p.name}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: muted && !editing ? 0.65 : 1 }}>
                {!editing && (muted
                  ? <span className="chip--muted"><Icon fa={unset && !s.noFloorplans ? 'circle' : 'ban'} size={9} />{unset && !s.noFloorplans ? 'Not set' : 'Not applicable'}</span>
                  : <UploadChip done={p.done} late={!p.done && info(p.key).late} />)}
                {editing && (
                  <>
                    <button type="button" role="switch" aria-checked={p.required} aria-label={`${p.name} required`}
                      onClick={() => change((d) => { d.plans[p.key].required = !d.plans[p.key].required; if (d.plans[p.key].required) delete d.noFloorplans; })}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 10px', border: `1px solid ${p.required ? 'var(--brand-primary)' : 'var(--border-divider)'}`, borderRadius: 4, background: p.required ? 'var(--brand-primary)' : 'var(--color-neutral-white)', color: p.required ? '#fff' : 'var(--color-neutral-gray-300)', fontSize: 12, cursor: 'pointer' }}>
                      <Icon fa={p.required ? 'circle-check' : 'circle'} size={10} />{p.required ? 'Required' : 'Not required'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && req.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginBottom: 12 }}>
          <span className="overline overline--secondary">PDF files · one per required plan</span>
          {req.map((p) => (
            <UploadRow key={p.key} name={p.name} file={s.plans[p.key].file} prev={s.plans[p.key].prevUploadedAt} meId={meId} where={{ sectorId: s.id, slot: `plan:${p.key}` }}
              onFile={(f) => opsStore().setPlanFile(s.id, p.key, f)} onRemove={() => opsStore().removePlanFile(s.id, p.key)} />
          ))}
        </div>
      )}

      {unset && !editing && (
        <Notice big icon="vector-square" title={s.noFloorplans ? 'No floorplan required' : 'No plans chosen yet'}
          text={s.noFloorplans ? 'This sector is built from its instructions alone.' : 'Mark each plan above as required if this sector needs it. A required plan starts with no PDF attached and stays on the prep dashboard until one is uploaded.'}
          action={canEdit && !s.noFloorplans ? <Button size="small" variant="neutral" outlined icon="pen" onClick={startEdit}>Choose plans</Button> : undefined} />
      )}
      {pick && slot && pick.required && (slot.file ? (
        <PdfViewer file={slot.file} prevUploadedAt={slot.prevUploadedAt} view={view ?? undefined} onView={setView} />
      ) : !editing && (
        <Notice big icon="file-pdf" title={`No PDF uploaded · ${pick.name}`} text={`Owner ${ownerName} has to upload this plan before load-in.`}
          action={canEdit ? <Button size="small" variant="neutral" outlined icon="upload" onClick={startEdit}>Upload PDF</Button> : undefined} />
      ))}
    </Card>
  );
}

/**
 * One drop zone per required plan: drag a PDF in or pick one. The upload counts at once, before
 * Save: the plan is done. Replacing keeps it done; Remove PDF makes it outstanding again.
 */
export function UploadRow({ name, file, prev, onFile, onRemove, meId, where }: { name: string; file?: FileRef; prev?: string; onFile: (f: FileRef) => void; onRemove: () => void; meId: string; where: FileWhere }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const take = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      const stored = await storePdf(f, meId, countPages, where, file?.uploadedAt);
      onFile(stored);
      // The file it replaced: gone from Storage (or, for a demo drawing, marked removed). Best effort.
      if (file) void discardPdf(file, where).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
      <PdfThumb file={file} />
      <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 15, fontWeight: 500 }}>{name}</span>
        {busy && (
          <>
            <div role="progressbar" aria-label={`Uploading ${name}`} style={{ height: 8, borderRadius: 4, background: 'var(--color-neutral-surface-500)', overflow: 'hidden' }}>
              <div className="upload-bar" style={{ height: '100%', width: '40%', background: 'var(--brand-primary)' }} />
            </div>
            <span className="muted" style={{ fontSize: 13 }}>Uploading PDF</span>
          </>
        )}
        {!busy && file && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><Icon fa="file-pdf" size={14} style={{ color: 'var(--feedback-danger-text)' }} />{file.name}</span>
            <span className="mono muted" style={{ fontSize: 12 }}>{sizeLabel(file.size)} · {file.pages} page{file.pages > 1 ? 's' : ''} · uploaded {dateLabel(file.uploadedAt)}</span>
            <span className="muted" style={{ fontSize: 12 }}>{prev ? `Replaced the file uploaded ${dateLabel(prev)}` : 'First upload of this plan'}</span>
            <span><Button size="small" variant="danger" ghost icon="trash" aria-label={`Remove the ${name} PDF`} onClick={() => setConfirm(true)}>Remove PDF</Button></span>
          </>
        )}
        {!busy && !file && <span style={{ fontSize: 13, color: 'var(--feedback-danger-text)' }}>No PDF uploaded yet</span>}
        {error && <span role="alert" style={{ fontSize: 13, color: 'var(--feedback-danger-text)' }}>{error}</span>}
      </div>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void take(e.dataTransfer.files[0]); }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: 12, border: `2px dashed ${drag ? 'var(--brand-primary)' : 'var(--border-divider)'}`, borderRadius: 8, background: drag ? 'var(--color-neutral-surface-100)' : 'var(--color-neutral-white)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
        <Icon fa="cloud-arrow-up" size={20} style={{ color: 'var(--brand-primary)' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>Drop a PDF here or click to choose a file</span>
          <span className="muted" style={{ display: 'block', fontSize: 12 }}>PDF only. Uploading replaces the current file for this plan.</span>
        </span>
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden aria-label={`Upload PDF for ${name}`}
        onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      {confirm && file && (
        <Modal title={`Remove the ${name} PDF?`} icon="trash" iconColor="var(--feedback-danger-text)" onClose={() => setConfirm(false)} width={520}
          footer={<>
            <Button ghost onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" icon="trash" busy={busy} onClick={async () => {
              setError(null);
              setBusy(true);
              try { await discardPdf(file, where); onRemove(); setConfirm(false); }
              catch (e) { setError(e instanceof Error ? e.message : 'The file could not be removed.'); setConfirm(false); }
              finally { setBusy(false); }
            }}>Remove PDF</Button>
          </>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '22px' }}>
            {file.name} comes off this sector. {name} goes back to not done on the dashboard, in Tasks and on the Team page, and stays outstanding until a new PDF is uploaded.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Material list ---------- */

export function MaterialCard({ s, editing, change, ownerName, canCheck, toggleRow, info, pn, meId }: CardProps & { toggleRow: (block: string, rowId: string) => void }) {
  const groups = materialGroups(s);
  const rows = groups.flatMap((g) => g.rows);
  const done = rows.filter((r) => r.checked).length;
  return (
    <Card id="material">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 className="card__title" style={{ margin: 0, fontWeight: 400, flex: 1 }}>Material list</h2>
        {rows.length > 0 && <>
          <span className="mono" style={{ fontSize: 18 }}>{done}</span>
          <span className="mono muted" style={{ fontSize: 13 }}>/ {rows.length} confirmed on site</span>
        </>}
      </div>
      {rows.length > 0 && (
        <div role="progressbar" aria-label="Material confirmed" aria-valuenow={done} aria-valuemax={rows.length} style={{ height: 8, borderRadius: 4, background: 'var(--color-neutral-surface-500)', margin: '10px 0 14px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(done / rows.length * 100)}%`, background: done === rows.length ? 'var(--feedback-success-text)' : 'var(--brand-primary)' }} />
        </div>
      )}
      {groups.map((g) => {
        const locked = !!s.blocks[g.key].final;
        return (
          <div key={g.key} style={{ marginBottom: 14 }}>
            <div className="overline" style={{ paddingBottom: 4, borderBottom: '2px solid var(--border-divider)' }}>{g.name}</div>
            <BlockStatus s={s} slot={g.key} info={info} pn={pn} meId={meId} editing={editing} />
            {editing && !locked
              ? <RowsEditor rows={g.rows} onChange={(fn) => change((d) => { fn(d.blocks[g.key].rows); })} />
              : <>
                  {editing && locked && <Locked />}
                  {g.rows.length ? <MatTable rows={g.rows} canCheck={canCheck} toggle={(id) => toggleRow(g.key, id)} />
                    : <div className="muted" style={{ fontSize: 13, padding: '8px 6px' }}>{emptyText('material list', ownerName)}</div>}
                </>}
          </div>
        );
      })}
      <div className="muted" style={{ fontSize: 12 }}>Check items off here or on the phone. Both views share one list.</div>
    </Card>
  );
}

function MatTable({ rows, canCheck, toggle }: { rows: MatRow[]; canCheck: boolean; toggle: (id: string) => void }) {
  if (!rows.length) return <div className="muted" style={{ fontSize: 13, padding: '10px 6px' }}>No rows yet.</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td style={{ padding: '8px 6px', width: 30, verticalAlign: 'top' }}><CheckBox on={r.checked} label={`Confirm ${r.item}`} onClick={() => toggle(r.id)} disabled={!canCheck} /></td>
            <td style={{ padding: '8px 6px', fontSize: 14, verticalAlign: 'top' }}>{r.item}{r.note && <span className="muted" style={{ display: 'block', fontSize: 12 }}>{r.note}</span>}</td>
            <td className="mono" style={{ padding: '8px 6px', width: 56, textAlign: 'right', fontSize: 15, verticalAlign: 'top' }}>{r.qty}</td>
            <td style={{ padding: '8px 6px', width: 92, textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
              <span style={{ font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: r.checked ? 'var(--feedback-success-text)' : 'var(--color-neutral-surface-500)', color: r.checked ? '#fff' : 'var(--text-secondary)' }}>
                <Icon fa={r.checked ? 'circle-check' : 'circle'} size={9} />{r.checked ? 'In place' : 'Pending'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RowsEditor({ rows, onChange, itemLabel = 'Item' }: { rows: MatRow[]; onChange: (fn: (rows: MatRow[]) => void) => void; itemLabel?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input input--sm" style={{ flex: '2 1 220px' }} aria-label={`${itemLabel} ${i + 1}`} value={r.item} placeholder={itemLabel}
            onChange={(e) => onChange((l) => { l[i].item = e.target.value; })} />
          <input className="input input--sm input--mono" style={{ flex: '0 0 72px', textAlign: 'right' }} aria-label={`Quantity ${i + 1}`} type="number" min={0} value={r.qty}
            onChange={(e) => onChange((l) => { l[i].qty = Math.max(0, Number(e.target.value) || 0); })} />
          <input className="input input--sm" style={{ flex: '2 1 200px' }} aria-label={`Note ${i + 1}`} value={r.note ?? ''} placeholder="Note (optional)"
            onChange={(e) => onChange((l) => { l[i].note = e.target.value || undefined; })} />
          <button type="button" className="icon-btn icon-btn--danger" aria-label={`Remove ${r.item || `row ${i + 1}`}`} onClick={() => onChange((l) => { l.splice(i, 1); })}><Icon fa="trash" size={14} /></button>
        </div>
      ))}
      <div><Button size="small" variant="neutral" outlined icon="plus" onClick={() => onChange((l) => { l.push({ id: newId('m'), item: '', qty: 1, checked: false }); })}>Add row</Button></div>
    </div>
  );
}

/* ---------- Steps ---------- */

export function StepsCard({ s, block, title, editing, change, ownerName, canCheck, toggleStep, info, pn, meId }: CardProps & {
  block: 'instr' | 'install'; title: string; toggleStep: (block: 'instr' | 'install', id: string) => void;
}) {
  const b = s.blocks[block];
  const locked = !!b.final;
  return (
    <Card id={block === 'instr' ? 'steps' : 'install'} title={title}>
      <BlockStatus s={s} slot={block} info={info} pn={pn} meId={meId} editing={editing} />
      {editing && !locked ? (
        <StepsEditor steps={b.steps} onChange={(fn) => change((d) => { fn(d.blocks[block].steps); })} />
      ) : !b.steps.length ? (
        <Notice title={`No ${title.toLowerCase()} yet`} text={emptyText(title.toLowerCase(), ownerName)} />
      ) : (
        <>
          {editing && locked && <Locked />}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {b.steps.map((st, i) => (
              <button key={st.id} type="button" role="checkbox" aria-checked={st.done} disabled={!canCheck} onClick={() => toggleStep(block, st.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left', padding: '10px 6px', border: 0, borderBottom: '1px solid var(--border-subtle)', background: 'transparent', cursor: canCheck ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: '22px', color: st.done ? 'var(--color-neutral-gray-300)' : 'var(--text-primary)' }}>
                <span className="mono" style={{ flex: '0 0 26px', height: 26, borderRadius: 999, background: st.done ? 'var(--feedback-success-text)' : 'var(--brand-primary)', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{st.text}</span>
                <span className="checkbox-box" aria-hidden="true" data-on={st.done} style={st.done ? { borderColor: 'var(--feedback-success-text)', background: 'var(--feedback-success-text)', color: '#fff' } : undefined}><Icon fa="check" size={11} /></span>
              </button>
            ))}
          </div>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13 }}><Icon fa="headset" size={14} />Set up desk · Room 112 · radio channel 3</div>
        </>
      )}
    </Card>
  );
}

function StepsEditor({ steps, onChange }: { steps: Step[]; onChange: (fn: (l: Step[]) => void) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((st, i) => (
        <div key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span className="mono" style={{ flex: '0 0 26px', height: 26, marginTop: 4, borderRadius: 999, background: 'var(--brand-primary)', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          <textarea className="input" rows={2} style={{ flex: 1, padding: '8px 12px', resize: 'vertical' }} aria-label={`Step ${i + 1}`} value={st.text}
            onChange={(e) => onChange((l) => { l[i].text = e.target.value; })} />
          <button type="button" className="icon-btn" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => onChange((l) => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; })}><Icon fa="arrow-up" size={14} /></button>
          <button type="button" className="icon-btn icon-btn--danger" aria-label={`Remove step ${i + 1}`} onClick={() => onChange((l) => { l.splice(i, 1); })}><Icon fa="trash" size={14} /></button>
        </div>
      ))}
      <div><Button size="small" variant="neutral" outlined icon="plus" onClick={() => onChange((l) => { l.push({ id: newId('s'), text: '', done: false }); })}>Add step</Button></div>
    </div>
  );
}

/* ---------- Information and link ---------- */

export function InfoCard({ s, editing, change, ownerName, info, pn, meId }: CardProps) {
  const rows = s.blocks.info.rows;
  const locked = !!s.blocks.info.final;
  return (
    <Card id="block-info" title="Information">
      <BlockStatus s={s} slot="info" info={info} pn={pn} meId={meId} editing={editing} />
      {editing && !locked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', gap: 8 }}>
              <input className="input input--sm" style={{ flex: '0 0 180px' }} aria-label={`Label ${i + 1}`} value={r.label} onChange={(e) => change((d) => { d.blocks.info.rows[i].label = e.target.value; })} />
              <input className="input input--sm" style={{ flex: 1 }} aria-label={`Value ${i + 1}`} value={r.value} onChange={(e) => change((d) => { d.blocks.info.rows[i].value = e.target.value; })} />
              <button type="button" className="icon-btn icon-btn--danger" aria-label={`Remove ${r.label || `row ${i + 1}`}`} onClick={() => change((d) => { d.blocks.info.rows.splice(i, 1); })}><Icon fa="trash" size={14} /></button>
            </div>
          ))}
          <div><Button size="small" variant="neutral" outlined icon="plus" onClick={() => change((d) => { d.blocks.info.rows.push({ id: newId('i'), label: '', value: '' }); })}>Add row</Button></div>
        </div>
      ) : rows.length ? (
        <>
          {editing && locked && <Locked />}
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 14 }}>
              <span className="muted" style={{ flex: '0 0 110px' }}>{r.label}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{r.value}</span>
            </div>
          ))}
        </>
      ) : (
        <Notice title="No information yet" text={emptyText('information', ownerName)} />
      )}
    </Card>
  );
}

function LinkOut({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '12px 14px', border: '1px solid var(--border-divider)', borderRadius: 8, fontSize: 15 }}>
      <Icon fa="table-list" size={14} style={{ color: 'var(--feedback-success-text)' }} /><span style={{ flex: 1 }}>{label}</span><Icon fa="arrow-up-right-from-square" size={12} />
    </a>
  );
}

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

export function LinkCard({ s, editing, change, info, pn, meId }: CardProps) {
  const l = s.blocks.link;
  return (
    <Card id="block-link" title="External link">
      <BlockStatus s={s} slot="link" info={info} pn={pn} meId={meId} editing={editing} />
      <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--text-secondary)' }}>This block points at a document held outside JJCON SetUp. It is the record of what happened, and it is not printed in the packet.</div>
      {editing && !l.final ? <LinkFields label={l.label} url={l.url} set={(label, url) => change((d) => { d.blocks.link.label = label; d.blocks.link.url = url; })} />
        : safeUrl(l.url) ? <LinkOut url={safeUrl(l.url)} label={l.label || l.url} />
        : <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>No link set yet.</div>}
    </Card>
  );
}

function LinkFields({ label, url, set }: { label: string; url: string; set: (label: string, url: string) => void }) {
  const bad = url !== '' && !safeUrl(url);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 12 }}>
      <label><span className="field-label">Link label</span><input className="input" value={label} onChange={(e) => set(e.target.value, url)} /></label>
      <label><span className="field-label">URL</span><input className="input" type="url" value={url} placeholder="https://" aria-invalid={bad || undefined} onChange={(e) => set(label, e.target.value)} />
        {bad && <span style={{ display: 'block', fontSize: 12, marginTop: 4, color: 'var(--feedback-danger-text)' }}>Use a full web address starting with https://</span>}</label>
    </div>
  );
}

/* ---------- Custom blocks ---------- */

export function CustomCard({ s, c, editing: editMode, change, ownerName, canCheck, toggleRow, meId, info, pn }: CardProps & { c: CustomBlock; toggleRow: (block: string, rowId: string) => void }) {
  const kd = customKind(c.kind);
  const edit = (fn: (b: CustomBlock) => void) => change((d) => { const b = d.custom.find((x) => x.id === c.id); if (b) fn(b); });
  // A block marked final shows its content read-only, even in edit mode, until someone unlocks it.
  const editing = editMode && !c.final;
  return (
    <Card id={`block-${c.id}`} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><Icon fa={kd.icon} size={14} style={{ color: 'var(--icon-tertiary)' }} />{c.name}</span>}
      aside={<>
        <span className="muted" style={{ fontSize: 12 }}>{kd.label}</span>
        {c.kind === 'pdf' && <UploadChip done={!!c.file} late={!c.file && info(c.id).late} />}
      </>}>
      {c.kind !== 'pdf' && <BlockStatus s={s} slot={c.id} info={info} pn={pn} meId={meId} editing={editMode} />}
      {editMode && c.final && <Locked />}
      {c.kind === 'checklist' && (editing
        ? <RowsEditor rows={c.rows ?? []} onChange={(fn) => edit((b) => { b.rows = b.rows ?? []; fn(b.rows); })} />
        : c.rows?.length
          ? <>
              <MatTable rows={c.rows} canCheck={canCheck} toggle={(id) => toggleRow(c.id, id)} />
              {c.foot && <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}><Icon fa="circle-info" size={14} /><span>{c.foot}</span></div>}
            </>
          : <Blank icon={kd.icon} text="No rows yet. Add the first item and its quantity." />)}
      {c.kind === 'text' && (editing
        ? <StepsEditor steps={c.steps ?? []} onChange={(fn) => edit((b) => { b.steps = b.steps ?? []; fn(b.steps); })} />
        : c.steps?.length
          ? <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 15, lineHeight: '23px' }}>{c.steps.map((t) => <li key={t.id}>{t.text}</li>)}</ol>
          : <Blank icon={kd.icon} text="No steps yet. Write the first step." />)}
      {c.kind === 'gallery' && (
        c.shots?.length || editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {(c.shots ?? []).map((sh, i) => (
              <div key={sh.id}>
                <div role="img" aria-label={`${sh.title} (no photo uploaded yet)`} style={{ height: 180, borderRadius: 6, background: 'var(--color-neutral-surface-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-divider)' }}><Icon fa="image" size={36} /></div>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                    <input className="input input--sm" aria-label={`Photo ${i + 1} title`} value={sh.title} onChange={(e) => edit((b) => { b.shots![i].title = e.target.value; })} />
                    <input className="input input--sm" aria-label={`Photo ${i + 1} caption`} value={sh.caption} onChange={(e) => edit((b) => { b.shots![i].caption = e.target.value; })} />
                    <Button size="small" ghost icon="trash" onClick={() => edit((b) => { b.shots!.splice(i, 1); })}>Remove</Button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, marginTop: 6 }}>{sh.title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{sh.caption}</div>
                  </>
                )}
              </div>
            ))}
            {editing && <div style={{ alignSelf: 'center' }}><Button size="small" variant="neutral" outlined icon="plus" onClick={() => edit((b) => { b.shots = [...(b.shots ?? []), { id: newId('g'), title: '', caption: '' }]; })}>Add photo entry</Button></div>}
          </div>
        ) : <Blank icon={kd.icon} text="No photos yet. Add the first reference image in edit mode." />
      )}
      {c.kind === 'link' && (editing
        ? <LinkFields label={c.label ?? ''} url={c.url ?? ''} set={(label, url) => edit((b) => { b.label = label; b.url = url; })} />
        : safeUrl(c.url ?? '') ? <LinkOut url={safeUrl(c.url!)} label={c.label || c.url!} /> : <Blank icon={kd.icon} text="No link set yet." />)}
      {c.kind === 'pdf' && (
        <>
          {editMode && <UploadRow name={c.name} file={c.file} meId={meId} where={{ sectorId: s.id, slot: c.id }} onFile={(f) => opsStore().setCustomFile(s.id, c.id, f)} onRemove={() => opsStore().removeCustomFile(s.id, c.id)} />}
          {!editMode && c.file && <PdfViewer file={c.file} />}
          {!editMode && !c.file && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, border: '1px solid var(--border-subtle)', borderLeft: '6px solid var(--feedback-warning-accent)', borderRadius: 8, background: 'var(--color-neutral-surface-50)' }}>
              <Icon fa="file-circle-exclamation" size={24} style={{ color: 'var(--feedback-warning-accent)' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: "'Roboto Condensed', sans-serif", fontSize: 17 }}>No PDF uploaded · {c.name}</span>
                <span style={{ display: 'block', fontSize: 14, lineHeight: '21px', color: 'var(--text-secondary)', marginTop: 2 }}>{ownerName} has to upload this sheet before load-in.</span>
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Blank({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, border: '1px dashed var(--border-divider)', borderRadius: 8, background: 'var(--color-neutral-surface-50)', fontSize: 14 }}>
      <Icon fa={icon} size={14} style={{ color: 'var(--border-divider)' }} /><span>{text}</span>
    </div>
  );
}
