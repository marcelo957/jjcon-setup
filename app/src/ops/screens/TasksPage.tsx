import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { Select } from '../../ds/Select';
import { useMe } from '../access';
import { activeSectors, dateLabel, personName, sortPeople } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import { dueNote, TASK_TYPES, taskRows, toIsoDay, type TaskRow, type TaskType, uploadPath } from '../data/tasks';
import { PageHead } from '../ui/bits';
import { PersonPicker } from '../ui/PersonPicker';
import type { Person } from '../data/types';

type SortKey = 'natural' | 'sector' | 'item' | 'status' | 'due' | 'who';

/** "Who owes what, and when?": every item the active sectors require, as one list. */
export function TasksPage() {
  const data = useOps();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'natural', dir: 1 });
  const [sel, setSel] = useState<Record<string, boolean>>({});

  const status = (params.get('status') ?? 'all') as 'all' | 'done' | 'open';
  const person = params.get('person') ?? 'all';
  const sectorId = params.get('sector') ?? 'all';
  const type = (params.get('type') ?? 'all') as TaskType | 'all';
  const late = params.get('late') === '1';
  const setParam = (k: string, v: string | null) => setParams((p) => { if (v === null) p.delete(k); else p.set(k, v); return p; }, { replace: true });
  const clearFilters = () => setParams({}, { replace: true });

  const today = toIsoDay(new Date());
  const all = taskRows(data, today);
  const sectors = activeSectors(data);
  const people = sortPeople(data.people.filter((p) => p.active));
  const pn = (id: string) => personName(data.people, id);

  let list = all.filter((r) =>
    (person === 'all' || r.who === (person === '__un' ? '' : person))
    && (sectorId === 'all' || r.sectorId === sectorId)
    && (type === 'all' || r.type === type)
    && (status === 'all' || (status === 'done' ? r.done : !r.done))
    && (!late || r.late));
  const cmp: Record<SortKey, (a: TaskRow, b: TaskRow) => number> = {
    natural: () => 0,
    sector: (a, b) => a.sector.localeCompare(b.sector),
    item: (a, b) => a.item.localeCompare(b.item),
    status: (a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1),
    due: (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0),
    who: (a, b) => pn(a.who).localeCompare(pn(b.who))
  };
  list = list.slice().sort((a, b) => cmp[sort.key](a, b) * sort.dir || a.ord - b.ord);

  const chips: { label: string; clear: () => void }[] = [];
  if (status !== 'all') chips.push({ label: `Status · ${status === 'done' ? 'Done' : 'Not done'}`, clear: () => setParam('status', null) });
  if (person !== 'all') chips.push({ label: `Person · ${person === '__un' ? 'Unassigned' : pn(person)}`, clear: () => setParam('person', null) });
  if (sectorId !== 'all') chips.push({ label: `Sector · ${sectors.find((s) => s.id === sectorId)?.name ?? 'Unknown'}`, clear: () => setParam('sector', null) });
  if (type !== 'all') chips.push({ label: `Item · ${TASK_TYPES.find((t) => t.id === type)?.label}`, clear: () => setParam('type', null) });
  if (late) chips.push({ label: 'Late only', clear: () => setParam('late', null) });

  const chosen = list.filter((r) => sel[r.key]);
  const keys = chosen.map((r) => r.key);
  const dueOf = (k: string) => all.find((r) => r.key === k)!.due;
  const mine = person === me.id;

  const summary = (['floorplan', 'material', 'instructions', 'other'] as TaskType[]).map((t) => {
    const f = list.filter((r) => r.type === t), a = all.filter((r) => r.type === t);
    return {
      t, label: { floorplan: 'Floorplans ready · required plans', material: 'Material lists ready', instructions: 'Instruction sets ready', other: 'Other items ready' }[t],
      n: f.filter((r) => r.done).length, of: f.length, an: a.filter((r) => r.done).length, aof: a.length
    };
  });

  const head = (key: SortKey, label: string, style?: React.CSSProperties) => {
    const on = sort.key === key;
    return (
      <th style={{ textAlign: 'left', padding: '10px 16px', ...style }} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }))}
          style={{ font: 'var(--ib-text-overline)', letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: on ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
          {label}<Icon fa={on ? (sort.dir === 1 ? 'IconFilledSortAmountUpAlt' : 'IconFilledSortAmountDown') : 'sort'} size={11} style={{ color: on ? 'var(--brand-primary)' : 'var(--color-neutral-gray-300)' }} />
        </button>
      </th>
    );
  };

  return (
    <div>
      <PageHead
        overline="Office · assignments"
        title="Tasks"
        lead="Every item the active sectors require, as one list. Who owes what, and when it is due."
        actions={<>
          <Button variant="neutral" outlined icon="table-cells" onClick={() => navigate('/prep')}>Prep dashboard</Button>
          <Button icon="user-check" outlined={mine} onClick={() => setParam('person', mine ? null : me.id)}>My tasks</Button>
        </>}
      />

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 12, overflow: 'hidden' }}>
        {summary.map((c) => (
          <div key={c.t} style={{ flex: '1 1 0', minWidth: 150, boxSizing: 'border-box', padding: '14px 20px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="mono" style={{ fontSize: 28, lineHeight: '34px', color: 'var(--brand-primary)' }}>{c.n}</span>
              <span className="mono muted" style={{ fontSize: 14 }}>of {c.of}</span>
            </div>
            <div className="overline" style={{ flex: 1, marginTop: 2, lineHeight: '16px' }}>{c.label}</div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--color-neutral-surface-500)', marginTop: 8 }}>
              <div style={{ height: '100%', width: `${c.of ? Math.round(c.n / c.of * 100) : 0}%`, borderRadius: 2, background: 'var(--brand-primary)' }} />
            </div>
            <div className="mono muted" style={{ fontSize: 11, marginTop: 6 }}>{c.an} of {c.aof} across all sectors</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div role="group" aria-label="Status" style={{ display: 'inline-flex', border: '1px solid var(--border-divider)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-neutral-white)' }}>
          {([['all', 'All', 'list'], ['done', 'Done', 'circle-check'], ['open', 'Not done', 'circle']] as const).map(([v, label, icon], i) => {
            const on = status === v;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => setParam('status', v === 'all' ? null : v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 14px', border: 0, borderRight: i < 2 ? '1px solid var(--border-divider)' : 0, background: on ? 'var(--brand-primary)' : 'var(--color-neutral-white)', color: on ? 'var(--color-neutral-white)' : 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer' }}>
                <Icon fa={icon} size={11} />{label}
              </button>
            );
          })}
        </div>
        <Select label="Person" value={person} width={170} onChange={(v) => setParam('person', v === 'all' ? null : v)}
          options={[{ value: 'all', label: 'All people' }, ...people.map((p) => ({ value: p.id, label: p.name })), { value: '__un', label: 'Unassigned' }]} />
        <Select label="Sector" value={sectorId} width={210} onChange={(v) => setParam('sector', v === 'all' ? null : v)}
          options={[{ value: 'all', label: 'All sectors' }, ...sectors.map((s) => ({ value: s.id, label: s.name }))]} />
        <Select label="Item type" value={type} width={180} onChange={(v) => setParam('type', v === 'all' ? null : v)}
          options={[{ value: 'all', label: 'All item types' }, ...TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))]} />
        <Button size="small" variant="danger" outlined={!late} icon="circle-exclamation" onClick={() => setParam('late', late ? null : '1')}>Late only</Button>
        <Button size="small" variant="neutral" outlined={sort.key !== 'natural'} icon="list-ol" onClick={() => setSort({ key: 'natural', dir: 1 })}>Sector order</Button>
        <span className="mono muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{list.length} of {all.length} items</span>
      </div>

      {chips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="overline">Filters</span>
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 30, padding: '0 10px', border: '1px solid var(--brand-primary)', borderRadius: 999, background: 'var(--color-neutral-white)', color: 'var(--brand-primary)', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer' }}>
              {c.label}<Icon fa="xmark" size={11} />
            </button>
          ))}
          <button type="button" onClick={clearFilters} className="muted" style={{ border: 0, background: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Clear all</button>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {list.length > 0 && (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-divider)' }}>
                  {me.canReassign && <th style={{ padding: '10px 16px', width: 40 }}><span className="sr-only">Select</span></th>}
                  {head('sector', 'Sector', { width: 230 })}
                  {head('item', 'Item', { minWidth: 360 })}
                  {head('status', 'Status', { width: 200 })}
                  {head('due', 'Deadline', { width: 170 })}
                  {head('who', 'Responsible', { width: 160 })}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => <Row key={r.key} r={r} me={me} people={data.people} navigate={navigate} selected={!!sel[r.key]} onSelect={() => setSel((v) => ({ ...v, [r.key]: !v[r.key] }))} />)}
              </tbody>
            </table>
          </div>
        )}
        {!list.length && late && status === 'done' && (
          <Empty icon="circle-check" title="Nothing matches" text="A done item is no longer late, so Done and Late only never overlap. Drop one of the two to see results."
            actions={<>
              <Button size="small" variant="neutral" outlined icon="circle-check" onClick={() => setParam('late', null)}>Show all done</Button>
              <Button size="small" variant="neutral" outlined icon="circle-exclamation" onClick={() => setParam('status', 'open')}>Show late items</Button>
            </>} />
        )}
        {!list.length && late && status !== 'done' && (
          <Empty icon="circle-check" iconColor="var(--feedback-success-text)" title="Nothing is overdue"
            text={chips.length > 1 ? 'Nothing overdue matches the other filters you have set. Everything still open there is inside its deadline.' : 'Every item still open is inside its deadline. Turn off the late filter to see the rest of the list.'}
            actions={<Button size="small" variant="neutral" outlined onClick={() => setParam('late', null)}>Show all items</Button>} />
        )}
        {!list.length && !late && (
          <Empty icon="filter-circle-xmark" title="No items match these filters" text="Widen the person, sector or item type, or clear the filters to see the full list."
            actions={<Button size="small" variant="neutral" outlined onClick={clearFilters}>Clear filters</Button>} />
        )}
        {me.canReassign && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--color-neutral-surface-50)' }}>
            <span className="muted" style={{ fontSize: 13 }}>{chosen.length ? `${chosen.length} selected` : 'Select rows to reassign or move a deadline'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <div style={{ width: 200 }}>
                <PersonPicker people={data.people} action actionLabel="Reassign selected to…" disabled={!chosen.length}
                  onPick={(id) => opsStore().setTaskWho(keys, id, me.id)}
                  onAdd={(n) => opsStore().setTaskWho(keys, opsStore().addPerson(n), me.id)} />
              </div>
              <Button size="small" variant="neutral" outlined icon="angles-left" disabled={!chosen.length} onClick={() => opsStore().shiftTaskDue(keys, -3, me.id, dueOf)}>3 days earlier</Button>
              <Button size="small" variant="neutral" outlined icon="angles-right" disabled={!chosen.length} onClick={() => opsStore().shiftTaskDue(keys, 3, me.id, dueOf)}>3 days later</Button>
              <Button size="small" variant="neutral" outlined icon="angles-right" disabled={!chosen.length} onClick={() => opsStore().shiftTaskDue(keys, 7, me.id, dueOf)}>7 days later</Button>
              <Button size="small" ghost disabled={!chosen.length} onClick={() => setSel({})}>Clear selection</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ icon, iconColor = 'var(--border-divider)', title, text, actions }: { icon: string; iconColor?: string; title: string; text: string; actions: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon fa={icon} size={44} style={{ color: iconColor }} />
      <div className="empty__title" style={{ fontSize: 22, marginTop: 12 }}>{title}</div>
      <div className="empty__text" style={{ maxWidth: 460 }}>{text}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>{actions}</div>
    </div>
  );
}

function Row({ r, selected, onSelect, me, people, navigate }: {
  r: TaskRow; selected: boolean; onSelect: () => void; me: ReturnType<typeof useMe>; people: Person[]; navigate: ReturnType<typeof useNavigate>;
}) {
  const pn = (id: string) => personName(people, id);
  // Uploads are done by the file alone: no box to tick, just the way to the upload.
  const canDone = !r.auto && me.canMarkTask(r.who);
  const canUpload = r.auto && me.canEditSector(opsStore().sector(r.sectorId)!);
  const canDue = me.canSetDeadline(r.who);
  const note = dueNote(r);
  const open = (hash = '') => navigate(`/sectors/${r.sectorId}${hash}`);
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: selected ? 'var(--color-neutral-surface-100)' : 'var(--color-neutral-white)' }}>
      {me.canReassign && <td style={{ padding: '6px 16px' }}><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${r.sector}, ${r.item}`} /></td>}
      <td style={{ padding: '6px 16px' }}><button type="button" className="name-btn" style={{ fontSize: 16, whiteSpace: 'nowrap' }} onClick={() => open()}>{r.sector}</button></td>
      <td style={{ padding: '6px 16px' }}><button type="button" className="link-btn" style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap' }} onClick={() => open(r.hash)}>{r.item}</button></td>
      <td style={{ padding: '6px 16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canDone && (
            <button type="button" role="checkbox" aria-checked={r.done} aria-label={`${r.sector}, ${r.item} done`} className="checkbox-box" style={{ width: 20, height: 20, flexBasis: 20 }}
              onClick={() => opsStore().setTaskDone([r.key], !r.done, me.id)}>
              <Icon fa="check" size={11} />
            </button>
          )}
          {r.auto && <Icon fa={r.done ? 'circle-check' : 'file-circle-exclamation'} size={14} label={r.done ? 'Uploaded' : 'No PDF yet'} style={{ color: r.done ? 'var(--feedback-success-text)' : 'var(--color-neutral-gray-300)' }} />}
          <span className="overline" style={{ color: r.done ? 'var(--feedback-success-text)' : undefined }}>{r.done ? 'Done' : 'Not done'}</span>
          {canUpload && !r.done && <button type="button" className="link-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => navigate(uploadPath(r))}>Upload PDF</button>}
        </span>
        {r.auto && !r.done && <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap' }}>Done when the PDF is uploaded</span>}
        {r.done && <span className="mono" style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap' }}>{pn(r.doneBy)} · {dateLabel(r.doneAt)}</span>}
      </td>
      <td style={{ padding: '6px 16px' }}>
        {canDue ? (
          <input type="date" value={r.due} aria-label={`Deadline for ${r.sector}, ${r.item}`} onChange={(e) => { if (e.target.value) opsStore().setTaskDue([r.key], e.target.value, me.id); }}
            style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 13, width: 132, background: 'var(--color-neutral-white)', borderRadius: 4, padding: '4px 6px', cursor: 'pointer',
              border: `1px solid ${r.late ? 'var(--feedback-danger-text)' : r.soon ? 'var(--feedback-warning-accent)' : 'var(--border-subtle)'}`,
              color: r.late ? 'var(--feedback-danger-text)' : 'var(--text-primary)', fontWeight: r.late ? 600 : 400 }} />
        ) : (
          <span className="mono" style={{ fontSize: 13, color: r.late ? 'var(--feedback-danger-text)' : 'var(--text-primary)', fontWeight: r.late ? 600 : 400 }}>{dateLabel(`${r.due}T12:00:00`)}</span>
        )}
        {note && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, marginTop: 2, color: r.late ? 'var(--feedback-danger-text)' : 'var(--text-primary)' }}>
            <Icon fa={r.late ? 'circle-exclamation' : 'clock'} size={10} style={{ color: r.late ? 'var(--feedback-danger-text)' : 'var(--feedback-warning-accent)' }} />{note}
          </span>
        )}
      </td>
      <td style={{ padding: '6px 16px' }}>
        {me.canReassign ? (
          <div style={{ width: 150 }}>
            <PersonPicker label={`Responsible for ${r.sector}, ${r.item}`} people={people} value={r.who}
              onPick={(id) => opsStore().setTaskWho([r.key], id, me.id)} onAdd={(n) => opsStore().setTaskWho([r.key], opsStore().addPerson(n), me.id)} />
          </div>
        ) : r.who ? <span style={{ fontSize: 13 }}>{pn(r.who)}</span> : <span className="unassigned">Unassigned</span>}
      </td>
    </tr>
  );
}
