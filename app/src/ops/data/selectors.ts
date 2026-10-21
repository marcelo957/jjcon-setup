import { BLOCK_DEFS, blockLabel, customKind, GROUPS, isReady, PLAN_KINDS } from './meta';
import type { BlockKey, CustomBlock, OpsData, Person, PlanKey, PrepStatus, Sector } from './types';

/** Group order, then full display name ignoring case, by code point so | and — stay ordinary characters. */
export function sortSectors(list: Sector[]): Sector[] {
  const gi = (s: Sector) => GROUPS.findIndex((g) => g.id === s.group);
  const key = (s: Sector) => s.name.toLowerCase();
  return list.slice().sort((a, b) => gi(a) - gi(b) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export const activeSectors = (d: OpsData) => sortSectors(d.sectors.filter((s) => !s.archived));
export const archivedSectors = (d: OpsData) => sortSectors(d.sectors.filter((s) => s.archived));

export function personName(people: Person[], id: string | null | undefined): string {
  if (!id) return 'Unassigned';
  return people.find((p) => p.id === id)?.name || 'Unnamed person';
}

export function initials(name: string): string {
  const w = name.replace(/[.'’]/g, '').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] ?? '').slice(0, 2)).toUpperCase();
}

export const sortPeople = (people: Person[]) =>
  people.slice().sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "25 Aug" from an ISO date. */
export function dayLabel(isoDay: string): string {
  const [, m, d] = isoDay.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
}
/** "25 Aug · 10:00–16:00" */
export const windowLabel = (s: Sector) => `${dayLabel(s.day)} · ${s.from}–${s.to}`;
/** "02 Aug 2027" */
export function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function sizeLabel(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A required plan is done exactly when its PDF is uploaded. */
export interface PlanView { key: PlanKey; name: string; short: string; icon: string; required: boolean; done: boolean }

export function plansOf(s: Sector): PlanView[] {
  return PLAN_KINDS.map((k) => {
    const slot = s.plans[k.key];
    return { key: k.key, name: k.name, short: k.short, icon: k.icon, required: slot.required, done: !!slot.file };
  });
}

export function planRoll(s: Sector) {
  const plans = plansOf(s).filter((p) => p.required);
  return { plans, done: plans.filter((p) => p.done).length, total: plans.length };
}

/** A PDF block is done exactly when its file is uploaded; other custom blocks keep a prep status. */
export const isUpload = (c: CustomBlock) => c.kind === 'pdf';

/** `status` is null for uploads: they are done or not, by whether the file is there. */
export interface OtherItem { key: string; name: string; status: PrepStatus | null; done: boolean; custom: boolean; icon: string }

/** The blocks that roll up under the dashboard's "Other items" column. */
export function otherItems(s: Sector): OtherItem[] {
  const out: OtherItem[] = [];
  (['netMat', 'info', 'install', 'link'] as BlockKey[]).forEach((k) => {
    if (s.blocks[k].on) out.push({ key: k, name: blockLabel(k), status: s.blocks[k].status, done: isReady(s.blocks[k].status), custom: false, icon: BLOCK_DEFS.find((b) => b.k === k)!.icon });
  });
  s.custom.filter((c) => c.on).forEach((c) => out.push(isUpload(c)
    ? { key: c.id, name: c.name, status: null, done: !!c.file, custom: true, icon: customKind(c.kind).icon }
    : { key: c.id, name: c.name, status: c.status, done: isReady(c.status), custom: true, icon: customKind(c.kind).icon }));
  return out;
}

export function otherRoll(s: Sector) {
  const items = otherItems(s);
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}

/** Something required that nobody has started. */
export function isBlocked(s: Sector): boolean {
  return planRoll(s).plans.some((p) => !p.done)
    || (s.blocks.mainMat.on && s.blocks.mainMat.status === 'none')
    || (s.blocks.instr.on && s.blocks.instr.status === 'none')
    || otherItems(s).some((i) => (i.status === null ? !i.done : i.status === 'none'));
}

export function isComplete(s: Sector): boolean {
  const fp = planRoll(s);
  const core = (k: 'mainMat' | 'instr') => !s.blocks[k].on || isReady(s.blocks[k].status);
  const other = otherRoll(s);
  return fp.done === fp.total && core('mainMat') && core('instr') && other.done === other.total;
}

/** The material list on the sector page: main and network rows, as the groups the crew sees. */
export function materialGroups(s: Sector) {
  const out: { key: 'mainMat' | 'netMat'; name: string; rows: Sector['blocks']['mainMat']['rows'] }[] = [];
  if (s.blocks.mainMat.on) out.push({ key: 'mainMat', name: 'Main materials', rows: s.blocks.mainMat.rows });
  if (s.blocks.netMat.on) out.push({ key: 'netMat', name: 'Computers & network', rows: s.blocks.netMat.rows });
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a built-in block holds, in words, or null when it is empty. */
export function blockContent(s: Sector, k: BlockKey): string | null {
  const b = s.blocks;
  if (k === 'mainMat' || k === 'netMat') return b[k].rows.length ? `a ${b[k].rows.length}-row list, "${k === 'mainMat' ? 'Main materials' : 'Computers & network'}"` : null;
  if (k === 'instr' || k === 'install') return b[k].steps.length ? `${plural(b[k].steps.length, 'numbered step')}` : null;
  if (k === 'info') return b.info.rows.length ? `${plural(b.info.rows.length, 'information row')}` : null;
  return b.link.url ? b.link.label || b.link.url : null;
}

export function planContent(s: Sector, k: PlanKey): string | null {
  const f = s.plans[k].file;
  return f ? `an uploaded PDF, ${f.name}` : null;
}

export function customContent(c: CustomBlock): string | null {
  if (c.kind === 'checklist' && c.rows?.length) return `a ${c.rows.length}-row checklist`;
  if (c.kind === 'text' && c.steps?.length) return plural(c.steps.length, 'numbered step');
  if (c.kind === 'gallery' && c.shots?.length) return plural(c.shots.length, 'captioned photo');
  if (c.kind === 'pdf' && c.file) return `an uploaded PDF, ${c.file.name}`;
  if (c.kind === 'link' && c.url) return c.label || c.url;
  return null;
}

/** Everything deleting a sector would lose. Empty means it can go with a simple confirm. */
export function sectorInventory(s: Sector): string[] {
  const out: string[] = [];
  const pdfs = PLAN_KINDS.filter((k) => s.plans[k.key].file).length + s.custom.filter((c) => c.file).length;
  if (pdfs) out.push(`${plural(pdfs, 'uploaded PDF')}`);
  const lists = (['mainMat', 'netMat'] as const).filter((k) => s.blocks[k].rows.length);
  const rows = lists.reduce((n, k) => n + s.blocks[k].rows.length, 0);
  if (rows) out.push(`${rows} material rows across ${plural(lists.length, 'list')}`);
  const steps = s.blocks.instr.steps.length + s.blocks.install.steps.length;
  if (steps) out.push(plural(steps, 'instruction step'));
  if (s.blocks.info.rows.length) out.push(plural(s.blocks.info.rows.length, 'information row'));
  s.custom.forEach((c) => { const h = customContent(c); if (h && c.kind !== 'pdf') out.push(`${c.name}: ${h}`); });
  return out;
}

/** Packet freshness line on the sector page. */
export function packetState(s: Sector): 'none' | 'current' | 'stale' {
  if (!s.packetPrintedAt) return 'none';
  return s.contentChangedAt && s.contentChangedAt > s.packetPrintedAt ? 'stale' : 'current';
}
