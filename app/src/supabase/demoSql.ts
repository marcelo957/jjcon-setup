import { PLAN_KINDS } from '../ops/data/meta';
import type { ContentMeta, FileRef, OpsData, Sector } from '../ops/data/types';

/**
 * The app's demo data as SQL inserts for the Supabase tables in supabase/01_tables.sql.
 * Generated from seedData(), so the database starts with exactly what the demo shows.
 */

type V = string | number | boolean | null | undefined;
const lit = (v: V): string =>
  v === null || v === undefined || v === '' ? 'null'
    : typeof v === 'boolean' ? (v ? 'true' : 'false')
    : typeof v === 'number' ? String(v)
    : `'${v.replace(/'/g, "''")}'`;
/** Like lit, but keeps an empty string as '' (for not-null text columns). */
const txt = (v: string | undefined) => `'${(v ?? '').replace(/'/g, "''")}'`;

function insert(table: string, cols: string[], rows: string[][]): string {
  if (!rows.length) return '';
  return `insert into ${table} (${cols.join(', ')}) values\n${rows.map((r) => `  (${r.join(', ')})`).join(',\n')};\n\n`;
}

const BUILT_IN: Record<string, string> = {
  mainMat: 'main_materials', netMat: 'network_list', instr: 'instructions', install: 'installation', info: 'information', link: 'external_link'
};
const CUSTOM: Record<string, string> = { pdf: 'custom_pdf', checklist: 'custom_checklist', text: 'custom_text', gallery: 'custom_gallery', link: 'custom_link' };

const blockId = (sectorId: string, slot: string) => `${sectorId}:${slot}`;

function fileCols(f: FileRef | undefined, prev?: string) {
  return [lit(f?.id), lit(f?.name), lit(f?.size), lit(f?.pages), lit(f?.uploadedAt), lit(f?.uploadedBy ?? null), lit(prev)];
}
function metaCols(m: ContentMeta) {
  return [lit(m.edited?.by), lit(m.edited?.at), lit(m.final?.by), lit(m.final?.at), lit(m.unlocked?.by), lit(m.unlocked?.at)];
}

export function demoSql(d: OpsData): string {
  const people = d.people.map((p) => [lit(p.id), txt(p.name), txt(p.role), lit(p.email), lit(p.active), lit(p.deactivatedAt), lit(p.deactivatedBy), lit(p.addedInlineAt)]);

  const sectors = d.sectors.map((s) => [
    lit(s.id), txt(s.name), lit(s.group), lit(s.leadId), lit(s.ownerId), txt(s.location), lit(s.day), lit(s.from), lit(s.to), lit(s.build),
    lit(!!s.noFloorplans), lit(s.archived?.at), lit(s.archived?.by), lit(s.archived?.reason), lit(s.packetPrintedAt), lit(s.contentChangedAt)
  ]);
  const related = d.sectors.filter((s) => s.xref).map((s) =>
    `update sectors set related_sector_id = ${lit(s.xref!.sectorId)}, related_text = ${lit(s.xref!.text)}, related_tail = ${lit(s.xref!.tail)} where id = ${lit(s.id)};`);

  const blocks: string[][] = [];
  const items: string[][] = [];
  const steps: string[][] = [];
  const info: string[][] = [];
  const photos: string[][] = [];
  const tasks: string[][] = [];

  const block = (s: Sector, slot: string, kind: string, opts: { plan?: string; name?: string; on: boolean; pos: number; label?: string; url?: string; foot?: string; file?: FileRef; prev?: string; meta?: ContentMeta }) => {
    blocks.push([lit(blockId(s.id, slot)), lit(s.id), lit(slot), lit(kind), lit(opts.plan), lit(opts.name), lit(opts.on), lit(opts.pos),
      lit(opts.label), lit(opts.url), lit(opts.foot), ...fileCols(opts.file, opts.prev), ...metaCols(opts.meta ?? {})]);
  };

  d.sectors.forEach((s) => {
    PLAN_KINDS.forEach((k, i) => {
      const p = s.plans[k.key];
      block(s, `plan:${k.key}`, 'floorplan', { plan: k.key, on: p.required, pos: i, file: p.file, prev: p.prevUploadedAt });
    });
    (['mainMat', 'netMat', 'instr', 'install', 'info', 'link'] as const).forEach((k, i) => {
      const b = s.blocks[k];
      const id = blockId(s.id, k);
      block(s, k, BUILT_IN[k], { on: b.on, pos: 10 + i, meta: b,
        ...(k === 'link' ? { label: s.blocks.link.label, url: s.blocks.link.url } : {}) });
      if (k === 'mainMat' || k === 'netMat') s.blocks[k].rows.forEach((r, n) => items.push([lit(r.id), lit(id), lit(n), txt(r.item), lit(r.qty), lit(r.note), lit(r.checked)]));
      if (k === 'instr' || k === 'install') s.blocks[k].steps.forEach((st, n) => steps.push([lit(st.id), lit(id), lit(n), txt(st.text), lit(st.done)]));
      if (k === 'info') s.blocks.info.rows.forEach((r, n) => info.push([lit(r.id), lit(id), lit(n), txt(r.label), txt(r.value)]));
    });
    s.custom.forEach((c, i) => {
      const id = blockId(s.id, c.id);
      block(s, c.id, CUSTOM[c.kind], { name: c.name, on: c.on, pos: 20 + i, label: c.label, url: c.url, foot: c.foot, file: c.file, meta: c });
      (c.rows ?? []).forEach((r, n) => items.push([lit(r.id), lit(id), lit(n), txt(r.item), lit(r.qty), lit(r.note), lit(r.checked)]));
      (c.steps ?? []).forEach((st, n) => steps.push([lit(st.id), lit(id), lit(n), txt(st.text), lit(st.done)]));
      (c.shots ?? []).forEach((sh, n) => photos.push([lit(sh.id), lit(id), lit(n), txt(sh.title), txt(sh.caption)]));
    });
    Object.entries(s.tasks ?? {}).forEach(([slot, t]) => {
      const b = blockId(s.id, PLAN_KINDS.some((k) => k.key === slot) ? `plan:${slot}` : slot);
      tasks.push([lit(`${b}:task`), lit(b), lit(t.due), lit(t.who), lit(t.who === ''), lit(t.note?.text), lit(t.note?.by), lit(t.note?.at),
        lit(d.tasksUpdated?.by), lit(d.tasksUpdated?.at)]);
    });
  });

  return [
    '-- JJCON SetUp · step 2 · demo data',
    '-- Run once, after 01_tables.sql, in Supabase → SQL Editor → New query → paste → Run.',
    `-- The demo's people, sectors, plans, lists, steps and task deadlines, as of ${new Date().toISOString().slice(0, 10)}.`,
    '-- Floorplan files point at the demo drawings by name; the real PDF files arrive with step 3 (Storage).',
    '',
    'begin;',
    '',
    insert('people', ['id', 'name', 'job_title', 'email', 'active', 'deactivated_at', 'deactivated_by', 'added_inline_at'], people).trimEnd(),
    '',
    insert('sectors', ['id', 'name', 'sector_group', 'lead_id', 'owner_id', 'location', 'build_day', 'window_from', 'window_to', 'build_status',
      'no_floorplans', 'archived_at', 'archived_by', 'archive_reason', 'packet_printed_at', 'content_changed_at'], sectors).trimEnd(),
    '',
    related.join('\n'),
    '',
    insert('content_blocks', ['id', 'sector_id', 'slot', 'kind', 'plan_key', 'name', 'is_on', 'position', 'link_label', 'link_url', 'footnote',
      'file_path', 'file_name', 'file_size', 'file_pages', 'file_uploaded_at', 'file_uploaded_by', 'file_replaced_uploaded_at',
      'edited_by', 'edited_at', 'final_by', 'final_at', 'unlocked_by', 'unlocked_at'], blocks).trimEnd(),
    '',
    insert('material_items', ['id', 'block_id', 'position', 'item', 'quantity', 'note', 'arrived'], items).trimEnd(),
    '',
    insert('steps', ['id', 'block_id', 'position', 'text', 'finished'], steps).trimEnd(),
    '',
    insert('info_rows', ['id', 'block_id', 'position', 'label', 'value'], info).trimEnd(),
    '',
    insert('photo_entries', ['id', 'block_id', 'position', 'title', 'caption'], photos).trimEnd(),
    '',
    insert('tasks', ['id', 'block_id', 'due_date', 'responsible_id', 'unassigned', 'note_text', 'note_by', 'note_at', 'updated_by', 'updated_at'], tasks).trimEnd(),
    '',
    'commit;',
    ''
  ].join('\n');
}
