import { activeSectors } from './selectors';
import { plural, taskRows, type TaskRow } from './tasks';
import type { OpsData, Sector } from './types';

/** What someone currently owns: active sectors they lead or prepare, and open task rows. */
export function personLoad(d: OpsData, id: string, today: string) {
  const secs = activeSectors(d).filter((s) => s.leadId === id || s.ownerId === id);
  const open = taskRows(d, today).filter((r) => !r.done && r.who === id).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.ord - b.ord));
  return { secs, open, overdue: open.filter((r) => r.late).length };
}

/** Everything that names this person. Anyone with history can be deactivated but not deleted. */
export function personHistory(d: OpsData, id: string, today: string): string[] {
  const out: string[] = [];
  const secs = d.sectors.filter((s) => s.leadId === id || s.ownerId === id);
  if (secs.length) out.push(`${plural(secs.length, 'sector')} as lead or owner`);
  const rows = taskRows(d, today).filter((r) => r.who === id);
  if (rows.length) out.push(`${plural(rows.length, 'task row')} (${rows.filter((r) => r.done).length} done)`);
  const tasks = d.sectors.flatMap((s) => Object.values(s.tasks ?? {}));
  const notes = tasks.filter((t) => t.note?.by === id).length;
  if (notes) out.push(`${plural(notes, 'note')} on delayed items`);
  const edited = d.sectors.flatMap((s) => [...Object.values(s.blocks), ...s.custom]).filter((b) => b.edited?.by === id || b.final?.by === id).length;
  if (edited) out.push(`${plural(edited, 'block')} written or marked final`);
  const arch = d.sectors.filter((s) => s.archived?.by === id).length;
  if (arch) out.push(`${plural(arch, 'archived sector')}`);
  const files = d.sectors.flatMap((s) => Object.values(s.plans).map((p) => p.file)).filter((f) => f?.uploadedBy === id).length;
  if (files) out.push(`${plural(files, 'uploaded PDF')}`);
  return out;
}

export interface DeactItem {
  key: string;
  kind: 'sector' | 'task';
  title: string;
  sub: string;
  late?: boolean;
  sectorId?: string;
  field?: 'leadId' | 'ownerId';
  taskKey?: string;
}

/** Work that needs a new owner before someone is deactivated. */
export function deactItems(d: OpsData, id: string, today: string): DeactItem[] {
  const { secs, open } = personLoad(d, id, today);
  const out: DeactItem[] = [];
  secs.forEach((s: Sector) => {
    if (s.leadId === id) out.push({ key: `sec|${s.id}|lead`, kind: 'sector', sectorId: s.id, field: 'leadId', title: s.name, sub: 'Sector lead · runs the build on site' });
    if (s.ownerId === id) out.push({ key: `sec|${s.id}|owner`, kind: 'sector', sectorId: s.id, field: 'ownerId', title: s.name, sub: 'Prep owner · floorplans and material lists' });
  });
  open.forEach((r: TaskRow) => out.push({
    key: `task|${r.key}`, kind: 'task', taskKey: r.key, title: `${r.sector} · ${r.item}`, late: r.late,
    sub: r.late ? `${r.due.slice(8)} ${monthOf(r.due)} · ${plural(r.lateDays, 'day')} late` : `Due ${r.due.slice(8)} ${monthOf(r.due)}`
  }));
  return out;
}

const monthOf = (iso: string) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(iso.slice(5, 7)) - 1];

/** Done rows whose owner comes from the sector default: pinned so moving the sector keeps who did them. */
export function doneRowsOf(d: OpsData, id: string, today: string) {
  return taskRows(d, today).filter((r) => r.done && r.who === id).map((r) => r.key);
}

