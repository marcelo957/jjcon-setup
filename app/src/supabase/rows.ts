import { PLAN_KINDS } from '../ops/data/meta';
import type {
  BlockKey, ContentMeta, CustomBlock, CustomKind, FileRef, InfoRow, MatRow, OpsData, Person, PlanKey, PlanSlot, Sector, Shot, Stamp, Step, TaskState
} from '../ops/data/types';

/**
 * The app's data as rows of the Supabase tables in supabase/01_tables.sql, and back.
 * Ids are the app's own, so the same sector, block or list line keeps the same row.
 */

export type Row = Record<string, string | number | boolean | null>;
export const TABLES = ['people', 'sectors', 'content_blocks', 'material_items', 'steps', 'info_rows', 'photo_entries', 'tasks'] as const;
export type Table = typeof TABLES[number];
export type Tables = Record<Table, Row[]>;

const BUILT_IN: Record<string, string> = {
  mainMat: 'main_materials', netMat: 'network_list', instr: 'instructions', install: 'installation', info: 'information', link: 'external_link'
};
const CUSTOM: Record<CustomKind, string> = { pdf: 'custom_pdf', checklist: 'custom_checklist', text: 'custom_text', gallery: 'custom_gallery', link: 'custom_link' };
const BLOCK_KEYS = ['mainMat', 'netMat', 'instr', 'install', 'info', 'link'] as const;

export const blockId = (sectorId: string, slot: string) => `${sectorId}:${slot}`;
const isPlanKey = (k: string): k is PlanKey => PLAN_KINDS.some((p) => p.key === k);

/** Empty and missing are both stored as null. */
const n = (v: string | number | boolean | null | undefined) => (v === undefined || v === '' ? null : v);

function fileCols(f: FileRef | undefined, prev?: string): Row {
  return {
    file_path: n(f?.id), file_name: n(f?.name), file_size: n(f?.size), file_pages: n(f?.pages),
    file_uploaded_at: n(f?.uploadedAt), file_uploaded_by: n(f?.uploadedBy ?? null), file_replaced_uploaded_at: n(prev)
  };
}
function metaCols(m: ContentMeta): Row {
  return {
    edited_by: n(m.edited?.by), edited_at: n(m.edited?.at), final_by: n(m.final?.by), final_at: n(m.final?.at),
    unlocked_by: n(m.unlocked?.by), unlocked_at: n(m.unlocked?.at)
  };
}

export function toRows(d: OpsData): Tables {
  const t: Tables = { people: [], sectors: [], content_blocks: [], material_items: [], steps: [], info_rows: [], photo_entries: [], tasks: [] };

  d.people.forEach((p) => t.people.push({
    id: p.id, name: p.name, job_title: p.role ?? '', email: n(p.email), active: p.active,
    deactivated_at: n(p.deactivatedAt), deactivated_by: n(p.deactivatedBy), added_inline_at: n(p.addedInlineAt)
  }));

  const items = (block: string, rows: MatRow[]) => rows.forEach((r, i) =>
    t.material_items.push({ id: r.id, block_id: block, position: i, item: r.item ?? '', quantity: r.qty, note: n(r.note), arrived: r.checked }));
  const steps = (block: string, list: Step[]) => list.forEach((st, i) =>
    t.steps.push({ id: st.id, block_id: block, position: i, text: st.text ?? '', finished: st.done }));

  d.sectors.forEach((s) => {
    t.sectors.push({
      id: s.id, name: s.name, sector_group: s.group, lead_id: n(s.leadId), owner_id: n(s.ownerId), location: s.location ?? '',
      build_day: s.day, window_from: s.from, window_to: s.to, build_status: s.build, no_floorplans: !!s.noFloorplans,
      archived_at: n(s.archived?.at), archived_by: n(s.archived?.by), archive_reason: n(s.archived?.reason),
      related_sector_id: n(s.xref?.sectorId), related_text: n(s.xref?.text), related_tail: n(s.xref?.tail),
      packet_printed_at: n(s.packetPrintedAt), content_changed_at: n(s.contentChangedAt)
    });
    const block = (slot: string, kind: string, o: { plan?: string; name?: string; on: boolean; pos: number; label?: string; url?: string; foot?: string; file?: FileRef; prev?: string; meta?: ContentMeta }) =>
      t.content_blocks.push({
        id: blockId(s.id, slot), sector_id: s.id, slot, kind, plan_key: n(o.plan), name: n(o.name), is_on: o.on, position: o.pos,
        link_label: n(o.label), link_url: n(o.url), footnote: n(o.foot), ...fileCols(o.file, o.prev), ...metaCols(o.meta ?? {})
      });

    PLAN_KINDS.forEach((k, i) => {
      const p = s.plans[k.key];
      block(`plan:${k.key}`, 'floorplan', { plan: k.key, on: p.required, pos: i, file: p.file, prev: p.prevUploadedAt });
    });
    BLOCK_KEYS.forEach((k, i) => {
      const b = s.blocks[k];
      const id = blockId(s.id, k);
      block(k, BUILT_IN[k], { on: b.on, pos: 10 + i, meta: b, ...(k === 'link' ? { label: s.blocks.link.label, url: s.blocks.link.url } : {}) });
      if (k === 'mainMat' || k === 'netMat') items(id, s.blocks[k].rows);
      if (k === 'instr' || k === 'install') steps(id, s.blocks[k].steps);
      if (k === 'info') s.blocks.info.rows.forEach((r, i) => t.info_rows.push({ id: r.id, block_id: id, position: i, label: r.label ?? '', value: r.value ?? '' }));
    });
    s.custom.forEach((c, i) => {
      const id = blockId(s.id, c.id);
      block(c.id, CUSTOM[c.kind], { name: c.name, on: c.on, pos: 20 + i, label: c.label, url: c.url, foot: c.foot, file: c.file, meta: c });
      items(id, c.rows ?? []);
      steps(id, c.steps ?? []);
      (c.shots ?? []).forEach((sh, i) => t.photo_entries.push({ id: sh.id, block_id: id, position: i, title: sh.title ?? '', caption: sh.caption ?? '' }));
    });
    Object.entries(s.tasks ?? {}).forEach(([slot, task]) => {
      const b = blockId(s.id, isPlanKey(slot) ? `plan:${slot}` : slot);
      t.tasks.push({
        id: `${b}:task`, block_id: b, due_date: n(task.due), responsible_id: n(task.who), unassigned: task.who === '',
        note_text: n(task.note?.text), note_by: n(task.note?.by), note_at: n(task.note?.at),
        updated_by: n(d.tasksUpdated?.by), updated_at: n(d.tasksUpdated?.at)
      });
    });
  });
  return t;
}

/* ---------- back from rows ---------- */

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
/** Timestamps come back as "2026-10-24T12:00:00+00:00"; the app writes and compares "…T12:00:00.000Z". */
const ts = (v: unknown) => (typeof v === 'string' ? new Date(v).toISOString() : undefined);
const stamp = (by: unknown, at: unknown): Stamp | undefined => (str(by) && ts(at) ? { by: str(by)!, at: ts(at)! } : undefined);
const byPos = (a: Row, b: Row) => (a.position as number) - (b.position as number);

function meta(b: Row): ContentMeta {
  const m: ContentMeta = {};
  const e = stamp(b.edited_by, b.edited_at); if (e) m.edited = e;
  const f = stamp(b.final_by, b.final_at); if (f) m.final = f;
  const u = stamp(b.unlocked_by, b.unlocked_at); if (u) m.unlocked = u;
  return m;
}
function file(b: Row): FileRef | undefined {
  if (!str(b.file_path)) return undefined;
  const f: FileRef = { id: b.file_path as string, name: str(b.file_name) ?? '', size: Number(b.file_size ?? 0), pages: Number(b.file_pages ?? 1), uploadedAt: ts(b.file_uploaded_at) ?? '' };
  if (str(b.file_uploaded_by)) f.uploadedBy = b.file_uploaded_by as string;
  return f;
}

export function fromRows(t: Tables): OpsData {
  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => { const k = r.block_id as string; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
    m.forEach((list) => list.sort(byPos));
    return (block: string) => m.get(block) ?? [];
  };
  const itemsOf = group(t.material_items);
  const stepsOf = group(t.steps);
  const infoOf = group(t.info_rows);
  const photosOf = group(t.photo_entries);
  const blocksBySector = new Map<string, Row[]>();
  t.content_blocks.forEach((b) => { const k = b.sector_id as string; if (!blocksBySector.has(k)) blocksBySector.set(k, []); blocksBySector.get(k)!.push(b); });
  const taskByBlock = new Map(t.tasks.map((r) => [r.block_id as string, r]));

  const mat = (r: Row): MatRow => ({ id: r.id as string, item: r.item as string, qty: Number(r.quantity), ...(str(r.note) ? { note: r.note as string } : {}), checked: !!r.arrived });
  const step = (r: Row): Step => ({ id: r.id as string, text: r.text as string, done: !!r.finished });
  const info = (r: Row): InfoRow => ({ id: r.id as string, label: r.label as string, value: r.value as string });
  const shot = (r: Row): Shot => ({ id: r.id as string, title: r.title as string, caption: r.caption as string });

  const people: Person[] = t.people.map((p) => {
    const person: Person = { id: p.id as string, name: p.name as string, role: str(p.job_title) ?? '', email: str(p.email) ?? '', active: !!p.active };
    if (ts(p.deactivated_at)) person.deactivatedAt = ts(p.deactivated_at);
    if (str(p.deactivated_by)) person.deactivatedBy = p.deactivated_by as string;
    if (ts(p.added_inline_at)) person.addedInlineAt = ts(p.added_inline_at);
    return person;
  });

  let tasksUpdated: OpsData['tasksUpdated'];
  t.tasks.forEach((r) => {
    const s = stamp(r.updated_by, r.updated_at);
    if (s && (!tasksUpdated || s.at > tasksUpdated.at)) tasksUpdated = s;
  });

  const sectors: Sector[] = t.sectors.map((r) => {
    const id = r.id as string;
    const blocks = (blocksBySector.get(id) ?? []).slice().sort(byPos);
    const at = (slot: string) => blocks.find((b) => b.slot === slot);
    const on = (slot: string) => !!at(slot)?.is_on;
    const bm = (slot: string) => { const b = at(slot); return b ? meta(b) : {}; };

    const plans = Object.fromEntries(PLAN_KINDS.map(({ key }) => {
      const b = at(`plan:${key}`);
      const p: PlanSlot = { required: !!b?.is_on };
      const f = b && file(b); if (f) p.file = f;
      if (b && ts(b.file_replaced_uploaded_at)) p.prevUploadedAt = ts(b.file_replaced_uploaded_at);
      return [key, p];
    })) as Record<PlanKey, PlanSlot>;

    const bid = (k: BlockKey) => blockId(id, k);
    const sector: Sector = {
      id, name: r.name as string, group: r.sector_group as Sector['group'], leadId: str(r.lead_id) ?? '', ownerId: str(r.owner_id) ?? '',
      location: str(r.location) ?? '', day: String(r.build_day).slice(0, 10), from: String(r.window_from).slice(0, 5), to: String(r.window_to).slice(0, 5),
      build: r.build_status as Sector['build'],
      plans,
      blocks: {
        mainMat: { on: on('mainMat'), ...bm('mainMat'), rows: itemsOf(bid('mainMat')).map(mat) },
        netMat: { on: on('netMat'), ...bm('netMat'), rows: itemsOf(bid('netMat')).map(mat) },
        instr: { on: on('instr'), ...bm('instr'), steps: stepsOf(bid('instr')).map(step) },
        info: { on: on('info'), ...bm('info'), rows: infoOf(bid('info')).map(info) },
        install: { on: on('install'), ...bm('install'), steps: stepsOf(bid('install')).map(step) },
        link: { on: on('link'), ...bm('link'), label: str(at('link')?.link_label) ?? '', url: str(at('link')?.link_url) ?? '' }
      },
      custom: blocks.filter((b) => (b.kind as string).startsWith('custom_')).map((b) => {
        const kind = (Object.keys(CUSTOM) as CustomKind[]).find((k) => CUSTOM[k] === b.kind)!;
        const bId = b.id as string;
        const c: CustomBlock = { id: b.slot as string, kind, name: str(b.name) ?? '', on: !!b.is_on, ...meta(b) };
        if (kind === 'checklist') c.rows = itemsOf(bId).map(mat);
        if (kind === 'text') c.steps = stepsOf(bId).map(step);
        if (kind === 'gallery') c.shots = photosOf(bId).map(shot);
        if (str(b.link_label) !== undefined) c.label = b.link_label as string;
        if (str(b.link_url) !== undefined) c.url = b.link_url as string;
        if (str(b.footnote) !== undefined) c.foot = b.footnote as string;
        const f = file(b); if (f) c.file = f;
        return c;
      })
    };
    if (r.no_floorplans) sector.noFloorplans = true;
    if (ts(r.archived_at)) sector.archived = { at: ts(r.archived_at)!, by: str(r.archived_by) ?? '', reason: str(r.archive_reason) ?? '' };
    if (str(r.related_sector_id)) sector.xref = { sectorId: r.related_sector_id as string, text: str(r.related_text) ?? '', tail: str(r.related_tail) ?? '' };
    if (ts(r.packet_printed_at)) sector.packetPrintedAt = ts(r.packet_printed_at);
    if (ts(r.content_changed_at)) sector.contentChangedAt = ts(r.content_changed_at);

    const tasks: Record<string, TaskState> = {};
    blocks.forEach((b) => {
      const tr = taskByBlock.get(b.id as string);
      if (!tr) return;
      const slot = (b.slot as string).startsWith('plan:') ? (b.slot as string).slice(5) : (b.slot as string);
      const task: TaskState = {};
      if (str(tr.due_date)) task.due = (tr.due_date as string).slice(0, 10);
      if (tr.unassigned) task.who = '';
      else if (str(tr.responsible_id)) task.who = tr.responsible_id as string;
      if (str(tr.note_text)) task.note = { text: tr.note_text as string, by: str(tr.note_by) ?? '', at: ts(tr.note_at) ?? '' };
      tasks[slot] = task;
    });
    sector.tasks = tasks;
    return sector;
  });

  const d: OpsData = { version: 1, people, sectors };
  if (tasksUpdated) d.tasksUpdated = tasksUpdated;
  return d;
}

/* ---------- what changed ---------- */

/** Columns that change together across many rows; they are written only with a row that changed for another reason. */
const RIDES_ALONG: Partial<Record<Table, string[]>> = { tasks: ['updated_by', 'updated_at'] };

export interface RowChanges { upsert: Partial<Record<Table, Row[]>>; remove: Partial<Record<Table, string[]>>; count: number }

/** The rows to write and the rows to delete to turn `before` into `after`, table by table. */
export function diffRows(before: Tables, after: Tables): RowChanges {
  const out: RowChanges = { upsert: {}, remove: {}, count: 0 };
  TABLES.forEach((table) => {
    const skip = RIDES_ALONG[table] ?? [];
    const key = (r: Row) => JSON.stringify(Object.keys(r).filter((c) => !skip.includes(c)).sort().map((c) => [c, r[c]]));
    const old = new Map(before[table].map((r) => [r.id as string, key(r)]));
    const changed = after[table].filter((r) => old.get(r.id as string) !== key(r));
    const keep = new Set(after[table].map((r) => r.id as string));
    const gone = before[table].map((r) => r.id as string).filter((id) => !keep.has(id));
    if (changed.length) out.upsert[table] = changed;
    if (gone.length) out.remove[table] = gone;
    out.count += changed.length + gone.length;
  });
  return out;
}
