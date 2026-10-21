import { blockState, customState, type ContentKey, type ContentState } from './content';
import { customKind, PLAN_KINDS } from './meta';
import { activeSectors, dayLabel } from './selectors';
import type { FileRef, OpsData, PlanKey, Sector, Stamp, TaskState } from './types';

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
  /**
   * An upload (plan or PDF block) is in place while its file is there; written content while it
   * holds something. Nothing is ever marked by hand: `done` is what exists.
   */
  kind: 'upload' | 'content';
  /** Always true now: kept for readability where the list used to offer a tick. */
  auto: boolean;
  done: boolean;
  /** Written content: "12 items", "8 steps". Empty when empty. */
  summary: string;
  /** Written content: frozen as final, by whom and when. */
  final?: Stamp;
  doneBy: string;
  doneAt: string;
  due: string;
  who: string;
  /** Whole days past the deadline (positive) or until it (negative). */
  late: boolean;
  lateDays: number;
  soon: boolean;
  /** Missing and due within the next 7 days (today included): what's coming up. */
  week: boolean;
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
  type Item = { slot: string; item: string; type: TaskType; owner: string; hash: string; planKey?: PlanKey; offset: number }
    & ({ kind: 'upload'; ready: boolean; file: FileRef | null } | { kind: 'content'; ready: boolean; state: ContentState });
  const out: Item[] = [];
  PLAN_KINDS.forEach((k) => {
    const p = s.plans[k.key];
    if (p.required) out.push({ slot: k.key, item: `Floorplan — ${k.name}`, type: 'floorplan', kind: 'upload', ready: !!p.file, file: p.file ?? null, owner: s.ownerId, hash: '', planKey: k.key, offset: DUE_OFFSET[k.key] });
  });
  const b = s.blocks;
  const written = (slot: ContentKey, item: string, type: TaskType, owner: string, hash: string) => {
    if (!b[slot].on) return;
    const state = blockState(b, slot);
    out.push({ slot, item, type, owner, hash, offset: DUE_OFFSET[slot], kind: 'content', ready: !state.empty, state });
  };
  written('mainMat', 'Main material list', 'material', s.ownerId, '#material');
  written('netMat', 'Computers & network list', 'other', s.ownerId, '#material');
  written('info', 'Information', 'other', s.ownerId, '#block-info');
  written('instr', 'Instructions', 'instructions', s.leadId, '#steps');
  written('install', 'Installation', 'other', s.leadId, '#install');
  written('link', 'External link', 'other', s.ownerId, '#block-link');
  s.custom.filter((c) => c.on).forEach((c) => {
    const base = { slot: c.id, item: `${customKind(c.kind).label} — ${c.name}`, type: 'other' as const, owner: s.ownerId, hash: `#block-${c.id}`, offset: CUSTOM_DUE_OFFSET };
    const state = customState(c);
    out.push(state ? { ...base, kind: 'content', ready: !state.empty, state } : { ...base, kind: 'upload', ready: !!c.file, file: c.file ?? null });
  });
  return out;
}

/** One row per item every active sector requires. */
export function taskRows(d: OpsData, today: string): TaskRow[] {
  const rows: TaskRow[] = [];
  activeSectors(d).forEach((s) => {
    sectorItems(s).forEach((it) => {
      const t = s.tasks?.[it.slot] ?? {};
      const due = t.due ?? addDays(s.day, -it.offset);
      // Whether the work exists is the status: a file uploaded, or content written. Nothing else.
      const done = it.ready;
      const who = t.who ?? it.owner;
      const left = dayDiff(today, due);
      const stamp = it.kind === 'upload' ? (it.file ? { by: it.file.uploadedBy || '', at: it.file.uploadedAt } : undefined) : it.state.meta.edited;
      rows.push({
        key: taskKey(s.id, it.slot), sectorId: s.id, sector: s.name, slot: it.slot, item: it.item, type: it.type,
        hash: it.planKey ? `?plan=${it.planKey}#block-plans` : it.hash, planKey: it.planKey, ord: rows.length,
        kind: it.kind, auto: true, done,
        summary: it.kind === 'content' ? it.state.summary : '',
        final: it.kind === 'content' ? it.state.meta.final : undefined,
        doneBy: stamp?.by ?? '', doneAt: stamp?.at ?? '',
        due, who, late: !done && left < 0, lateDays: -left, soon: !done && left >= 0 && left <= SOON_DAYS, week: !done && left >= 0 && left <= 6, daysLeft: left,
        note: t.note
      });
    });
  });
  return rows;
}

/** The sector page in edit mode, at the written block. */
export const writePath = (r: TaskRow) => `/sectors/${r.sectorId}?edit=1${r.hash}`;

/** The sector page in edit mode, at the item's upload. */
export const uploadPath = (r: TaskRow) => `/sectors/${r.sectorId}?${r.planKey ? `plan=${r.planKey}&` : ''}edit=1${r.planKey ? '#block-plans' : r.hash}`;

/**
 * Most urgent first: late (longest overdue first), then what's still missing by deadline, then
 * what's in place. The order every deadline view opens in.
 */
export function byUrgency(a: TaskRow, b: TaskRow): number {
  const rank = (r: TaskRow) => (r.late ? 0 : r.done ? 2 : 1);
  return rank(a) - rank(b) || (a.late && b.late ? b.lateDays - a.lateDays : 0) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || a.ord - b.ord;
}

/** Late, due this week, and in place, over a set of rows. */
export function attention(rows: TaskRow[]) {
  return { late: rows.filter((r) => r.late).length, week: rows.filter((r) => r.week).length, done: rows.filter((r) => r.done).length, total: rows.length };
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
