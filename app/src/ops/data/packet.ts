import { HELP_DESK } from '../../config';
import { isReady, PLAN_KINDS } from './meta';
import type { CustomBlock, FileRef, MatRow, PlanKey, PrepStatus, Sector } from './types';

/**
 * What reaches the floor and the printed packet. Only released content does: a block is released
 * once it is ready or approved and holds something. Drafts stay in the office.
 */

export interface Notice { title: string; text: string; icon: string }

/** Why a block has nothing to work from, in the owner's name. */
export function blockNotice(status: PrepStatus, kind: string, owner: string, estimate?: string): Notice {
  const cap = kind[0].toUpperCase() + kind.slice(1);
  if (status === 'none') return { title: `No ${kind} yet`, text: `Owner ${owner} has not started this block. Nothing to work from on the floor.`, icon: 'circle-exclamation' };
  if (status === 'draft') return { title: `${cap} in draft`, text: `${owner} is still writing this block${estimate ? `, ${estimate}` : ''}. It is not released for the floor or for print.`, icon: 'pen' };
  return { title: `${cap} missing`, text: `Marked ready but no content is attached. Contact ${owner}.`, icon: 'circle-exclamation' };
}

/** Why a required plan, or a PDF block, can't be shown: its file isn't uploaded. Null once it is. */
export function fileNotice(name: string, file: FileRef | undefined, owner: string): Notice | null {
  if (file) return null;
  return { title: `No PDF uploaded · ${name}`, text: `Owner ${owner} has to upload this before load-in.`, icon: 'file-circle-exclamation' };
}

export interface FieldPlan { key: PlanKey; name: string; short: string; file?: FileRef; notice: Notice | null }

export const fieldPlans = (s: Sector, owner: string): FieldPlan[] =>
  PLAN_KINDS.filter((k) => s.plans[k.key].required).map((k) => {
    const slot = s.plans[k.key];
    const notice = fileNotice(k.name, slot.file, owner);
    return { key: k.key, name: k.name, short: k.short, file: notice ? undefined : slot.file, notice };
  });

/** A list of rows the crew confirms: a material list or a checklist block. */
export interface FieldList { block: string; name: string; rows: MatRow[] | null; notice: Notice | null; foot?: string }

export function fieldLists(s: Sector, owner: string): FieldList[] {
  const out: FieldList[] = [];
  const mat = (k: 'mainMat' | 'netMat', name: string) => {
    const b = s.blocks[k];
    if (!b.on) return;
    const ok = isReady(b.status) && b.rows.length > 0;
    out.push({ block: k, name, rows: ok ? b.rows : null, notice: ok ? null : blockNotice(b.status, 'material list', owner) });
  };
  mat('mainMat', 'Main materials');
  mat('netMat', 'Computers & network');
  s.custom.filter((c) => c.on && c.kind === 'checklist').forEach((c) => {
    const ok = isReady(c.status) && !!c.rows?.length;
    out.push({ block: c.id, name: c.name, rows: ok ? c.rows! : null, notice: ok ? null : blockNotice(c.status, 'checklist', owner), foot: c.foot });
  });
  return out;
}

export interface FieldSteps { block: string; name: string; steps: { id: string; text: string; done: boolean }[] | null; notice: Notice | null; checkable: boolean }

export function fieldSteps(s: Sector, owner: string): FieldSteps[] {
  const out: FieldSteps[] = [];
  (['instr', 'install'] as const).forEach((k) => {
    const b = s.blocks[k];
    if (!b.on) return;
    const name = k === 'instr' ? 'Setup instructions' : 'Installation';
    const ok = isReady(b.status) && b.steps.length > 0;
    out.push({ block: k, name, steps: ok ? b.steps : null, notice: ok ? null : blockNotice(b.status, k === 'instr' ? 'instructions' : 'installation steps', owner), checkable: true });
  });
  s.custom.filter((c) => c.on && c.kind === 'text').forEach((c) => {
    const ok = isReady(c.status) && !!c.steps?.length;
    out.push({ block: c.id, name: c.name, steps: ok ? c.steps! : null, notice: ok ? null : blockNotice(c.status, 'text', owner), checkable: false });
  });
  return out;
}

/** Reference material that is read, not checked off: information rows, links, photos and PDF sheets. */
export interface FieldRef {
  key: string; name: string; notice: Notice | null;
  info?: { label: string; value: string }[];
  link?: { label: string; url: string };
  shots?: { id: string; title: string; caption: string }[];
  file?: FileRef;
}

export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

export function fieldRefs(s: Sector, owner: string): FieldRef[] {
  const out: FieldRef[] = [];
  const info = s.blocks.info;
  if (info.on) {
    const ok = isReady(info.status) && info.rows.length > 0;
    out.push({ key: 'info', name: 'Information', notice: ok ? null : blockNotice(info.status, 'information', owner), info: ok ? info.rows : undefined });
  }
  const link = s.blocks.link;
  if (link.on) {
    const url = safeUrl(link.url);
    out.push({ key: 'link', name: link.label || 'External link', notice: url ? null : { title: 'No link set yet', text: `Contact ${owner}.`, icon: 'link' }, link: url ? { label: link.label || url, url } : undefined });
  }
  s.custom.filter((c) => c.on && (c.kind === 'gallery' || c.kind === 'link' || c.kind === 'pdf')).forEach((c: CustomBlock) => {
    if (c.kind === 'pdf') {
      const notice = fileNotice(c.name, c.file, owner);
      out.push({ key: c.id, name: c.name, notice, file: notice ? undefined : c.file });
    } else if (c.kind === 'link') {
      const url = safeUrl(c.url ?? '');
      out.push({ key: c.id, name: c.name, notice: url ? null : { title: 'No link set yet', text: `Contact ${owner}.`, icon: 'link' }, link: url ? { label: c.label || url, url } : undefined });
    } else {
      const ok = isReady(c.status) && !!c.shots?.length;
      out.push({ key: c.id, name: c.name, notice: ok ? null : blockNotice(c.status, 'photo set', owner), shots: ok ? c.shots : undefined });
    }
  });
  return out;
}

export type FieldTab = 'floorplan' | 'materials' | 'info' | 'steps';

/** The phone's tabs: one per kind of thing the sector actually has, in build order. */
export function fieldTabs(s: Sector): { id: FieldTab; label: string }[] {
  const tabs: { id: FieldTab; label: string }[] = [];
  const plans = PLAN_KINDS.some((k) => s.plans[k.key].required);
  if (plans || !s.noFloorplans) tabs.push({ id: 'floorplan', label: 'Floorplan' });
  if (s.blocks.mainMat.on || s.blocks.netMat.on || s.custom.some((c) => c.on && c.kind === 'checklist')) tabs.push({ id: 'materials', label: 'Materials' });
  if (s.blocks.info.on || s.blocks.link.on || s.custom.some((c) => c.on && (c.kind === 'gallery' || c.kind === 'link' || c.kind === 'pdf'))) tabs.push({ id: 'info', label: 'Information' });
  if (s.blocks.instr.on || s.blocks.install.on || s.custom.some((c) => c.on && c.kind === 'text')) {
    tabs.push({ id: 'steps', label: s.blocks.instr.on ? 'Instructions' : s.blocks.install.on ? 'Installation' : 'Steps' });
  }
  return tabs;
}

/** Confirmed / total over released lists, or null when nothing is released to confirm. */
export function fieldProgress(s: Sector, owner: string): { done: number; total: number } | null {
  const rows = fieldLists(s, owner).flatMap((l) => l.rows ?? []);
  return rows.length ? { done: rows.filter((r) => r.checked).length, total: rows.length } : null;
}

/* ---------- Print packet ---------- */

export type PacketRow = { group: true; item: string } | { group: false; item: string; qty: string; note?: string };

export type PacketPage =
  | { kind: 'plan'; sheet: string; file?: FileRef; page: number; pages: number; notice: Notice | null }
  | { kind: 'rows'; sheet: string; title: string; rows: PacketRow[]; notice: Notice | null; qty: boolean; sign: boolean; continues: boolean }
  | { kind: 'steps'; sheet: string; title: string; steps: { n: number; text: string }[]; notice: Notice | null; last: boolean }
  | { kind: 'empty'; sheet: string };

// Room on a Letter page below the packet header, in CSS pixels.
const ROWS_BUDGET = 500;
const STEPS_BUDGET = 640;
const rowHeight = (r: PacketRow) => (r.group ? 44 : r.note ? 54 : 36);
const stepHeight = (t: string) => 36 + 23 * Math.max(1, Math.ceil(t.length / 78));

/** Splits rows into pages; a group heading never sits alone at the foot of a page. */
export function chunkRows(rows: PacketRow[], budget = ROWS_BUDGET): PacketRow[][] {
  const out: PacketRow[][] = [];
  let page: PacketRow[] = [];
  let used = 0;
  for (const r of rows) {
    const h = rowHeight(r);
    if (used + h > budget && page.length) {
      const tail = page[page.length - 1];
      if (tail.group) { page.pop(); if (page.length) out.push(page); page = [tail]; used = rowHeight(tail); }
      else { out.push(page); page = []; used = 0; }
    }
    page.push(r);
    used += h;
  }
  if (page.length) out.push(page);
  return out.length ? out : [[]];
}

function chunkSteps(steps: string[]): string[][] {
  const out: string[][] = [];
  let page: string[] = [];
  let used = 0;
  for (const t of steps) {
    const h = stepHeight(t);
    if (used + h > STEPS_BUDGET && page.length) { out.push(page); page = []; used = 0; }
    page.push(t);
    used += h;
  }
  if (page.length) out.push(page);
  return out.length ? out : [[]];
}

const matRows = (rows: MatRow[]): PacketRow[] => rows.map((r) => ({ group: false, item: r.item, qty: `${r.qty}`, note: r.note }));

/** Every page of one sector's packet: floorplans, material list, instructions, then custom blocks. */
export function packetPages(s: Sector, owner: string): PacketPage[] {
  const pages: PacketPage[] = [];

  fieldPlans(s, owner).forEach((p) => {
    const n = p.file?.pages ?? 1;
    for (let i = 1; i <= n; i++) pages.push({ kind: 'plan', sheet: p.name, file: p.file, page: i, pages: n, notice: p.notice });
  });

  const lists = fieldLists(s, owner).filter((l) => l.block === 'mainMat' || l.block === 'netMat');
  if (lists.length) {
    const released = lists.filter((l) => l.rows);
    if (!released.length) {
      pages.push({ kind: 'rows', sheet: 'Material list', title: 'Material list', rows: [], notice: lists[0].notice, qty: true, sign: true, continues: false });
    } else {
      const rows: PacketRow[] = lists.flatMap((l): PacketRow[] => l.rows
        ? [{ group: true, item: l.name }, ...matRows(l.rows)]
        : [{ group: true, item: `${l.name} · not released yet` }]);
      const chunks = chunkRows(rows);
      chunks.forEach((c, i) => pages.push({
        kind: 'rows', sheet: 'Material list', title: i === 0 ? 'Material list · check on arrival' : 'Material list · continued',
        rows: c, notice: null, qty: true, sign: i === chunks.length - 1, continues: i < chunks.length - 1
      }));
    }
  }

  const stepPages = (st: FieldSteps) => {
    if (!st.steps) { pages.push({ kind: 'steps', sheet: st.name, title: st.name, steps: [], notice: st.notice, last: true }); return; }
    const chunks = chunkSteps(st.steps.map((x) => x.text));
    let n = 0;
    chunks.forEach((c, i) => {
      pages.push({ kind: 'steps', sheet: st.name, title: i === 0 ? st.name : `${st.name} · continued`, steps: c.map((text) => ({ n: ++n, text })), notice: null, last: i === chunks.length - 1 });
    });
  };
  const allSteps = fieldSteps(s, owner);
  allSteps.filter((st) => st.checkable).forEach(stepPages);

  s.custom.filter((c) => c.on && c.kind !== 'link').forEach((c) => {
    if (c.kind === 'pdf') {
      const notice = fileNotice(c.name, c.file, owner);
      const n = notice ? 1 : c.file!.pages;
      for (let i = 1; i <= n; i++) pages.push({ kind: 'plan', sheet: c.name, file: notice ? undefined : c.file, page: i, pages: n, notice });
      return;
    }
    if (c.kind === 'text') { stepPages(allSteps.find((st) => st.block === c.id)!); return; }
    const ok = isReady(c.status);
    const rows: PacketRow[] = !ok ? []
      : c.kind === 'checklist' ? matRows(c.rows ?? [])
      : (c.shots ?? []).map((sh) => ({ group: false, item: sh.title, qty: '', note: sh.caption || undefined }));
    const notice = ok && rows.length ? null : blockNotice(c.status, c.kind === 'gallery' ? 'photo set' : c.kind, owner);
    const chunks = notice ? [[]] : chunkRows(rows);
    chunks.forEach((r, i) => pages.push({
      kind: 'rows', sheet: c.name, title: i === 0 ? c.name : `${c.name} · continued`, rows: r, notice,
      qty: c.kind !== 'gallery', sign: false, continues: i < chunks.length - 1
    }));
  });

  if (!pages.length) pages.push({ kind: 'empty', sheet: 'Packet' });
  return pages;
}

export const helpLine = () => `${HELP_DESK.where} · ${HELP_DESK.phone} · ${HELP_DESK.contact}`;
