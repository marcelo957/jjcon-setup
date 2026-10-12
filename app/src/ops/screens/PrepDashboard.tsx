import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { SearchInput, Select } from '../../ds/Select';
import { EVENT_NAME, VENUE } from '../../config';
import { useMe } from '../access';
import { GROUPS, isReady, PREP, PREP_ORDER } from '../data/meta';
import { activeSectors, isBlocked, isComplete, otherRoll, personName, planRoll, sortPeople } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import type { PrepStatus, Sector } from '../data/types';
import { BuildTag, Modal, PageHead, PrepChip, Segments } from '../ui/bits';
import { PersonPicker } from '../ui/PersonPicker';

type Expand = `${string}|fp` | `${string}|other` | null;

export function PrepDashboard() {
  const data = useOps();
  const me = useMe();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('all');
  const [incomplete, setIncomplete] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [expand, setExpand] = useState<Expand>(null);
  const [confirmReady, setConfirmReady] = useState(false);

  const active = activeSectors(data);
  const people = sortPeople(data.people.filter((p) => p.active));
  const needle = q.trim().toLowerCase();
  const visible = active.filter((s) =>
    (!needle || s.name.toLowerCase().includes(needle) || personName(data.people, s.ownerId).toLowerCase().includes(needle))
    && (owner === 'all' || s.ownerId === (owner === '__un' ? '' : owner))
    && (!incomplete || !isComplete(s)));

  const chosen = active.filter((s) => sel[s.id]);
  const allSelected = visible.length > 0 && visible.every((s) => sel[s.id]);
  const open = (s: Sector, hash = '') => navigate(`/sectors/${s.id}${hash}`);
  const drafts = countDrafts(chosen);

  return (
    <div>
      <PageHead
        overline="Office · content preparation"
        title="Prep dashboard"
        lead={`${EVENT_NAME} · ${VENUE}. Every sector needs a floorplan, a material list and setup instructions before load-in.`}
        actions={me.canManageSectors && <Button icon="plus" onClick={() => navigate('/sectors/new')}>Add sector</Button>}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <SearchInput placeholder="Search sectors" value={q} onChange={setQ} width={240} />
        <Select label="Owner" value={owner} onChange={setOwner} width={190}
          options={[{ value: 'all', label: 'All owners' }, ...people.map((p) => ({ value: p.id, label: p.name })), { value: '__un', label: 'Unassigned' }]} />
        <Button size="small" outlined={!incomplete} icon="filter" onClick={() => setIncomplete((v) => !v)}>Incomplete only</Button>
        <span className="mono muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{visible.length} of {active.length} sectors shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 1270 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-divider)' }}>
                <th style={{ width: 40, padding: '10px 16px' }}>
                  <input type="checkbox" aria-label="Select all sectors shown" checked={allSelected}
                    onChange={() => setSel(allSelected ? {} : Object.fromEntries(visible.map((s) => [s.id, true])))} />
                </th>
                <th style={{ minWidth: 300, padding: '10px 16px' }}>Sector</th>
                <th style={{ width: 130, padding: '10px 16px' }}>Owner</th>
                <th style={{ width: 170 }}>Floorplans</th>
                <th style={{ width: 150 }}>Material list</th>
                <th style={{ width: 150 }}>Instructions</th>
                <th style={{ width: 170 }}>Other items</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const rows = visible.filter((s) => s.group === g.id);
                if (!rows.length) return null;
                return (
                  <Fragment key={g.id}>
                    <tr style={{ background: 'var(--color-neutral-surface-300)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <td />
                      <td colSpan={6} className="overline--secondary" style={{ font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase', padding: '6px 16px', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon fa={g.icon} size={11} style={{ color: 'var(--icon-tertiary)' }} />{g.name}
                          <span className="mono muted" style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>{rows.length}</span>
                        </span>
                      </td>
                    </tr>
                    {rows.map((s) => (
                      <SectorRow key={s.id} s={s} people={data.people} selected={!!sel[s.id]}
                        onSelect={() => setSel((v) => ({ ...v, [s.id]: !v[s.id] }))}
                        expand={expand} setExpand={setExpand} open={open}
                        canEdit={me.canEditSector(s)} />
                    ))}
                  </Fragment>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={7}>
                  <div className="empty">
                    <Icon fa="magnifying-glass" size={40} style={{ color: 'var(--border-divider)' }} />
                    <div className="empty__title">No sectors match</div>
                    <div className="empty__text">Clear the search or the filters to see every sector.</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {me.canManageSectors && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--color-neutral-surface-50)' }}>
            <span className="muted" style={{ fontSize: 13 }}>{chosen.length ? `${chosen.length} selected` : 'Select sectors for a bulk action'}</span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: 160 }}>
                <PersonPicker people={data.people} action actionLabel="Assign owner" disabled={!chosen.length}
                  onPick={(id) => { chosen.forEach((s) => opsStore().saveSector(s.id, (x) => { x.ownerId = id; })); }}
                  onAdd={(name) => { const id = opsStore().addPerson(name); chosen.forEach((s) => opsStore().saveSector(s.id, (x) => { x.ownerId = id; })); }} />
              </div>
              <Button size="small" outlined variant="neutral" icon="circle-check" disabled={!chosen.length} onClick={() => setConfirmReady(true)}>Mark ready</Button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, padding: '12px 16px', background: 'var(--color-neutral-white)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <span className="overline">Prep status</span>
        {PREP_ORDER.map((k) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <PrepChip status={k} />{PREP[k].note}
          </span>
        ))}
      </div>

      {confirmReady && (
        <Modal title={`Mark ${chosen.length} sector${chosen.length === 1 ? '' : 's'} ready?`} icon="circle-check" iconColor="var(--brand-primary)"
          onClose={() => setConfirmReady(false)}
          footer={<>
            <Button ghost onClick={() => setConfirmReady(false)}>Cancel</Button>
            <Button icon="circle-check" disabled={!drafts} onClick={() => {
              chosen.forEach((s) => opsStore().saveSector(s.id, markDraftsReady));
              setConfirmReady(false);
              setSel({});
            }}>{drafts ? `Mark ${drafts} draft${drafts === 1 ? '' : 's'} ready` : 'Nothing to mark'}</Button>
          </>}>
          <div className="modal__body">
            {drafts
              ? <>Every plan and block in draft on the selected sectors moves to Ready, waiting for sign-off. Items not started stay as they are: there is nothing to mark ready yet.</>
              : <>None of the selected sectors has anything in draft. Items not started need content before they can be ready, and ready or approved items are already done.</>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function countDrafts(list: Sector[]) {
  let n = 0;
  list.forEach((s) => {
    n += planRoll(s).plans.filter((p) => p.status === 'draft').length;
    (['mainMat', 'netMat', 'instr', 'info', 'install', 'link'] as const).forEach((k) => { if (s.blocks[k].on && s.blocks[k].status === 'draft') n++; });
    n += s.custom.filter((c) => c.on && c.status === 'draft').length;
  });
  return n;
}

function markDraftsReady(s: Sector) {
  const up = (st: PrepStatus): PrepStatus => (st === 'draft' ? 'ready' : st);
  Object.values(s.plans).forEach((p) => { if (p.required) p.status = up(p.status); });
  (['mainMat', 'netMat', 'instr', 'info', 'install', 'link'] as const).forEach((k) => { if (s.blocks[k].on) s.blocks[k].status = up(s.blocks[k].status); });
  s.custom.forEach((c) => { if (c.on) c.status = up(c.status); });
}

function SectorRow({ s, people, selected, onSelect, expand, setExpand, open, canEdit }: {
  s: Sector; people: Parameters<typeof personName>[0]; selected: boolean; onSelect: () => void;
  expand: Expand; setExpand: (e: Expand) => void; open: (s: Sector, hash?: string) => void; canEdit: boolean;
}) {
  const navigate = useNavigate();
  const fp = planRoll(s);
  const other = otherRoll(s);
  const fpOpen = expand === `${s.id}|fp`;
  const otherOpen = expand === `${s.id}|other`;
  const toggle = (k: 'fp' | 'other') => setExpand(expand === `${s.id}|${k}` ? null : `${s.id}|${k}`);

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <td style={{ padding: '3px 16px' }}><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${s.name}`} /></td>
        <td style={{ padding: '3px 16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
            <button type="button" className="name-btn" onClick={() => open(s)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto' }}>{s.name}</button>
            {isBlocked(s) && <span className="flag-blocked"><Icon fa="circle-exclamation" size={10} />Blocked</span>}
            <BuildTag status={s.build} style={{ marginLeft: 'auto' }} />
          </span>
        </td>
        <td style={{ padding: '3px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {s.ownerId ? personName(people, s.ownerId) : <span className="unassigned">Unassigned</span>}
        </td>
        <td>
          {fp.total > 0
            ? <Roll segs={fp.plans} label={`${fp.ready}/${fp.total}`} open={fpOpen} onClick={() => toggle('fp')}
                title={`${fp.ready} of ${fp.total} required plans ready — click to open the list`} />
            : <span className="mono muted" style={{ fontSize: 13 }} title={s.noFloorplans ? `${s.name} requires no floorplan` : 'No plans chosen yet — open the sector to choose which plans it needs'}>{s.noFloorplans ? '—' : 'Not set'}</span>}
        </td>
        {(['mainMat', 'instr'] as const).map((k) => (
          <td key={k}>
            {s.blocks[k].on
              ? <PrepChip status={s.blocks[k].status} onClick={() => open(s, k === 'mainMat' ? '#material' : '#steps')}
                  title={`${k === 'mainMat' ? 'Main Material List' : 'Instructions'} · ${PREP[s.blocks[k].status].label} · ${personName(people, s.ownerId)}`} />
              : <span className="na-dash" title={`${s.name} does not use ${k === 'mainMat' ? 'a material list' : 'instructions'}`}>—</span>}
          </td>
        ))}
        <td>
          {other.total > 0
            ? <Roll segs={other.items} label={`${other.ready}/${other.total}`} open={otherOpen} onClick={() => toggle('other')}
                title={`${other.ready} of ${other.total} other items ready — click to open the list`} />
            : <span className="na-dash" style={{ width: 100, textAlign: 'left' }} title="This sector has no other blocks">—</span>}
        </td>
      </tr>
      {fpOpen && (
        <ExpandRow title={`Required floorplans · ${s.name}`}
          items={fp.plans.map((p) => ({
            key: p.key, name: p.name, status: p.status,
            missing: !isReady(p.status) || !p.hasFile ? (p.status === 'draft' ? 'PDF not released' : 'No PDF uploaded') : null,
            action: canEdit ? 'Edit plan' : 'Open plan',
            go: () => navigate(`/sectors/${s.id}?plan=${p.key}${canEdit ? '&edit=1' : ''}`)
          }))} />
      )}
      {otherOpen && (
        <ExpandRow title={`Other items · ${s.name}`}
          items={other.items.map((i) => ({
            key: i.key, name: i.name, status: i.status,
            missing: isReady(i.status) ? null : i.status === 'draft' ? 'Not released' : 'Nothing added yet',
            action: 'Open block',
            go: () => open(s, `#block-${i.key}`)
          }))} />
      )}
    </>
  );
}

function Roll({ segs, label, open, onClick, title }: { segs: { status: PrepStatus; name: string }[]; label: string; open: boolean; onClick: () => void; title: string }) {
  return (
    <button type="button" className="roll" aria-expanded={open} onClick={onClick} title={title}>
      <Segments items={segs} />
      <span className="roll__label">{label}</span>
      <Icon fa={open ? 'chevron-up' : 'chevron-down'} size={10} style={{ color: 'var(--icon-tertiary)' }} />
    </button>
  );
}

function ExpandRow({ title, items }: { title: string; items: { key: string; name: string; status: PrepStatus; missing: string | null; action: string; go: () => void }[] }) {
  return (
    <tr style={{ background: 'var(--color-neutral-surface-100)', borderBottom: '1px solid var(--border-subtle)' }}>
      <td />
      <td colSpan={6} style={{ padding: '10px 16px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="overline overline--secondary">{title}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((p) => (
              <div key={p.key} style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-neutral-white)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '8px 10px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text-primary)' }}>
                  {p.name}
                  {p.missing && <span style={{ display: 'block', fontSize: 12, color: 'var(--feedback-danger-text)' }}>{p.missing}</span>}
                </span>
                <PrepChip status={p.status} />
                <button type="button" onClick={p.go} style={{ minHeight: 30, padding: '0 10px', border: '1px solid var(--brand-primary)', borderRadius: 4, background: 'var(--color-neutral-white)', color: 'var(--brand-primary)', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{p.action}</button>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}
