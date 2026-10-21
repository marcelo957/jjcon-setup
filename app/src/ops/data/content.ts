import type { Blocks, ContentMeta, CustomBlock, Sector } from './types';

/**
 * Written blocks carry no status. What they hold is the status: a block is empty or it isn't,
 * and the deadline says whether empty is late. Rows and steps with no text don't count.
 */

/** The built-in blocks that hold written content (everything but plans). */
export const CONTENT_KEYS = ['mainMat', 'netMat', 'instr', 'install', 'info', 'link'] as const;
export type ContentKey = typeof CONTENT_KEYS[number];
export const isContentKey = (k: string): k is ContentKey => (CONTENT_KEYS as readonly string[]).includes(k);

export interface ContentState {
  /** How much is in it: "12 items", "8 steps". Empty string when empty. */
  summary: string;
  count: number;
  empty: boolean;
  meta: ContentMeta;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const filled = (s: string | undefined) => !!s && s.trim() !== '';

function measure(kind: 'list' | 'steps' | 'info' | 'link' | 'photos', n: number, label?: string) {
  if (!n) return '';
  if (kind === 'list') return plural(n, 'item');
  if (kind === 'steps') return plural(n, 'step');
  if (kind === 'info') return plural(n, 'row');
  if (kind === 'photos') return plural(n, 'photo');
  return label || 'Link set';
}

/** A built-in block's content state. */
export function blockState(b: Blocks, k: ContentKey): ContentState {
  let n = 0;
  let kind: Parameters<typeof measure>[0] = 'list';
  let label: string | undefined;
  if (k === 'mainMat' || k === 'netMat') n = b[k].rows.filter((r) => filled(r.item)).length;
  else if (k === 'instr' || k === 'install') { kind = 'steps'; n = b[k].steps.filter((s) => filled(s.text)).length; }
  else if (k === 'info') { kind = 'info'; n = b.info.rows.filter((r) => filled(r.label) || filled(r.value)).length; }
  else { kind = 'link'; n = filled(b.link.url) ? 1 : 0; label = b.link.label; }
  return { summary: measure(kind, n, label), count: n, empty: n === 0, meta: b[k] };
}

/** A custom block's content state, or null for a PDF block (those are uploads). */
export function customState(c: CustomBlock): ContentState | null {
  if (c.kind === 'pdf') return null;
  const [kind, n] = c.kind === 'checklist' ? ['list', (c.rows ?? []).filter((r) => filled(r.item)).length] as const
    : c.kind === 'text' ? ['steps', (c.steps ?? []).filter((s) => filled(s.text)).length] as const
    : c.kind === 'gallery' ? ['photos', (c.shots ?? []).filter((s) => filled(s.title)).length] as const
    : ['link', filled(c.url) ? 1 : 0] as const;
  return { summary: measure(kind, n, c.label), count: n, empty: n === 0, meta: c };
}

/** Content state for a task slot on a sector: a built-in block key or a custom block id. Null for uploads. */
export function slotState(s: Sector, slot: string): ContentState | null {
  if (isContentKey(slot)) return blockState(s.blocks, slot);
  const c = s.custom.find((x) => x.id === slot);
  return c ? customState(c) : null;
}

/** The meta object to stamp for a slot, on a sector being changed. */
export function slotMeta(s: Sector, slot: string): ContentMeta | null {
  if (isContentKey(slot)) return s.blocks[slot];
  const c = s.custom.find((x) => x.id === slot);
  return c && c.kind !== 'pdf' ? c : null;
}

/** Every written block that is switched on, as task slots. */
export function contentSlots(s: Sector): string[] {
  return [...CONTENT_KEYS.filter((k) => s.blocks[k].on), ...s.custom.filter((c) => c.on && c.kind !== 'pdf').map((c) => c.id)];
}

/** The content alone, without on-site ticks or metadata: two equal fingerprints mean nothing was edited. */
export function contentPrint(s: Sector, slot: string): string {
  const strip = (v: unknown) => JSON.stringify(v, (k, x) => (['checked', 'done', 'edited', 'final', 'unlocked', 'on'].includes(k) ? undefined : x));
  if (isContentKey(slot)) return strip(s.blocks[slot]);
  const c = s.custom.find((x) => x.id === slot);
  return c ? strip({ rows: c.rows, steps: c.steps, shots: c.shots, label: c.label, url: c.url, foot: c.foot, name: c.name }) : '';
}

/** Locked as final: content can't change until someone unlocks it. */
export const isFinal = (m: ContentMeta | null | undefined) => !!m?.final;
