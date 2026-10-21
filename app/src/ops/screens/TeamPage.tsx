import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { Select } from '../../ds/Select';
import { useMe } from '../access';
import { activeSectors, dateLabel, initials, personName, sortPeople } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import { dueNote, plural, shortDue, TASK_TYPES, taskRows, toIsoDay, type TaskRow, type TaskType, uploadPath, writePath } from '../data/tasks';
import type { OpsData, Person } from '../data/types';
import { PageHead } from '../ui/bits';
import { PersonPicker } from '../ui/PersonPicker';

const LIMIT = 6;
const PRESENT_LIMIT = 8;
const isWeek = (r: TaskRow) => !r.late && r.daysLeft >= 0 && r.daysLeft <= 6;
const when = (r: TaskRow) => { const n = dueNote(r, 6); return n ? n[0].toUpperCase() + n.slice(1) : ''; };

interface Bucket { id: string; items: TaskRow[]; overdue: number; week: number }

/** One card per person, most behind first: the agenda for the weekly planning meeting. Only work not done. */
export function TeamPage() {
  const data = useOps();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [presenting, setPresenting] = useState<number | null>(null);

  const person = params.get('person') ?? 'all';
  const sectorId = params.get('sector') ?? 'all';
  const type = (params.get('type') ?? 'all') as TaskType | 'all';
  const overdue = params.get('overdue') === '1';
  const from = params.get('from');
  const setParam = (k: string, v: string | null) => setParams((p) => { if (v === null) p.delete(k); else p.set(k, v); return p; }, { replace: true });
  const filtered = sectorId !== 'all' || type !== 'all';
  const tail = filtered ? ' in this view' : '';

  const today = toIsoDay(new Date());
  const open = taskRows(data, today).filter((r) => !r.done
    && (sectorId === 'all' || r.sectorId === sectorId)
    && (type === 'all' || r.type === type)
    && (!overdue || r.late));
  const pn = (id: string) => personName(data.people, id);

  // Everyone active, plus anyone inactive who still holds open work so it can't hide.
  const ids = sortPeople(data.people.filter((p) => p.active)).map((p) => p.id);
  open.forEach((r) => { if (r.who && !ids.includes(r.who)) ids.push(r.who); });
  const buckets: Bucket[] = [...ids, ''].map((id) => {
    const items = open.filter((r) => r.who === id).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.ord - b.ord));
    return { id, items, overdue: items.filter((r) => r.late).length, week: items.filter(isWeek).length };
  });
  const un = buckets.find((b) => b.id === '')!;
  const named = buckets.filter((b) => b.id !== '').sort((a, b) =>
    b.overdue - a.overdue || b.week - a.week || b.items.length - a.items.length || pn(a.id).localeCompare(pn(b.id)));
  const ordered = (un.items.length ? [un, ...named] : [...named, un])
    .filter((b) => person === 'all' || (person === '__un' ? b.id === '' : b.id === person));

  const totOver = open.filter((r) => r.late).length;
  const totWeek = open.filter(isWeek).length;
  const snapshot = snapshotLabel(data);


  return (
    <div>
      <PageHead
        overline="Office · weekly planning"
        title="Team"
        lead="What each person still owes, most behind first. Completed items are left out."
        actions={<Button icon="display" onClick={() => setPresenting(0)} disabled={!ordered.length}>Present</Button>}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Select label="Person" value={person} width={170} onChange={(v) => setParam('person', v === 'all' ? null : v)}
          options={[{ value: 'all', label: 'All people' }, ...ids.slice().sort((a, b) => pn(a).localeCompare(pn(b))).map((id) => ({ value: id, label: pn(id) + (data.people.find((p) => p.id === id)?.active === false ? ' (inactive)' : '') })), { value: '__un', label: 'Unassigned' }]} />
        <Select label="Sector" value={sectorId} width={210} onChange={(v) => setParam('sector', v === 'all' ? null : v)}
          options={[{ value: 'all', label: 'All sectors' }, ...activeSectors(data).map((s) => ({ value: s.id, label: s.name }))]} />
        <Select label="Item type" value={type} width={180} onChange={(v) => setParam('type', v === 'all' ? null : v)}
          options={[{ value: 'all', label: 'All item types' }, ...TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))]} />
        <Button size="small" variant="danger" outlined={!overdue} icon="circle-exclamation" onClick={() => setParam('overdue', overdue ? null : '1')}>Overdue only</Button>
        {(filtered || overdue || person !== 'all') && (
          <button type="button" className="link-btn" style={{ fontSize: 13, padding: '0 4px' }} onClick={() => setParams({}, { replace: true })}>Clear filters</button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', padding: '6px 12px', border: '1px solid var(--border-divider)', borderRadius: 999, background: 'var(--color-neutral-white)', fontSize: 13, color: 'var(--text-secondary)' }}>
          <Icon fa="clock" outline size={12} /><span>{snapshot}</span>
        </div>
      </div>

      {from === 'people' && (
        <button type="button" className="link-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13 }} onClick={() => navigate(-1)}>
          <Icon fa="arrow-left" size={11} />Back to People
        </button>
      )}
      <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {totOver} overdue · {totWeek} due this week · {open.length} outstanding
      </div>

      {totOver === 0 && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 12, borderRadius: 8, background: 'var(--feedback-success-background)' }}>
          <Icon fa="circle-check" size={18} style={{ color: 'var(--feedback-success-text)' }} />
          <span style={{ fontSize: 14 }}><strong style={{ fontWeight: 600 }}>Nobody is overdue.</strong>{' '}
            {overdue ? `Nothing is past its deadline${tail}. Turn off Overdue only to see what is coming up.` : `${plural(open.length, 'item')} outstanding${tail}, none past its deadline.`}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        {ordered.map((b, i) => (
          <PersonCard key={b.id || '_un'} b={b} people={data.people} me={me} tail={tail} overdueOnly={overdue}
            showAll={!!more[b.id]} toggleMore={() => setMore((m) => ({ ...m, [b.id]: !m[b.id] }))}
            openKey={openKey} setOpenKey={setOpenKey} present={() => setPresenting(i)} />
        ))}
      </div>


      {presenting !== null && ordered.length > 0 && (
        <Presentation buckets={ordered} index={Math.min(presenting, ordered.length - 1)} setIndex={setPresenting} people={data.people} snapshot={snapshot} tail={tail} overdueOnly={overdue} />
      )}
    </div>
  );
}

function snapshotLabel(d: OpsData) {
  const u = d.tasksUpdated;
  if (!u) return 'No changes recorded yet';
  const at = new Date(u.at);
  const mins = (Date.now() - at.getTime()) / 60_000;
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()];
  const by = personName(d.people, u.by);
  return mins >= 0 && mins < 2 ? `Last updated just now by ${by}` : `Last updated ${day} ${dateLabel(u.at)} · ${time} by ${by}`;
}

function clearCopy(b: Bucket, name: string, tail: string, overdueOnly: boolean) {
  if (b.id === '') return { title: 'Nothing unassigned', text: `Every outstanding item has an owner${tail}.` };
  return overdueOnly ? { title: 'Nothing overdue', text: `${name} has no overdue items${tail}.` } : { title: 'All clear', text: `${name} has nothing outstanding${tail}.` };
}

function PersonCard({ b, people, me, tail, overdueOnly, showAll, toggleMore, openKey, setOpenKey, present }: {
  b: Bucket; people: Person[]; me: ReturnType<typeof useMe>; tail: string; overdueOnly: boolean; showAll: boolean; toggleMore: () => void;
  openKey: string | null; setOpenKey: (k: string | null) => void; present: () => void;
}) {
  const isUn = b.id === '';
  const rec = people.find((p) => p.id === b.id);
  const name = isUn ? 'Unassigned' : rec?.name ?? 'Unknown person';
  const clear = clearCopy(b, name, tail, overdueOnly);
  const keys = b.items.map((r) => r.key);
  return (
    <section aria-label={name} style={{ background: 'var(--color-neutral-white)', borderRadius: 12, boxShadow: 'var(--ib-elevation-1)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, border: isUn ? '1px dashed var(--icon-tertiary)' : '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isUn
          ? <span style={{ flex: '0 0 40px', height: 40, borderRadius: '50%', border: '1px dashed var(--icon-tertiary)', color: 'var(--color-neutral-gray-300)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon fa="user-slash" size={14} /></span>
          : <span aria-hidden="true" style={{ flex: '0 0 40px', height: 40, borderRadius: '50%', background: 'var(--color-neutral-surface-500)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto Condensed', sans-serif", fontSize: 15 }}>{initials(name)}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 400, fontFamily: "'Roboto Condensed', sans-serif", fontSize: 20, lineHeight: '24px' }}>{name}{rec && !rec.active && <span className="muted" style={{ fontSize: 13 }}> (inactive)</span>}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{isUn ? 'Items with no owner. Assign these first.' : rec?.role || 'Role not set'}</div>
        </div>
        {me.canReassign && b.items.length > 0 && (
          <div style={{ width: 140, flex: '0 0 140px' }}>
            <PersonPicker people={people} action actionLabel={isUn ? 'Assign all…' : 'Reassign all…'} exclude={b.id} allowUnassigned={!isUn}
              onPick={(id) => opsStore().setTaskWho(keys, id, me.id)} onAdd={(n) => opsStore().setTaskWho(keys, opsStore().addPerson(n), me.id)} />
          </div>
        )}
        <button type="button" onClick={present} title="Present from this person" aria-label={`Present from ${name}`}
          style={{ width: 32, height: 32, border: 0, borderRadius: 4, background: 'none', color: 'var(--color-neutral-gray-300)', cursor: 'pointer' }}>
          <Icon fa="display" size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 12, alignItems: 'end', padding: '10px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div><div className="mono" style={{ fontSize: 34, lineHeight: '38px', fontWeight: 600, color: b.overdue ? 'var(--feedback-danger-text)' : 'var(--color-neutral-gray-300)' }}>{b.overdue}</div><div className="overline" style={{ marginTop: 2 }}>Overdue</div></div>
        <div><div className="mono" style={{ fontSize: 22, lineHeight: '28px' }}>{b.week}</div><div className="overline" style={{ marginTop: 2 }}>Due this week</div></div>
        <div><div className="mono" style={{ fontSize: 22, lineHeight: '28px' }}>{b.items.length}</div><div className="overline" style={{ marginTop: 2 }}>Outstanding</div></div>
      </div>

      {!b.items.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 8, background: 'var(--color-neutral-surface-200)' }}>
          <Icon fa="circle-check" size={22} style={{ color: 'var(--feedback-success-text)' }} />
          <span><span style={{ display: 'block', fontFamily: "'Roboto Condensed', sans-serif", fontSize: 17 }}>{clear.title}</span><span style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)' }}>{clear.text}</span></span>
        </div>
      ) : (
        <>
          <ul style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none' }}>
            {(showAll ? b.items : b.items.slice(0, LIMIT)).map((r) => (
              <TeamItem key={r.key} r={r} me={me} people={people} open={openKey === r.key} toggle={() => setOpenKey(openKey === r.key ? null : r.key)} close={() => setOpenKey(null)} />
            ))}
          </ul>
          {b.items.length > LIMIT && (
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={toggleMore}>{showAll ? 'Show fewer' : `Show ${b.items.length - LIMIT} more`}</button>
          )}
        </>
      )}
    </section>
  );
}

function TeamItem({ r, me, people, open, toggle, close }: {
  r: TaskRow; me: ReturnType<typeof useMe>; people: Person[]; open: boolean; toggle: () => void; close: () => void;
}) {
  // Nothing is marked done by hand: the button goes straight to the work (upload or write).
  const canWork = me.canEditSector(opsStore().sector(r.sectorId)!);
  const workPath = r.kind === 'upload' ? uploadPath(r) : writePath(r);
  const workLabel = r.kind === 'upload' ? 'Upload PDF' : 'Write it';
  const navigate = useNavigate();
  const canDue = me.canSetDeadline(r.who);
  const canNote = me.canReassign || r.who === me.id;
  const canOpen = me.canReassign || canDue || canNote;
  const [draft, setDraft] = useState(r.note?.text ?? '');
  useEffect(() => { if (open) setDraft(r.note?.text ?? ''); }, [open]);
  const label = when(r);
  const body = (
    <>
      <span className="overline" style={{ display: 'block' }}>{r.sector}</span>
      <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{r.item}</span>
      {r.note && (
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4, fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)' }}>
          <Icon fa="comment" outline size={11} style={{ marginTop: 4 }} />
          <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty' }}>{r.note.text} <span className="muted">— {personName(people, r.note.by)} · {dateLabel(r.note.at)}</span></span>
        </span>
      )}
    </>
  );
  return (
    <li style={{ borderTop: '1px solid var(--border-subtle)', ...(open ? { background: 'var(--color-neutral-surface-200)', margin: '0 -16px', padding: '0 16px' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0' }}>
        {canWork ? (
          <button type="button" onClick={() => navigate(workPath)} title={workLabel} aria-label={`${workLabel}: ${r.sector}, ${r.item}`} className="team-done">
            <Icon fa={r.kind === 'upload' ? 'upload' : 'pen'} size={11} />
          </button>
        ) : <span style={{ flex: '0 0 26px' }} />}
        {canOpen
          ? <button type="button" onClick={toggle} aria-expanded={open} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{body}</button>
          : <div style={{ flex: 1, minWidth: 0 }}>{body}</div>}
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 13 }}>{shortDue(r.due)}</div>
          {label && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', color: r.late ? 'var(--feedback-danger-text)' : 'var(--text-secondary)' }}>{label}</div>}
        </div>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 14px 36px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {me.canReassign && (
              <div><span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Owner</span>
                <div style={{ width: 180 }}>
                  <PersonPicker label="Owner" people={people} value={r.who} onPick={(id) => { opsStore().setTaskWho([r.key], id, me.id); close(); }}
                    onAdd={(n) => { opsStore().setTaskWho([r.key], opsStore().addPerson(n), me.id); close(); }} />
                </div>
              </div>
            )}
            {canDue && (
              <label><span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Deadline</span>
                <input type="date" className="input input--mono" style={{ minHeight: 36, width: 150 }} value={r.due}
                  onChange={(e) => { if (e.target.value) opsStore().setTaskDue([r.key], e.target.value, me.id); }} /></label>
            )}
            {canWork && <Button size="small" icon={r.kind === 'upload' ? 'upload' : 'pen'} onClick={() => navigate(workPath)}>{workLabel}</Button>}
          </div>
          {canNote && (
            <>
              <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Note on the delay</span>
                <textarea className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Why it is late, and what happens next"
                  style={{ padding: '8px 10px', lineHeight: '20px', resize: 'vertical' }} /></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" icon="comment" onClick={() => { opsStore().setTaskNote(r.key, draft, me.id); close(); }}>{r.note ? 'Update note' : 'Save note'}</Button>
                {r.note && <Button size="small" ghost onClick={() => { opsStore().setTaskNote(r.key, '', me.id); setDraft(''); }}>Remove note</Button>}
                <Button size="small" ghost onClick={close}>Close</Button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Full-screen, one person at a time, readable from across a room. Arrow keys move, Esc exits. */
function Presentation({ buckets, index, setIndex, people, snapshot, tail, overdueOnly }: {
  buckets: Bucket[]; index: number; setIndex: (i: number | null) => void; people: Person[]; snapshot: string; tail: string; overdueOnly: boolean;
}) {
  const exitRef = useRef<HTMLButtonElement>(null);
  const b = buckets[index];
  const nameOf = (x: Bucket) => (x.id ? personName(people, x.id) : 'Unassigned');
  const rec = people.find((p) => p.id === b.id);
  const clear = clearCopy(b, nameOf(b), tail, overdueOnly);
  useEffect(() => {
    exitRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setIndex(Math.min(buckets.length - 1, index + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setIndex(Math.max(0, index - 1));
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [index, buckets.length, setIndex]);
  const canPrev = index > 0, canNext = index < buckets.length - 1;
  const navBtn = (on: boolean, dark: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '0 28px', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 22,
    border: `2px solid ${on ? 'var(--color-neutral-black)' : 'var(--border-subtle)'}`, cursor: on ? 'pointer' : 'default',
    background: on && dark ? 'var(--color-neutral-black)' : 'var(--color-neutral-white)', color: on ? (dark ? 'var(--color-neutral-white)' : 'var(--color-neutral-black)') : 'var(--border-divider)'
  });
  return (
    <div role="dialog" aria-modal="true" aria-label={`Weekly planning: ${nameOf(b)}`} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-neutral-white)', color: 'var(--color-neutral-black)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '20px 5vw', borderBottom: '2px solid var(--border-subtle)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 22 }}>Weekly planning</span>
        <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>{snapshot}</span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 26, fontWeight: 600 }}>{index + 1} of {buckets.length}</span>
        <button ref={exitRef} type="button" onClick={() => setIndex(null)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 18px', border: '2px solid var(--color-neutral-black)', borderRadius: 8, background: 'var(--color-neutral-white)', color: 'var(--color-neutral-black)', fontFamily: 'Inter, sans-serif', fontSize: 18, cursor: 'pointer' }}>
          <Icon fa="xmark" size={14} />Exit<span className="mono" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Esc</span>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4vh 5vw 2vh' }}>
        <h2 style={{ margin: 0, fontWeight: 400, fontFamily: "'Roboto Condensed', sans-serif", fontSize: 'clamp(52px, 6.5vw, 110px)', lineHeight: 1, letterSpacing: '-.01em' }}>{nameOf(b)}</h2>
        <div style={{ fontSize: 'clamp(20px, 2vw, 32px)', color: 'var(--text-secondary)', marginTop: 10 }}>{b.id ? rec?.role || 'Role not set' : 'Items with no owner. Assign these first.'}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6vw', flexWrap: 'wrap', margin: '4vh 0 3vh' }}>
          <div><div className="mono" style={{ fontSize: 'clamp(64px, 8vw, 132px)', lineHeight: 1, fontWeight: 700, color: b.overdue ? 'var(--feedback-danger-text)' : 'var(--text-secondary)' }}>{b.overdue}</div><div style={{ fontSize: 'clamp(16px, 1.4vw, 24px)', marginTop: 8 }}>Overdue</div></div>
          <div><div className="mono" style={{ fontSize: 'clamp(44px, 5vw, 84px)', lineHeight: 1 }}>{b.week}</div><div style={{ fontSize: 'clamp(16px, 1.4vw, 24px)', marginTop: 8 }}>Due this week</div></div>
          <div><div className="mono" style={{ fontSize: 'clamp(44px, 5vw, 84px)', lineHeight: 1 }}>{b.items.length}</div><div style={{ fontSize: 'clamp(16px, 1.4vw, 24px)', marginTop: 8 }}>Outstanding</div></div>
        </div>
        {!b.items.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '4vh 0', borderTop: '3px solid var(--color-neutral-black)' }}>
            <Icon fa="circle-check" size={64} style={{ color: 'var(--feedback-success-text)' }} />
            <span><span style={{ display: 'block', fontFamily: "'Roboto Condensed', sans-serif", fontSize: 'clamp(32px, 3.4vw, 56px)' }}>{clear.title}</span><span style={{ display: 'block', fontSize: 'clamp(20px, 1.8vw, 30px)', color: 'var(--text-secondary)', marginTop: 4 }}>{clear.text}</span></span>
          </div>
        ) : (
          <>
            <div style={{ borderTop: '3px solid var(--color-neutral-black)' }}>
              {b.items.slice(0, PRESENT_LIMIT).map((r) => (
                <div key={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 10vw) minmax(0, 1fr) auto', gap: '3vw', alignItems: 'baseline', padding: '1.6vh 0', borderBottom: '2px solid var(--border-subtle)', fontSize: 'clamp(20px, 2vw, 34px)', lineHeight: 1.25 }}>
                  <span className="mono">{shortDue(r.due)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '.62em', color: 'var(--text-secondary)' }}>{r.sector}</span>
                    <span style={{ display: 'block' }}>{r.item}</span>
                    {r.note && <span style={{ display: 'block', fontSize: '.7em', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: 4, textWrap: 'pretty' }}>“{r.note.text}”</span>}
                  </span>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: r.late ? 'var(--feedback-danger-text)' : 'var(--text-secondary)' }}>{when(r)}</span>
                </div>
              ))}
            </div>
            {b.items.length > PRESENT_LIMIT && <div style={{ fontSize: 'clamp(18px, 1.6vw, 26px)', color: 'var(--text-secondary)', marginTop: '2vh' }}>+ {b.items.length - PRESENT_LIMIT} more on the Team page</div>}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '18px 5vw', borderTop: '2px solid var(--border-subtle)' }}>
        <button type="button" disabled={!canPrev} onClick={() => setIndex(index - 1)} style={navBtn(canPrev, false)} aria-label={canPrev ? `Previous: ${nameOf(buckets[index - 1])}` : 'Previous'}>
          <Icon fa="arrow-left" size={14} /><span>{canPrev ? nameOf(buckets[index - 1]) : ''}</span>
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}>
          {buckets.map((x, i) => (
            <button key={x.id || '_un'} type="button" onClick={() => setIndex(i)} title={nameOf(x)} aria-label={nameOf(x)} aria-current={i === index}
              style={{ width: i === index ? 28 : 10, height: 10, borderRadius: 5, border: 0, padding: 0, cursor: 'pointer', background: i === index ? 'var(--color-neutral-black)' : 'var(--border-divider)' }} />
          ))}
        </div>
        <button type="button" disabled={!canNext} onClick={() => setIndex(index + 1)} style={navBtn(canNext, true)} aria-label={canNext ? `Next: ${nameOf(buckets[index + 1])}` : 'Next'}>
          <span>{canNext ? nameOf(buckets[index + 1]) : ''}</span><Icon fa="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}
