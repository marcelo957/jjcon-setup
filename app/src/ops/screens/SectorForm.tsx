import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { Select } from '../../ds/Select';
import { BUILD_DAYS } from '../../config';
import { useMe } from '../access';
import { BLOCK_DEFAULTS, BLOCK_DEFS, blockLabel, CUSTOM_KINDS, customKind, GROUPS, groupName, PLAN_KINDS } from '../data/meta';
import { blockContent, customContent, dayLabel, planContent } from '../data/selectors';
import { newStructure, opsStore, structureOf, useOps, type SectorStructure } from '../data/store';
import type { BlockKey, CustomBlock, CustomKind, PlanKey, Sector } from '../data/types';
import { KeptCallout, Modal, PageHead } from '../ui/bits';
import { PersonPicker } from '../ui/PersonPicker';

type Dialog =
  | { kind: 'off'; label: string; detail: string; apply: () => void }
  | { kind: 'rm'; id: string; label: string; detail: string }
  | { kind: 'add' };

export function SectorForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const data = useOps();
  const me = useMe();
  const saved = mode === 'edit' ? data.sectors.find((s) => s.id === id) : undefined;
  if (!me.canManageSectors) return <Navigate to={saved ? `/sectors/${saved.id}` : '/sectors'} replace />;
  if (mode === 'edit' && !saved) return <Navigate to="/sectors" replace />;
  return <FormBody key={saved?.id ?? 'new'} saved={saved} people={data.people} />;
}

function FormBody({ saved, people }: { saved?: Sector; people: ReturnType<typeof useOps>['people'] }) {
  const navigate = useNavigate();
  const edit = !!saved;
  const [f, setF] = useState<SectorStructure>(() => (saved ? structureOf(saved) : newStructure('ibjjf', BLOCK_DEFAULTS.ibjjf)));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const set = (patch: Partial<SectorStructure>) => setF((v) => ({ ...v, ...patch }));
  const savedIds = new Set(saved?.custom.map((c) => c.id));
  const addPerson = (name: string) => opsStore().addPerson(name);

  const timeBad = f.to <= f.from;
  const canSave = !!f.name.trim() && !timeBad;

  const save = () => {
    if (!canSave) return;
    const sid = saved ? (opsStore().saveStructure(saved.id, f), saved.id) : opsStore().createSector(f);
    navigate(`/sectors/${sid}`);
  };

  const togglePlan = (k: PlanKey) => {
    const flip = () => setF((v) => ({ ...v, plans: { ...v.plans, [k]: !v.plans[k] } }));
    const held = saved && f.plans[k] ? planContent(saved, k) : null;
    if (held) setDialog({ kind: 'off', label: PLAN_KINDS.find((p) => p.key === k)!.name, detail: held, apply: flip });
    else flip();
  };
  const toggleBlock = (k: BlockKey) => {
    const flip = () => setF((v) => ({ ...v, blocks: { ...v.blocks, [k]: !v.blocks[k] } }));
    const held = saved && f.blocks[k] ? blockContent(saved, k) : null;
    if (held) setDialog({ kind: 'off', label: blockLabel(k), detail: held, apply: flip });
    else flip();
  };
  const setGroup = (g: SectorStructure['group']) => {
    // On a new sector the group preselects its blocks. On an existing one it only moves the listing,
    // so switching group never hides content.
    if (edit) set({ group: g });
    else setF((v) => ({ ...v, group: g, blocks: { ...newStructure(g, BLOCK_DEFAULTS[g]).blocks, link: v.blocks.link } }));
  };
  const setCustom = (fn: (list: CustomBlock[]) => CustomBlock[]) => setF((v) => ({ ...v, custom: fn(v.custom) }));
  const removeCustom = (c: CustomBlock) => {
    const held = customContent(c);
    if (held) setDialog({ kind: 'rm', id: c.id, label: c.name, detail: held });
    else setCustom((l) => l.filter((x) => x.id !== c.id));
  };
  const move = (i: number, d: number) => setCustom((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = l.slice();
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const planCount = PLAN_KINDS.filter((k) => f.plans[k.key]).length;

  return (
    <div>
      <PageHead
        crumbs={<><Link to="/sectors">Sectors</Link><span className="muted">/</span><span style={{ color: 'var(--text-primary)' }}>{edit ? saved!.name : 'New sector'}</span></>}
        title={edit ? 'Edit sector' : 'New sector'}
        lead={edit
          ? `Structure for ${saved!.name}. Add, turn off, rename or reorder anything below. Turning off a block that holds content hides it everywhere and keeps the content.`
          : 'Choose the category, then the plans and content blocks this sector needs. Everything here stays editable later.'}
        actions={<>
          <Button ghost onClick={() => navigate(edit ? `/sectors/${saved!.id}` : '/sectors')}>Cancel</Button>
          <Button icon="floppy-disk" disabled={!canSave} onClick={save}>{edit ? 'Save changes' : 'Create sector'}</Button>
        </>}
      />

      <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
        <section className="card card--pad" aria-labelledby="f-identity">
          <h2 id="f-identity" className="card__title" style={{ margin: '0 0 14px', fontWeight: 400 }}>Identity</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <label style={{ gridColumn: '1/-1' }}>
              <span className="field-label">Sector name</span>
              <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Warm-up Area" required />
            </label>
            <div>
              <span className="field-label">Assigned lead</span>
              <PersonPicker label="Assigned lead" people={people} size="md" value={f.leadId} onPick={(v) => set({ leadId: v })} onAdd={(n) => set({ leadId: addPerson(n) })} />
              <span className="field-hint">Runs the build on site. Owns the instructions.</span>
            </div>
            <div>
              <span className="field-label">Prep owner</span>
              <PersonPicker label="Prep owner" people={people} size="md" value={f.ownerId} onPick={(v) => set({ ownerId: v })} onAdd={(n) => set({ ownerId: addPerson(n) })} />
              <span className="field-hint">Prepares the floorplans and material lists in the office.</span>
            </div>
            <label>
              <span className="field-label">Location and size</span>
              <input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Concourse B · 10 × 6 m" />
            </label>
            <div>
              <span className="field-label">Build day</span>
              <Select label="Build day" size="md" width="100%" value={f.day} onChange={(v) => set({ day: v })}
                options={(BUILD_DAYS.includes(f.day) ? BUILD_DAYS : [...BUILD_DAYS, f.day]).map((d) => ({ value: d, label: dayLabel(d) }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 0', minWidth: 0 }}>
                <span className="field-label">From</span>
                <input className="input input--mono" type="time" value={f.from} onChange={(e) => set({ from: e.target.value })} />
              </label>
              <label style={{ flex: '1 1 0', minWidth: 0 }}>
                <span className="field-label">To</span>
                <input className="input input--mono" type="time" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-invalid={timeBad || undefined}
                  style={timeBad ? { borderColor: 'var(--feedback-danger-text)' } : undefined} />
              </label>
              {timeBad && <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--feedback-danger-text)' }}>The window has to end after it starts.</span>}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <span className="field-label" id="f-group">Category</span>
            <div role="radiogroup" aria-labelledby="f-group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GROUPS.map((g) => {
                const on = f.group === g.id;
                return (
                  <button key={g.id} type="button" role="radio" aria-checked={on} onClick={() => setGroup(g.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border-divider)'}`, borderRadius: 8, background: on ? 'var(--brand-primary)' : 'var(--color-neutral-white)', color: on ? '#fff' : 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Icon fa={g.icon} size={12} />{g.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card card--pad" aria-labelledby="f-plans">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 id="f-plans" className="card__title" style={{ margin: 0, fontWeight: 400 }}>Floorplans</h2>
            <span className="mono muted" style={{ fontSize: 13 }}>{planCount} of {PLAN_KINDS.length} required</span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 12px', maxWidth: 640, textWrap: 'pretty' }}>Pick each plan this sector needs. Plans left off are not applicable and are excluded from every count, dashboard rollup, task row and print packet.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {PLAN_KINDS.map((k) => {
              const on = f.plans[k.key];
              const held = saved ? planContent(saved, k.key) : null;
              return (
                <ToggleRow key={k.key} on={on} onClick={() => togglePlan(k.key)} icon={k.icon} label={k.name}
                  badge={held ? (on ? 'inuse' : 'kept') : null}
                  note={on ? 'Required — counts on the dashboard, tasks and packet' : 'Not applicable for this sector'}
                  holds={held} />
              );
            })}
          </div>
        </section>

        <section className="card card--pad" aria-labelledby="f-blocks">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 id="f-blocks" className="card__title" style={{ margin: 0, fontWeight: 400 }}>Content blocks</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              {edit ? 'Changing the category only moves where the sector is listed.' : `Defaults for ${groupName(f.group)}. Every toggle stays editable.`}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 12px', maxWidth: 640, textWrap: 'pretty' }}>Each block on shows as a card on the sector page, a column on the dashboard and its own task row. Blocks off appear nowhere and count toward nothing.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
            {BLOCK_DEFS.map((b) => {
              const on = f.blocks[b.k];
              const held = saved ? blockContent(saved, b.k) : null;
              return <ToggleRow key={b.k} on={on} onClick={() => toggleBlock(b.k)} icon={b.icon} label={blockLabel(b.k)} badge={held ? (on ? 'inuse' : 'kept') : null} note={b.hint} holds={held} />;
            })}
          </div>
          {f.blocks.link && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 14, padding: 14, border: '1px solid var(--border-divider)', borderRadius: 8, background: 'var(--color-neutral-surface-50)' }}>
              <label><span className="field-label">Link label</span>
                <input className="input" value={f.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} placeholder="e.g. Staff check-in sheet · Google Sheets" /></label>
              <label><span className="field-label">URL</span>
                <input className="input" type="url" value={f.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} placeholder="https://" /></label>
            </div>
          )}
        </section>

        <section className="card card--pad" aria-labelledby="f-custom">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 id="f-custom" className="card__title" style={{ margin: 0, fontWeight: 400 }}>Custom blocks</h2>
            <div style={{ marginLeft: 'auto' }}><Button size="small" variant="neutral" outlined icon="plus" onClick={() => setDialog({ kind: 'add' })}>Add block</Button></div>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 12px', maxWidth: 640, textWrap: 'pretty' }}>For anything the built-in blocks do not cover. A custom block gets a card on the sector page, its own task row and deadline, and its own pages in the print packet.</p>
          {!f.custom.length ? (
            <div style={{ border: '1px dashed var(--border-divider)', borderRadius: 8, padding: 24, textAlign: 'center', background: 'var(--color-neutral-surface-50)' }}>
              <Icon fa="layer-group" size={30} style={{ color: 'var(--border-divider)' }} />
              <div className="muted" style={{ fontSize: 14, marginTop: 8 }}>No custom blocks. Add one if this sector needs a field the standard set does not have.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.custom.map((c, i) => {
                const kd = customKind(c.kind);
                const held = customContent(c);
                const isNew = !savedIds.has(c.id);
                const hint = !c.on ? `Turned off. Holds ${held ?? 'its content'}, kept and restored if you turn it back on.`
                  : held ? `Holds ${held}` : isNew ? 'Added in this edit. Its card, task row and packet page appear when you save.' : 'Empty. Add content on the sector page.';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', border: `1px solid ${c.on ? 'var(--border-divider)' : 'var(--border-subtle)'}`, borderRadius: 8, background: c.on ? 'var(--color-neutral-white)' : 'var(--color-neutral-surface-50)' }}>
                    <Icon fa={kd.icon} size={14} style={{ color: 'var(--icon-tertiary)' }} />
                    <span style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input className="input" style={{ minHeight: 36 }} value={c.name} aria-label="Block name"
                          onChange={(e) => setCustom((l) => l.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                        {c.on && held && <span className="badge badge--inuse"><Icon fa="circle-check" size={9} />In use</span>}
                        {!c.on && <span className="badge badge--kept"><Icon fa="box-archive" size={9} />Content kept</span>}
                        {isNew && <span className="badge badge--new"><Icon fa="plus" size={9} />New</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, marginTop: 4, color: held || !c.on ? 'var(--text-secondary)' : 'var(--color-neutral-gray-300)' }}>{kd.label} · {hint}</span>
                    </span>
                    {c.on ? (
                      <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`} title="Move up"><Icon fa="arrow-up" size={14} /></button>
                        <button type="button" className="icon-btn" disabled={i === f.custom.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`} title="Move down"><Icon fa="arrow-down" size={14} /></button>
                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeCustom(c)} aria-label={`Remove ${c.name}`} title="Remove block"><Icon fa="trash" size={14} /></button>
                      </span>
                    ) : (
                      <span style={{ marginLeft: 'auto' }}>
                        <Button size="small" variant="neutral" outlined icon="rotate-left" onClick={() => setCustom((l) => l.map((x) => (x.id === c.id ? { ...x, on: true } : x)))}>Turn back on</Button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </form>

      {dialog?.kind === 'off' && (
        <Modal title={`Turn off ${dialog.label}?`} icon="triangle-exclamation" iconColor="var(--feedback-warning-accent)" onClose={() => setDialog(null)}
          footer={<>
            <Button ghost onClick={() => setDialog(null)}>Keep it on</Button>
            <Button onClick={() => { dialog.apply(); setDialog(null); }}>Turn off block</Button>
          </>}>
          <div className="modal__body">
            {dialog.label} already holds {dialog.detail}. Turning it off hides it from the sector page, the dashboard, the task list and the print packet.
            <KeptCallout>The content is kept, not deleted. Turn the block back on and it comes back exactly as it is now.</KeptCallout>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'rm' && (
        <Modal title={`Turn off ${dialog.label}?`} icon="triangle-exclamation" iconColor="var(--feedback-warning-accent)" onClose={() => setDialog(null)}
          footer={<>
            <Button ghost onClick={() => setDialog(null)}>Keep it</Button>
            <Button onClick={() => { setCustom((l) => l.map((x) => (x.id === dialog.id ? { ...x, on: false } : x))); setDialog(null); }}>Turn off block</Button>
          </>}>
          <div className="modal__body">
            {dialog.label} holds {dialog.detail}. A block with content is turned off rather than removed: it leaves the sector page, the dashboard count, the task list and the print packet.
            <KeptCallout>The content is kept, not deleted. The block stays listed here as turned off, and Turn back on restores it exactly as it is now.</KeptCallout>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'add' && <AddBlockDialog onClose={() => setDialog(null)} onAdd={(b) => { setCustom((l) => [...l, b]); setDialog(null); }} />}
    </div>
  );
}

function ToggleRow({ on, onClick, icon, label, badge, note, holds }: { on: boolean; onClick: () => void; icon: string; label: string; badge: 'inuse' | 'kept' | null; note: string; holds: string | null }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle-row" onClick={onClick}>
      <span className="switch" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14, color: 'var(--text-primary)' }}>
          <Icon fa={icon} size={12} style={{ color: 'var(--icon-tertiary)' }} />{label}
          {badge === 'inuse' && <span className="badge badge--inuse"><Icon fa="circle-check" size={9} />In use</span>}
          {badge === 'kept' && <span className="badge badge--kept"><Icon fa="box-archive" size={9} />Content kept</span>}
        </span>
        <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{note}</span>
        {holds && <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: 'var(--text-secondary)' }}>Holds {holds}</span>}
      </span>
    </button>
  );
}

function AddBlockDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (b: CustomBlock) => void }) {
  const [pick, setPick] = useState<CustomKind>('checklist');
  const [name, setName] = useState('');
  const add = () => {
    const b: CustomBlock = { id: `cb-${Math.random().toString(36).slice(2, 8)}`, kind: pick, name: name.trim() || customKind(pick).label, on: true };
    if (pick === 'checklist') b.rows = [];
    if (pick === 'text') b.steps = [];
    if (pick === 'gallery') b.shots = [];
    onAdd(b);
  };
  return (
    <Modal title="Add a block" icon="plus" iconColor="var(--brand-primary)" onClose={onClose} width={600}
      footer={<>
        <Button ghost onClick={onClose}>Cancel</Button>
        <Button icon="plus" onClick={add}>Add block</Button>
      </>}>
      <div className="modal__body">
        <span className="field-label" id="add-kind">Block kind</span>
        <div role="radiogroup" aria-labelledby="add-kind" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CUSTOM_KINDS.map((k) => (
            <button key={k.k} type="button" role="radio" aria-checked={pick === k.k} className="toggle-row" style={{ gap: 10, padding: '10px 12px' }} onClick={() => setPick(k.k)}>
              <Icon fa={k.icon} size={14} style={{ color: 'var(--color-neutral-gray-300)', marginTop: 3 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>{k.label}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{k.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <label style={{ display: 'block', marginTop: 16 }}>
          <span className="field-label">Block name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={customKind(pick).label}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        </label>
      </div>
    </Modal>
  );
}
