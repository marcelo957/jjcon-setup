import { customKind, isReady, PLAN_KINDS } from './meta';
import { activeSectors, dayLabel } from './selectors';
import type { OpsData, PlanKey, Sector, TaskState } from './types';

export type TaskType = 'floorplan' | 'material' | 'instructions' | 'other';
export const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: 'floorplan', label: 'Floorplan' },
  { id: 'material', label: 'Material list' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'other', label: 'Other item' }
];

/** Days before the build day each item is due, unless a deadline was set. */
export const DUE_OFFSET: Record<string, number> = { G: 16, A: 14, B: 12, C: 10, D: 13, mainMat: 8, netMat: 7, info: 8, instr: 5, install: 5, link: 9 };
export const CUSTOM_DUE_OFFSET = 6;
/** "Soon" on the task list: due within this many days. */
const SOON_DAYS = 3;

export interface TaskRow {
  key: string;
  sectorId: string;
  sector: string;
  slot: string;
  item: string;
  type: TaskType;
  /** Where the item lives on the sector page. */
  hash: string;
  planKey?: PlanKey;
  /** Sector order, then item order: the default order of the list. */
  ord: number;
  done: boolean;
  doneBy: string;
  doneAt: string;
  due: string;
  who: string;
  /** Whole days past the deadline (positive) or until it (negative). */
  late: boolean;
  lateDays: number;
  soon: boolean;
  daysLeft: number;
  note?: TaskState['note'];
}

export const toIsoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIsoDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export function addDays(iso: string, n: number) { const d = parseIsoDay(iso); d.setDate(d.getDate() + n); return toIsoDay(d); }
/** Calendar days from a to b. */
export const dayDiff = (a: string, b: string) => Math.round((parseIsoDay(b).getTime() - parseIsoDay(a).getTime()) / 86_400_000);

export const taskKey = (sectorId: string, slot: string) => `${sectorId}:${slot}`;
export const splitKey = (key: string) => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)] as const; };

/** The items a sector requires, in the order the office reads them: plans, lists, steps, the rest. */
export function sectorItems(s: Sector) {
  const out: { slot: string; item: string; type: TaskType; ready: boolean; owner: string; hash: string; planKey?: PlanKey; offset: number }[] = [];
  PLAN_KINDS.forEach((k) => {
    const p = s.plans[k.key];
    if (p.required) out.push({ slot: k.key, item: `Floorplan — ${k.name}`, type: 'floorplan', ready: isReady(p.status), owner: s.ownerId, hash: '', planKey: k.key, offset: DUE_OFFSET[k.key] });
  });
  const b = s.blocks;
  if (b.mainMat.on) out.push({ slot: 'mainMat', item: 'Main material list', type: 'material', ready: isReady(b.mainMat.status), owner: s.ownerId, hash: '#material', offset: DUE_OFFSET.mainMat });
  if (b.netMat.on) out.push({ slot: 'netMat', item: 'Computers & network list', type: 'other', ready: isReady(b.netMat.status), owner: s.ownerId, hash: '#material', offset: DUE_OFFSET.netMat });
  if (b.info.on) out.push({ slot: 'info', item: 'Information', type: 'other', ready: isReady(b.info.status), owner: s.ownerId, hash: '#block-info', offset: DUE_OFFSET.info });
  if (b.instr.on) out.push({ slot: 'instr', item: 'Instructions', type: 'instructions', ready: isReady(b.instr.status), owner: s.leadId, hash: '#steps', offset: DUE_OFFSET.instr });
  if (b.install.on) out.push({ slot: 'install', item: 'Installation', type: 'other', ready: isReady(b.install.status), owner: s.leadId, hash: '#install', offset: DUE_OFFSET.install });
  if (b.link.on) out.push({ slot: 'link', item: 'External link', type: 'other', ready: isReady(b.link.status), owner: s.ownerId, hash: '#block-link', offset: DUE_OFFSET.link });
  s.custom.filter((c) => c.on).forEach((c) => out.push({ slot: c.id, item: `${customKind(c.kind).label} — ${c.name}`, type: 'other', ready: isReady(c.status), owner: s.ownerId, hash: `#block-${c.id}`, offset: CUSTOM_DUE_OFFSET }));
  return out;
}

/** One row per item every active sector requires. */
export function taskRows(d: OpsData, today: string): TaskRow[] {
  const rows: TaskRow[] = [];
  activeSectors(d).forEach((s) => {
    sectorItems(s).forEach((it) => {
      const t = s.tasks?.[it.slot] ?? {};
      const due = t.due ?? addDays(s.day, -it.offset);
      const done = t.done ?? it.ready;
      const who = t.who ?? it.owner;
      const left = dayDiff(today, due);
      rows.push({
        key: taskKey(s.id, it.slot), sectorId: s.id, sector: s.name, slot: it.slot, item: it.item, type: it.type,
        hash: it.planKey ? `?plan=${it.planKey}#block-plans` : it.hash, planKey: it.planKey, ord: rows.length,
        done, doneBy: t.doneBy ?? who, doneAt: t.doneAt ?? `${addDays(due, -2)}T09:00:00`,
        due, who, late: !done && left < 0, lateDays: -left, soon: !done && left >= 0 && left <= SOON_DAYS, daysLeft: left,
        note: t.note
      });
    });
  });
  return rows;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** "4 days late", "due today", "due in 2 days", or '' when not close. */
export function dueNote(r: TaskRow, within = SOON_DAYS) {
  if (r.done) return '';
  if (r.late) return `${plural(r.lateDays, 'day')} late`;
  if (r.daysLeft === 0) return 'due today';
  return r.daysLeft <= within ? `due in ${plural(r.daysLeft, 'day')}` : '';
}

export const shortDue = (iso: string) => dayLabel(iso);
export { plural };
