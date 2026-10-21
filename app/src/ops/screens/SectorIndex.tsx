import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { SearchInput } from '../../ds/Select';
import { useMe } from '../access';
import { blockLabel, BLOCK_DEFS, GROUPS, groupName } from '../data/meta';
import { activeSectors, archivedSectors, dateLabel, personName, planRoll, windowLabel } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import type { Sector } from '../data/types';
import { IconBtn, PageHead } from '../ui/bits';
import { ArchiveDialog, DeleteDialog } from '../ui/SectorDialogs';

const tabStyle = (on: boolean): React.CSSProperties => ({
  font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase', padding: '9px 16px', border: 0,
  borderBottom: `3px solid ${on ? 'var(--brand-primary)' : 'transparent'}`, background: 'transparent',
  color: on ? 'var(--brand-primary)' : 'var(--color-neutral-gray-300)', cursor: 'pointer'
});

export function SectorIndex() {
  const data = useOps();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'archived' ? 'archived' : 'active';
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'archive' | 'delete'; s: Sector } | null>(null);

  const needle = q.trim().toLowerCase();
  const match = (s: Sector) => !needle || s.name.toLowerCase().includes(needle) || personName(data.people, s.leadId).toLowerCase().includes(needle);
  const active = activeSectors(data);
  const archived = archivedSectors(data);
  const groups = GROUPS.map((g) => ({ ...g, rows: active.filter((s) => s.group === g.id && match(s)) })).filter((g) => g.rows.length);
  const archRows = archived.filter(match);
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);
  const setTab = (t: 'active' | 'archived') => setParams(t === 'archived' ? { tab: 'archived' } : {});

  return (
    <div>
      <PageHead
        overline="Office · sector management"
        title="Sectors"
        lead="Every sector in the build, by category. Structure is set here: which floorplans a sector needs and which content blocks it has."
        actions={<>
          <Button variant="neutral" outlined icon="table-cells" onClick={() => navigate('/prep')}>Prep dashboard</Button>
          {me.canManageSectors && <Button icon="plus" onClick={() => navigate('/sectors/new')}>Add sector</Button>}
        </>}
      />
      <div className="card" style={{ overflow: 'hidden' }}>
        <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '0 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button type="button" role="tab" aria-selected={tab === 'active'} style={tabStyle(tab === 'active')} onClick={() => setTab('active')}>Active {active.length}</button>
          <button type="button" role="tab" aria-selected={tab === 'archived'} style={tabStyle(tab === 'archived')} onClick={() => setTab('archived')}>Archived {archived.length}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <span className="mono muted" style={{ fontSize: 13 }}>{tab === 'active' ? `${shown} of ${active.length} sectors shown` : `${archRows.length} archived`}</span>
            <SearchInput placeholder="Search sectors" value={q} onChange={setQ} width={220} />
          </div>
        </div>

        {tab === 'active' && (
          <div role="tabpanel">
            {groups.map((g) => (
              <div key={g.id}>
                <div style={{ font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'var(--color-neutral-surface-300)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <Icon fa={g.icon} size={11} style={{ color: 'var(--icon-tertiary)' }} /><span>{g.name}</span>
                  <span className="mono muted" style={{ letterSpacing: 0, textTransform: 'none' }}>{g.rows.length}</span>
                </div>
                {g.rows.map((s) => <IndexRow key={s.id} s={s} people={data.people} canManage={me.canManageSectors} open={() => navigate(`/sectors/${s.id}`)}
                  edit={() => navigate(`/sectors/${s.id}/edit`)} archive={() => setDialog({ kind: 'archive', s })} remove={() => setDialog({ kind: 'delete', s })} />)}
              </div>
            ))}
            {!groups.length && (
              <div className="empty">
                <Icon fa="magnifying-glass" size={40} style={{ color: 'var(--border-divider)' }} />
                <div className="empty__title">No sectors match that search</div>
                <div className="empty__text">Clear the search{me.canManageSectors ? ', or add a sector' : ''}.</div>
              </div>
            )}
          </div>
        )}

        {tab === 'archived' && (
          <div role="tabpanel">
            {archRows.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--color-neutral-surface-50)' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 17, fontWeight: 500, color: 'var(--text-secondary)' }}>{s.name}</span>
                    <span className="badge badge--kept"><Icon fa="box-archive" size={9} />Archived</span>
                    <span className="muted" style={{ fontSize: 12 }}>{groupName(s.group)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{s.archived!.reason}</div>
                  <div className="mono muted" style={{ fontSize: 12, marginTop: 2 }}>Archived {dateLabel(s.archived!.at)} by {personName(data.people, s.archived!.by)}</div>
                </div>
                {me.canManageSectors && (
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <Button size="small" variant="neutral" outlined icon="rotate-left" onClick={() => opsStore().restore(s.id)}>Restore</Button>
                    <IconBtn fa="trash" label={`Delete ${s.name}`} danger onClick={() => setDialog({ kind: 'delete', s })} />
                  </div>
                )}
              </div>
            ))}
            {!archRows.length && (
              <div className="empty" style={{ padding: '56px 24px' }}>
                <Icon fa="box-archive" size={44} style={{ color: 'var(--border-divider)' }} />
                <div className="empty__title">{needle ? 'No archived sectors match that search' : 'Nothing archived'}</div>
                <div className="empty__text">Archive a sector that is cancelled or not running this year. It leaves the dashboard, tasks and packets, keeps everything it holds, and can be restored here.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {dialog?.kind === 'archive' && <ArchiveDialog sector={dialog.s} by={me.id} onClose={() => setDialog(null)} onDone={() => { setDialog(null); setTab('archived'); }} />}
      {dialog?.kind === 'delete' && <DeleteDialog sector={dialog.s} by={me.id} onClose={() => setDialog(null)}
        onDeleted={() => setDialog(null)} onArchived={() => { setDialog(null); setTab('archived'); }} />}
    </div>
  );
}

function IndexRow({ s, people, canManage, open, edit, archive, remove }: {
  s: Sector; people: Parameters<typeof personName>[0]; canManage: boolean; open: () => void; edit: () => void; archive: () => void; remove: () => void;
}) {
  const roll = planRoll(s);
  const blocks = [...BLOCK_DEFS.filter((b) => s.blocks[b.k].on).map((b) => ({ k: b.k as string, label: blockLabel(b.k) })),
    ...s.custom.filter((c) => c.on).map((c) => ({ k: c.id, label: c.name }))];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <button type="button" className="name-btn" onClick={open}>{s.name}</button>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.location} · {windowLabel(s)}</div>
      </div>
      <span style={{ flex: '0 0 120px', fontSize: 13, color: 'var(--text-secondary)' }}>{personName(people, s.leadId)}</span>
      <span className="mono" style={{ flex: '0 0 110px', fontSize: 13, color: roll.total ? 'var(--text-secondary)' : 'var(--color-neutral-gray-300)' }}>
        {roll.total ? `${roll.done}/${roll.total} plans` : 'No plans set'}
      </span>
      <div style={{ flex: '1 1 260px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {blocks.map((b) => <span key={b.k} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, background: 'var(--color-neutral-surface-300)', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{b.label}</span>)}
      </div>
      {canManage && (
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <IconBtn fa="pen" label={`Edit ${s.name}`} onClick={edit} />
          <IconBtn fa="box-archive" label={`Archive ${s.name}`} onClick={archive} />
          <IconBtn fa="trash" label={`Delete ${s.name}`} danger onClick={remove} />
        </div>
      )}
    </div>
  );
}
