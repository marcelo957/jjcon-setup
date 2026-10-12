import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { Select } from '../../ds/Select';
import { useMe } from '../access';
import { groupName, PLAN_KEYS } from '../data/meta';
import { dateLabel, otherItems, packetState, personName, planRoll, windowLabel } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import type { PlanKey, PrepStatus, Sector } from '../data/types';
import { BuildTag, PrepChip, Segments } from '../ui/bits';
import { ArchiveDialog, DeleteDialog } from '../ui/SectorDialogs';
import { CustomCard, FloorplanCard, InfoCard, LinkCard, MaterialCard, prepOptions, StepsCard, type CardProps } from './sectorCards';

export function SectorPage() {
  const { id } = useParams();
  const data = useOps();
  const sector = data.sectors.find((s) => s.id === id);
  if (!sector) return <Navigate to="/sectors" replace />;
  return <SectorView key={sector.id} sector={sector} people={data.people} />;
}

/** Check-off state is live on site; edit mode never overwrites it with a stale copy. */
function withLiveChecks(draft: Sector, live: Sector): Sector {
  const next = structuredClone(draft);
  const rows = new Map([...live.blocks.mainMat.rows, ...live.blocks.netMat.rows, ...live.custom.flatMap((c) => c.rows ?? [])].map((r) => [r.id, r.checked]));
  const steps = new Map([...live.blocks.instr.steps, ...live.blocks.install.steps].map((s) => [s.id, s.done]));
  [...next.blocks.mainMat.rows, ...next.blocks.netMat.rows, ...next.custom.flatMap((c) => c.rows ?? [])].forEach((r) => { if (rows.has(r.id)) r.checked = rows.get(r.id)!; });
  [...next.blocks.instr.steps, ...next.blocks.install.steps].forEach((s) => { if (steps.has(s.id)) s.done = steps.get(s.id)!; });
  return next;
}

const stripChecks = (s: Sector) => JSON.stringify(s, (k, v) => (k === 'checked' || k === 'done' ? undefined : v));

function SectorView({ sector, people }: { sector: Sector; people: ReturnType<typeof useOps>['people'] }) {
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const canEdit = me.canEditSector(sector);
  const [draft, setDraft] = useState<Sector | null>(() => (params.get('edit') === '1' && canEdit ? structuredClone(sector) : null));
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<'archive' | 'delete' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editing = !!draft;
  const s = draft ? withLiveChecks(draft, sector) : sector;
  const dirty = !!draft && stripChecks(draft) !== stripChecks(sector);

  const planParam = params.get('plan') as PlanKey | null;
  const plan = planParam && PLAN_KEYS.includes(planParam) ? planParam : null;
  const setPlan = (k: PlanKey) => setParams((p) => { p.set('plan', k); return p; }, { replace: true });

  // Deep links from the dashboard: #material, #steps, #block-<key>
  useEffect(() => {
    if (!location.hash) { window.scrollTo?.(0, 0); return; }
    const t = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }), 30);
    return () => clearTimeout(t);
  }, [location.hash]);

  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [menu]);

  // Warn before leaving the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const startEdit = () => { setDraft(structuredClone(sector)); setParams((p) => { p.set('edit', '1'); return p; }, { replace: true }); };
  const stopEdit = () => { setDraft(null); setParams((p) => { p.delete('edit'); return p; }, { replace: true }); };
  const save = () => {
    if (!draft) return;
    if (!dirty) { stopEdit(); return; }
    const next = withLiveChecks(draft, sector);
    opsStore().saveSector(sector.id, (x) => { Object.assign(x, next, { contentChangedAt: x.contentChangedAt }); });
    stopEdit();
  };
  const change = (fn: (d: Sector) => void) => setDraft((d) => { if (!d) return d; const n = structuredClone(d); fn(n); return n; });
  const toggleRow = (block: string, rowId: string) => opsStore().toggleRow(sector.id, block, rowId);
  const toggleStep = (block: 'instr' | 'install', stepId: string) => opsStore().toggleStep(sector.id, block, stepId);

  const ownerName = personName(people, s.ownerId);
  const fp = planRoll(s);
  const props: CardProps = { s, editing, change, ownerName, canCheck: me.canCheckOff, meId: me.id };
  const xref = s.xref ? opsStore().sector(s.xref.sectorId) : undefined;
  const packet = packetState(s);

  const statusBlocks: { key: string; label: string; status: PrepStatus; set: (v: PrepStatus) => void }[] = [];
  if (s.blocks.mainMat.on) statusBlocks.push({ key: 'mainMat', label: 'Material list', status: s.blocks.mainMat.status, set: (v) => change((d) => { d.blocks.mainMat.status = v; }) });
  if (s.blocks.instr.on) statusBlocks.push({ key: 'instr', label: 'Instructions', status: s.blocks.instr.status, set: (v) => change((d) => { d.blocks.instr.status = v; }) });
  otherItems(s).forEach((i) => statusBlocks.push({
    key: i.key, label: i.name, status: i.status,
    set: (v) => change((d) => {
      const c = d.custom.find((x) => x.id === i.key);
      if (c) c.status = v;
      else d.blocks[i.key as 'netMat' | 'info' | 'install' | 'link'].status = v;
    })
  }));

  return (
    <div>
      <header className="page-head">
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <div className="crumbs"><Link to="/sectors">Sectors</Link><span className="muted">/</span><span style={{ color: 'var(--text-primary)' }}>{groupName(s.group)}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-head__title">{s.name}</h1>
            <BuildTag status={s.build} />
            {s.archived && <span className="badge badge--kept"><Icon fa="box-archive" size={9} />Archived</span>}
          </div>
          <div className="page-head__lead">{s.location}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
            <span><Icon fa="user" size={12} style={{ color: 'var(--icon-tertiary)' }} /> Lead {personName(people, s.leadId)}</span>
            <span><Icon fa="user-pen" size={12} style={{ color: 'var(--icon-tertiary)' }} /> Owner {ownerName}</span>
            <span className="mono"><Icon fa="clock" size={12} style={{ color: 'var(--icon-tertiary)' }} /> {windowLabel(s)}</span>
          </div>
          {s.xref && xref && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '7px 12px', border: '1px solid var(--border-divider)', borderLeft: '4px solid var(--color-brand-ibjjf-tertiary-500)', borderRadius: 8, background: 'var(--color-neutral-surface-50)', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 760, textWrap: 'pretty' }}>
              <Icon fa="circle-info" size={13} style={{ color: 'var(--color-brand-ibjjf-tertiary-500)' }} />
              <span>{s.xref.text} <Link to={`/sectors/${xref.id}`} style={{ fontWeight: 500 }}>{xref.name}</Link>{s.xref.tail}</span>
            </div>
          )}
        </div>
        <div className="page-head__actions" style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
          {!editing && canEdit && <Button icon="pen" onClick={startEdit}>Edit</Button>}
          {editing && <>
            <Button ghost onClick={stopEdit}>Cancel</Button>
            <Button icon="floppy-disk" onClick={save}>Save changes</Button>
          </>}
          {me.canManageSectors && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button type="button" className="icon-btn" style={{ width: 40, height: 40, borderRadius: 8 }} aria-label="Sector actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                <Icon fa="ellipsis-vertical" size={14} />
              </button>
              {menu && (
                <div role="menu" style={{ position: 'absolute', right: 0, top: 46, zIndex: 700, minWidth: 210, background: 'var(--color-neutral-white)', border: '1px solid var(--border-subtle)', borderRadius: 8, boxShadow: 'var(--ib-elevation-2)', padding: 4, display: 'flex', flexDirection: 'column' }}>
                  <MenuEntry icon="pen" onClick={() => navigate(`/sectors/${s.id}/edit`)}>Edit sector</MenuEntry>
                  {!s.archived && <MenuEntry icon="box-archive" onClick={() => { setMenu(false); setDialog('archive'); }}>Archive sector</MenuEntry>}
                  {s.archived && <MenuEntry icon="rotate-left" onClick={() => { setMenu(false); opsStore().restore(s.id); }}>Restore sector</MenuEntry>}
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <MenuEntry icon="trash" danger onClick={() => { setMenu(false); setDialog('delete'); }}>Delete sector</MenuEntry>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', padding: '12px 16px', marginBottom: 8 }}>
        <span className="overline">Prep status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="muted" style={{ fontSize: 13 }}>Floorplans</span>
          {fp.total ? <><Segments items={fp.plans} /><span className="mono" style={{ fontSize: 14 }}>{fp.ready}/{fp.total}</span></>
            : <span className="muted" style={{ fontSize: 12 }}>{s.noFloorplans ? 'Not applicable' : 'Not set'}</span>}
        </div>
        {statusBlocks.map((b) => (
          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>{b.label}</span>
            {editing ? <Select label={`${b.label} status`} value={b.status} options={prepOptions} width={150} onChange={(v) => b.set(v as PrepStatus)} /> : <PrepChip status={b.status} size="lg" />}
          </div>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', fontSize: 13, color: packet === 'stale' ? 'var(--feedback-danger-text)' : packet === 'current' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          <Icon fa={packet === 'stale' ? 'triangle-exclamation' : packet === 'current' ? 'circle-check' : 'circle-info'} size={14}
            style={{ color: packet === 'stale' ? 'var(--feedback-warning-accent)' : packet === 'current' ? 'var(--feedback-success-text)' : 'var(--color-neutral-gray-300)' }} />
          {packet === 'none' && 'No packet printed yet for this sector.'}
          {packet === 'current' && `Packet printed ${dateLabel(s.packetPrintedAt!)}. Matches the current content.`}
          {packet === 'stale' && `Content changed ${dateLabel(s.contentChangedAt!)}, after the packet was printed ${dateLabel(s.packetPrintedAt!)}. Reprint before load-in.`}
        </span>
      </div>

      {dirty && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--accent-gold)', color: '#1d1400', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 14 }}>
          <Icon fa="pen" size={14} /><span>Unsaved changes. Nothing is visible to the floor until you save.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1500 }}>
        {(fp.total > 0 || !s.noFloorplans || editing) && (
          <FloorplanCard {...props} plan={plan} setPlan={setPlan} startEdit={startEdit} canEdit={canEdit} />
        )}
        {s.blocks.link.on && <LinkCard {...props} />}
        {s.blocks.info.on && <InfoCard {...props} />}
        {(s.blocks.mainMat.on || s.blocks.netMat.on) && <MaterialCard {...props} toggleRow={toggleRow} />}
        {s.blocks.instr.on && <StepsCard {...props} block="instr" title="Instructions" toggleStep={toggleStep} />}
        {s.blocks.install.on && <StepsCard {...props} block="install" title="Installation" toggleStep={toggleStep} />}
        {s.custom.filter((c) => c.on).map((c) => <CustomCard key={c.id} {...props} c={c} toggleRow={toggleRow} />)}
      </div>

      {dialog === 'archive' && <ArchiveDialog sector={sector} by={me.id} onClose={() => setDialog(null)} onDone={() => navigate('/sectors?tab=archived')} />}
      {dialog === 'delete' && <DeleteDialog sector={sector} by={me.id} onClose={() => setDialog(null)} onDeleted={() => navigate('/sectors')} onArchived={() => navigate('/sectors?tab=archived')} />}
    </div>
  );
}

function MenuEntry({ icon, children, onClick, danger }: { icon: string; children: string; onClick: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" role="menuitem" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: 0, borderRadius: 4, background: hover ? 'var(--color-neutral-surface-100)' : 'transparent', color: danger ? 'var(--feedback-danger-text)' : 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: 14, textAlign: 'left', cursor: 'pointer' }}>
      <Icon fa={icon} size={14} style={{ color: danger ? undefined : 'var(--color-neutral-gray-300)' }} />{children}
    </button>
  );
}
