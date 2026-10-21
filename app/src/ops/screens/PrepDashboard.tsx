import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { SearchInput, Select } from '../../ds/Select';
import { EVENT_NAME, VENUE } from '../../config';
import { useMe } from '../access';
import { blockState, isFinal } from '../data/content';
import { GROUPS } from '../data/meta';
import { taskKey, taskRows, toIsoDay } from '../data/tasks';
import { activeSectors, dateLabel, isBlocked, isComplete, otherRoll, personName, planRoll, sortPeople } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import type { Sector } from '../data/types';
import { BuildTag, ContentChip, IconBtn, PageHead, Segments, UploadChip } from '../ui/bits';
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

  const active = activeSectors(data);
  // Whether each item is past its deadline with nothing there, from the same rows Tasks shows.
  const today = toIsoDay(new Date());
  const tasks = new Map(taskRows(data, today).map((r) => [r.key, r]));
  const lateOf = (sid: string, slot: string) => !!tasks.get(taskKey(sid, slot))?.late;
  const people = sortPeople(data.people.filter((p) => p.active));
  const needle = q.trim().toLowerCase();
  const visible = active.filter((s) =>
    (!needle || s.name.toLowerCase().includes(needle) || personName(data.people, s.ownerId).toLowerCase().includes(needle))
    && (owner === 'all' || s.ownerId === (owner === '__un' ? '' : owner))
    && (!incomplete || !isComplete(s)));

  const chosen = active.filter((s) => sel[s.id]);
  const allSelected = visible.length > 0 && visible.every((s) => sel[s.id]);
  const open = (s: Sector, hash = '') => navigate(`/sectors/${s.id}${hash}`);

  return (
    <div>
      <PageHead
        overline="Office · content preparation"
        title="Prep dashboard"
        lead={`${EVENT_NAME} · ${VENUE}. Every sector needs a floorplan, a material list and setup instructions before load-in.`}
        actions={<>
          <Button variant="neutral" outlined icon="mobile-screen-button" onClick={() => navigate('/field')}>Field view</Button>
          <Button variant="neutral" outlined icon="print" onClick={() => navigate('/print')}>Print packets</Button>
          {me.canManageSectors && <Button icon="plus" onClick={() => navigate('/sectors/new')}>Add sector</Button>}
        </>}
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
          <table className="data-table" style={{ minWidth: 1370 }}>
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
                <th style={{ width: 100, padding: '10px 16px', textAlign: 'right' }}>Packet</th>
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
                      <td colSpan={7} className="overline--secondary" style={{ font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase', padding: '6px 16px', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon fa={g.icon} size={11} style={{ color: 'var(--icon-tertiary)' }} />{g.name}
                          <span className="mono muted" style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>{rows.length}</span>
                        </span>
                      </td>
                    </tr>
                    {rows.map((s) => (
                      <SectorRow key={s.id} s={s} people={data.people} selected={!!sel[s.id]}
                        onSelect={() => setSel((v) => ({ ...v, [s.id]: !v[s.id] }))}
                        expand={expand} setExpand={setExpand} open={open} lateOf={(slot) => lateOf(s.id, slot)}
                        canEdit={me.canEditSector(s)} />
                    ))}
                  </Fragment>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={8}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--color-neutral-surface-50)' }}>
          <span className="muted" style={{ fontSize: 13 }}>{chosen.length ? `${chosen.length} selected` : 'Select sectors for a bulk action'}</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
            {me.canManageSectors && <>
              <div style={{ width: 160 }}>
                <PersonPicker people={data.people} action actionLabel="Assign owner" disabled={!chosen.length}
                  onPick={(id) => { chosen.forEach((s) => opsStore().saveSector(s.id, (x) => { x.ownerId = id; })); }}
                  onAdd={(name) => { const id = opsStore().addPerson(name); chosen.forEach((s) => opsStore().saveSector(s.id, (x) => { x.ownerId = id; })); }} />
              </div>
            </>}
            <Button size="small" icon="print" disabled={!chosen.length} onClick={() => navigate(`/print?sel=${chosen.map((s) => s.id).join(',')}&sector=${chosen[0].id}`)}>Print packets</Button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, padding: '12px 16px', background: 'var(--color-neutral-white)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <span className="overline">What the columns show</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><ContentChip summary="12 items" />written: what it holds</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><ContentChip summary="" />nothing written yet</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><ContentChip summary="" late />empty past its deadline</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><ContentChip summary="8 steps" final />marked final, locked</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><span className="segs"><span className="seg seg--in" /><span className="seg" /><span className="seg seg--late" /></span>uploaded · missing · missing and late</span>
      </div>

    </div>
  );
}

function SectorRow({ s, people, selected, onSelect, expand, setExpand, open, canEdit, lateOf }: {
  s: Sector; people: Parameters<typeof personName>[0]; selected: boolean; onSelect: () => void;
  expand: Expand; setExpand: (e: Expand) => void; open: (s: Sector, hash?: string) => void; canEdit: boolean;
  lateOf: (slot: string) => boolean;
}) {
  const navigate = useNavigate();
  const fp = planRoll(s);
  const other = otherRoll(s);
  const plans = fp.plans.map((p) => ({ ...p, kind: 'upload' as const, late: !p.done && lateOf(p.key) }));
  const others = other.items.map((i) => ({ ...i, late: !i.done && lateOf(i.key) }));
  const fpLate = plans.filter((p) => p.late).length;
  // Written blocks: count what needs attention (late, then empty), not what's "done".
  const oLate = others.filter((i) => i.late).length;
  const oEmpty = others.filter((i) => !i.done && !i.late).length;
  const oLabel = oLate || oEmpty ? [oLate && `${oLate} late`, oEmpty && `${oEmpty} empty`].filter(Boolean).join(' · ') : 'All in';
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
            ? <Roll segs={plans} label={`${fp.done}/${fp.total}`} late={fpLate > 0} open={fpOpen} onClick={() => toggle('fp')}
                title={`${fp.done} of ${fp.total} required plans uploaded${fpLate ? `, ${fpLate} missing past the deadline` : ''} — click to open the list`} />
            : <span className="mono muted" style={{ fontSize: 13 }} title={s.noFloorplans ? `${s.name} requires no floorplan` : 'No plans chosen yet — open the sector to choose which plans it needs'}>{s.noFloorplans ? '—' : 'Not set'}</span>}
        </td>
        {(['mainMat', 'instr'] as const).map((k) => {
          const st = blockState(s.blocks, k);
          const what = k === 'mainMat' ? 'Main material list' : 'Instructions';
          return (
            <td key={k}>
              {s.blocks[k].on
                ? <ContentChip summary={st.summary} late={st.empty && lateOf(k)} final={isFinal(st.meta)} onClick={() => open(s, k === 'mainMat' ? '#material' : '#steps')}
                    title={`${what} · ${st.summary || (lateOf(k) ? 'empty past its deadline' : 'empty')}${st.meta.edited ? ` · last edited by ${personName(people, st.meta.edited.by)} ${dateLabel(st.meta.edited.at)}` : ''}`} />
                : <span className="na-dash" title={`${s.name} does not use ${k === 'mainMat' ? 'a material list' : 'instructions'}`}>—</span>}
            </td>
          );
        })}
        <td>
          {other.total > 0
            ? <Roll segs={others} label={oLabel} late={oLate > 0} quiet={!oLate && !oEmpty} open={otherOpen} onClick={() => toggle('other')}
                title={`${oLabel} — click to open the list`} />
            : <span className="na-dash" style={{ width: 100, textAlign: 'left' }} title="This sector has no other blocks">—</span>}
        </td>
        <td style={{ padding: '3px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <IconBtn fa="mobile-screen-button" label={`Open ${s.name} in field view`} onClick={() => navigate(`/field/${s.id}`)} />
            <IconBtn fa="print" label={`Preview the ${s.name} print packet`} onClick={() => navigate(`/print?sector=${s.id}`)} />
          </span>
        </td>
      </tr>
      {fpOpen && (
        <ExpandRow title={`Required floorplans · ${s.name}`}
          items={plans.map((p) => ({
            key: p.key, name: p.name, kind: 'upload' as const, done: p.done, late: p.late, summary: '', final: false,
            missing: p.done ? null : p.late ? 'No PDF uploaded · past its deadline' : 'No PDF uploaded',
            action: canEdit ? 'Edit plan' : 'Open plan',
            go: () => navigate(`/sectors/${s.id}?plan=${p.key}${canEdit ? '&edit=1' : ''}`)
          }))} />
      )}
      {otherOpen && (
        <ExpandRow title={`Other items · ${s.name}`}
          items={others.map((i) => ({
            key: i.key, name: i.name, kind: i.kind, done: i.done, late: i.late, summary: i.summary, final: i.final,
            missing: i.done ? null : `${i.kind === 'upload' ? 'No PDF uploaded' : 'Nothing written yet'}${i.late ? ' · past its deadline' : ''}`,
            action: 'Open block',
            go: () => open(s, `#block-${i.key}`)
          }))} />
      )}
    </>
  );
}

function Roll({ segs, label, late, quiet, open, onClick, title }: {
  segs: Parameters<typeof Segments>[0]['items']; label: string; late?: boolean; quiet?: boolean; open: boolean; onClick: () => void; title: string;
}) {
  return (
    <button type="button" className="roll" aria-expanded={open} onClick={onClick} title={title}>
      <Segments items={segs} />
      <span className="roll__label" style={late ? { color: 'var(--feedback-danger-text)', fontWeight: 600 } : quiet ? { color: 'var(--color-neutral-gray-300)' } : undefined}>{label}</span>
      <Icon fa={open ? 'chevron-up' : 'chevron-down'} size={10} style={{ color: 'var(--icon-tertiary)' }} />
    </button>
  );
}

function ExpandRow({ title, items }: {
  title: string;
  items: { key: string; name: string; kind: 'upload' | 'content'; done: boolean; late: boolean; summary: string; final: boolean; missing: string | null; action: string; go: () => void }[];
}) {
  return (
    <tr style={{ background: 'var(--color-neutral-surface-100)', borderBottom: '1px solid var(--border-subtle)' }}>
      <td />
      <td colSpan={7} style={{ padding: '10px 16px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="overline overline--secondary">{title}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((p) => (
              <div key={p.key} style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-neutral-white)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '8px 10px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text-primary)' }}>
                  {p.name}
                  {p.missing && <span style={{ display: 'block', fontSize: 12, color: p.late ? 'var(--feedback-danger-text)' : 'var(--text-secondary)', fontWeight: p.late ? 600 : 400 }}>{p.missing}</span>}
                </span>
                {p.kind === 'upload' ? <UploadChip done={p.done} late={p.late} /> : <ContentChip summary={p.summary} late={p.late} final={p.final} />}
                <button type="button" onClick={p.go} style={{ minHeight: 30, padding: '0 10px', border: '1px solid var(--brand-primary)', borderRadius: 4, background: 'var(--color-neutral-white)', color: 'var(--brand-primary)', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{p.action}</button>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}
