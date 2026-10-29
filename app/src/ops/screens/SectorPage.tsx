import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { useMe } from '../access';
import { blockState, CONTENT_KEYS, slotMeta } from '../data/content';
import { blockLabel, groupName, PLAN_KEYS } from '../data/meta';
import { dateLabel, otherItems, packetState, personName, planRoll, windowLabel } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import { taskKey, taskRows, toIsoDay } from '../data/tasks';
import type { PlanKey, Sector } from '../data/types';
import { BuildTag, ContentChip, Segments, UploadChip } from '../ui/bits';
import { ArchiveDialog, DeleteDialog } from '../ui/SectorDialogs';
import { CustomCard, FloorplanCard, InfoCard, LinkCard, MaterialCard, StepsCard, type CardProps } from './sectorCards';

export function SectorPage() {
  const { id } = useParams();
  const data = useOps();
  const sector = data.sectors.find((s) => s.id === id);
  if (!sector) return <Navigate to="/sectors" replace />;
  return <SectorView key={sector.id} sector={sector} people={data.people} />;
}

/**
 * Check-offs and uploaded files are live: a tick on site and an upload or removal take effect
 * the moment they happen, so edit mode never overwrites them with a stale copy.
 */
function withLiveChecks(draft: Sector, live: Sector): Sector {
  const next = structuredClone(draft);
  (Object.keys(next.plans) as PlanKey[]).forEach((k) => {
    const l = live.plans[k];
    if (l.file) next.plans[k].file = l.file; else delete next.plans[k].file;
    if (l.prevUploadedAt) next.plans[k].prevUploadedAt = l.prevUploadedAt; else delete next.plans[k].prevUploadedAt;
  });
  next.custom.forEach((c) => {
    const l = live.custom.find((x) => x.id === c.id);
    if (l?.file) c.file = l.file; else delete c.file;
  });
  // Who edited, and final locks, are live too: Unlock in edit mode takes effect at once.
  [...CONTENT_KEYS, ...next.custom.map((c) => c.id)].forEach((slot) => {
    const d = slotMeta(next, slot);
    const l = slotMeta(live, slot);
    if (!d || !l) return;
    (['edited', 'final', 'unlocked'] as const).forEach((k) => { if (l[k]) d[k] = l[k]; else delete d[k]; });
  });
  const rows = new Map([...live.blocks.mainMat.rows, ...live.blocks.netMat.rows, ...live.custom.flatMap((c) => c.rows ?? [])].map((r) => [r.id, r.checked]));
  const steps = new Map([...live.blocks.instr.steps, ...live.blocks.install.steps].map((s) => [s.id, s.done]));
  [...next.blocks.mainMat.rows, ...next.blocks.netMat.rows, ...next.custom.flatMap((c) => c.rows ?? [])].forEach((r) => { if (rows.has(r.id)) r.checked = rows.get(r.id)!; });
  [...next.blocks.instr.steps, ...next.blocks.install.steps].forEach((s) => { if (steps.has(s.id)) s.done = steps.get(s.id)!; });
  return next;
}

const stripChecks = (s: Sector) => JSON.stringify(s, (k, v) => (['checked', 'done', 'file', 'prevUploadedAt', 'contentChangedAt', 'edited', 'final', 'unlocked'].includes(k) ? undefined : v));

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
    const t = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ block: 'start' }), 30);
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
    opsStore().saveSector(sector.id, (x) => { Object.assign(x, next, { contentChangedAt: x.contentChangedAt }); }, me.id);
    stopEdit();
  };
  const change = (fn: (d: Sector) => void) => setDraft((d) => { if (!d) return d; const n = structuredClone(d); fn(n); return n; });
  const toggleRow = (block: string, rowId: string) => opsStore().toggleRow(sector.id, block, rowId);
  const toggleStep = (block: 'instr' | 'install', stepId: string) => opsStore().toggleStep(sector.id, block, stepId);

  const ownerName = personName(people, s.ownerId);
  const fp = planRoll(s);
  // Deadlines and who is responsible come from the same rows Tasks shows.
  const data = useOps();
  const today = toIsoDay(new Date());
  const rows = new Map(taskRows(data, today).filter((r) => r.sectorId === sector.id).map((r) => [r.key, r]));
  const info: CardProps['info'] = (slot) => {
    const r = rows.get(taskKey(sector.id, slot));
    return { due: r?.due ?? s.day, late: !!r?.late, lateDays: r?.lateDays ?? 0, canFinal: r ? me.canMarkFinal(r.who) : false };
  };
  const pn = (id: string) => personName(people, id);
  const props: CardProps = { s, editing, change, ownerName, canCheck: me.canCheckOff(s), meId: me.id, info, pn };
  const xref = s.xref ? opsStore().sector(s.xref.sectorId) : undefined;
  const packet = packetState(s);

  // One fact per block: what it holds (or that it's empty, red once late). No status to set.
  const facts: { key: string; label: string; node: React.ReactNode }[] = [];
  (['mainMat', 'instr'] as const).forEach((k) => {
    if (!s.blocks[k].on) return;
    const st = blockState(s.blocks, k);
    facts.push({ key: k, label: k === 'mainMat' ? 'Material list' : blockLabel(k), node: <ContentChip summary={st.summary} late={st.empty && info(k).late} final={!!st.meta.final} size="lg" /> });
  });
  otherItems(s).forEach((i) => facts.push({
    key: i.key, label: i.name,
    node: i.kind === 'upload' ? <UploadChip done={i.done} late={!i.done && info(i.key).late} size="lg" /> : <ContentChip summary={i.summary} late={!i.done && info(i.key).late} final={i.final} size="lg" />
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
          {!editing && !s.archived && <Button variant="neutral" outlined icon="mobile-screen-button" onClick={() => navigate(`/field/${s.id}`)}>Field view</Button>}
          {!editing && !s.archived && <Button variant="neutral" outlined icon="print" onClick={() => navigate(`/print?sector=${s.id}`)}>Print packet</Button>}
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
        <span className="overline">What's here</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="muted" style={{ fontSize: 13 }}>Floorplans</span>
          {fp.total ? <><Segments items={fp.plans.map((p) => ({ ...p, late: !p.done && info(p.key).late }))} /><span className="mono" style={{ fontSize: 14 }}>{fp.done}/{fp.total}</span></>
            : <span className="muted" style={{ fontSize: 12 }}>{s.noFloorplans ? 'Not applicable' : 'Not set'}</span>}
        </div>
        {facts.map((b) => (
          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>{b.label}</span>
            {b.node}
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
