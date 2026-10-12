import { SHEET_DETAIL, SHEET_SPECS, type SheetSpec } from '../data/seed';
import type { PlanKey } from '../data/types';
import { planKind } from '../data/meta';

/**
 * Writes the sample floorplan PDFs that stand in for real uploads in the demo data: the
 * schematic sheets from the design (stations, tables, banners, network, power), with a title
 * block and legend inside the drawing, in black and grey so they print cleanly.
 */

type Layer = 'tables' | 'chairs' | 'stanchions' | 'stations' | 'network' | 'banners' | 'power' | 'cords';
interface Item { l: Layer; x: number; y: number; w: number; h: number; label: string; ctx?: boolean }

const LAYERS: Record<PlanKey, { layers: Layer[]; context: Layer[] }> = {
  G: { layers: ['stations', 'tables', 'banners'], context: ['power', 'cords'] },
  A: { layers: ['tables', 'chairs', 'stanchions', 'stations'], context: [] },
  B: { layers: ['network'], context: ['stations', 'tables'] },
  C: { layers: ['banners'], context: ['stations', 'tables'] },
  D: { layers: ['power', 'cords'], context: ['stations', 'tables'] }
};

const LAYER_LABEL: Record<Layer, string> = {
  tables: 'Tables', chairs: 'Chairs', stanchions: 'Stanchions', stations: 'Stations',
  network: 'Computer network', banners: 'Sign banners', power: 'Power drops', cords: 'Extension cords'
};

/** The design's plan generator (genPlan), unchanged. */
function genPlan(fp: SheetSpec): Item[] {
  const it: Item[] = [];
  const add = (l: Layer, x: number, y: number, w: number, h: number, label = '') => it.push({ l, x, y, w, h, label });
  const bl = fp.bl ?? [], nb = bl.length;
  if (nb) { const gap = 40, w = (800 - gap * (nb - 1)) / nb; bl.forEach((t, i) => add('banners', 40 + i * (w + gap), 20, w, 30, t)); }
  const top = nb ? 78 : 40;
  const ns = fp.stations ?? 0;
  if (ns) {
    if (fp.kind === 'line') {
      const w = fp.stW ?? 90, h = fp.stH ?? 140;
      const gap = ns > 1 ? Math.max(10, (800 - ns * w) / (ns - 1)) : 0;
      const x0 = 40 + Math.max(0, (800 - (ns * w + (ns - 1) * gap)) / 2);
      for (let i = 0; i < ns; i++) add('stations', x0 + i * (w + gap), top, w, h, `${fp.st ?? 'ZONE'} ${i + 1}`);
    } else {
      const per = fp.kind === 'grid' ? Math.min(7, Math.ceil(ns / 2)) : Math.min(6, ns);
      const w = Math.floor((800 - (per - 1) * 18) / per), h = fp.stH ?? 90;
      for (let i = 0; i < ns; i++) { const r = Math.floor(i / per), c = i % per; add('stations', 40 + c * (w + 18), top + r * (h + 18), w, h, `${fp.st ?? 'STATION'} ${i + 1}`); }
    }
  }
  const nt = fp.tables ?? 0;
  if (nt) { const w = Math.floor((780 - (nt - 1) * 10) / nt); for (let i = 0; i < nt; i++) add('tables', 60 + i * (w + 10), 378, w, 38, `${fp.tb ?? 'T'}${i + 1}`); }
  const nc = fp.chairs ?? 0;
  if (nc) { const g = Math.floor(740 / Math.max(1, nc)); for (let i = 0; i < nc; i++) add('chairs', 70 + i * g, 436, 22, 22); }
  const nstn = fp.stanch ?? 0;
  if (nstn) {
    const g = Math.floor(700 / Math.max(1, nstn - 1 || 1));
    for (let i = 0; i < nstn; i++) add('stanchions', 70 + i * g, 482, 18, 18);
    add('stanchions', 79, 491, Math.max(120, (nstn - 1) * g), 0, `BELT QUEUE — ${nstn} POSTS`);
  }
  const np = fp.power ?? 0, perP = Math.min(6, Math.max(1, np)), gapP = Math.floor(720 / Math.max(1, perP - 1 || 1));
  for (let i = 0; i < np; i++) { const r = Math.floor(i / perP), c = i % perP; add('power', 70 + c * gapP, 284 + r * 50, 36, 36, `P-${i + 1}`); }
  const ncd = fp.cords ?? 0;
  for (let i = 0; i < ncd; i++) { const r = Math.floor(i / perP), c = i % perP; add('cords', 108 + c * gapP, 300 + r * 50, Math.min(140, Math.max(60, gapP - 24)), 0, 'EXT 15 m'); }
  const nn = fp.network ?? 0;
  if (nn) { add('network', 772, top - 34, 64, 34, 'SW-1'); for (let i = 1; i < nn; i++) add('network', 200 + (i - 1) * 200, top - 34, 34, 34, `AP-${i}`); }
  return it;
}

const W = 880, H = 660, DRAW_H = 540;

// WinAnsi bytes for the few non-ASCII characters the sheets use.
const WIN: Record<string, number> = { '—': 0x97, '–': 0x96, '·': 0xb7, '×': 0xd7, '²': 0xb2, '’': 0x92 };
function pdfString(t: string): string {
  let out = '';
  for (const ch of t) {
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (WIN[ch]) out += '\\' + WIN[ch].toString(8).padStart(3, '0');
    else if (ch.charCodeAt(0) < 128) out += ch;
    else out += '?';
  }
  return `(${out})`;
}

const textWidth = (t: string, size: number, mono = false) => t.length * size * (mono ? 0.6 : 0.52);

class Ops {
  parts: string[] = [];
  push(s: string) { this.parts.push(s); return this; }
  /** Rectangle in top-left page coordinates. */
  rect(x: number, y: number, w: number, h: number, op: 'S' | 'f' | 'B') { return this.push(`${x.toFixed(1)} ${(H - y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${op}`); }
  line(x1: number, y1: number, x2: number, y2: number) { return this.push(`${x1.toFixed(1)} ${(H - y1).toFixed(1)} m ${x2.toFixed(1)} ${(H - y2).toFixed(1)} l S`); }
  text(t: string, x: number, y: number, size: number, font: 'F1' | 'F2' | 'F3' = 'F1') {
    return this.push(`BT /${font} ${size} Tf ${x.toFixed(1)} ${(H - y).toFixed(1)} Td ${pdfString(t)} Tj ET`);
  }
  centred(t: string, cx: number, cy: number, size: number, font: 'F1' | 'F2' | 'F3' = 'F3') {
    return this.text(t, cx - textWidth(t, size, font === 'F3') / 2, cy + size * 0.35, size, font);
  }
}

function drawItem(o: Ops, i: Item) {
  const ink = i.ctx ? '0.7' : '0';
  o.push('q').push(`${ink} G ${ink} g`).push('[] 0 d');
  const cx = i.x + i.w / 2, cy = i.y + i.h / 2;
  switch (i.l) {
    case 'banners':
      o.rect(i.x, i.y, i.w, i.h, 'f').push('1 g').centred(i.label, cx, cy, 12);
      break;
    case 'stations':
      o.push('2 w [6 4] 0 d').rect(i.x, i.y, i.w, i.h, 'S').push('[] 0 d').centred(i.label, cx, cy, 11);
      break;
    case 'tables':
      o.push('2 w 0.91 g').rect(i.x, i.y, i.w, i.h, 'B').push(`${ink} g`).centred(i.label, cx, cy, 13);
      break;
    case 'chairs':
      o.push('1.5 w').rect(i.x, i.y, i.w, i.h, 'S');
      break;
    case 'stanchions':
      if (i.h === 0) o.push('2 w [2 3] 0 d').line(i.x, i.y, i.x + i.w, i.y).push('[] 0 d').text(i.label, i.x + 4, i.y - 6, 10, 'F3');
      else o.push('2 w').push(circle(cx, H - cy, i.w / 2));
      break;
    case 'network':
      o.rect(i.x, i.y, i.w, i.h, 'f').push('1 g').centred(i.label, cx, cy, 10);
      break;
    case 'power':
      o.push('q').push(`${i.x.toFixed(1)} ${(H - i.y - i.h).toFixed(1)} ${i.w.toFixed(1)} ${i.h.toFixed(1)} re W n`).push('1.5 w');
      for (let d = -i.h; d < i.w; d += 6) o.line(i.x + d, i.y + i.h, i.x + d + i.h, i.y);
      o.push('Q').push('2 w').rect(i.x, i.y, i.w, i.h, 'S');
      o.push('1 g').rect(cx - 14, cy - 7, 28, 14, 'f').push(`${ink} g`).centred(i.label, cx, cy, 11, 'F2');
      break;
    case 'cords':
      o.push('2 w [5 4] 0 d').line(i.x, i.y, i.x + i.w, i.y).push('[] 0 d').text(i.label, i.x + 6, i.y - 6, 10, 'F3');
      break;
  }
  o.push('Q');
}

function circle(cx: number, cy: number, r: number) {
  const k = 0.5523 * r;
  return `${(cx + r).toFixed(1)} ${cy.toFixed(1)} m ${(cx + r).toFixed(1)} ${(cy + k).toFixed(1)} ${(cx + k).toFixed(1)} ${(cy + r).toFixed(1)} ${cx.toFixed(1)} ${(cy + r).toFixed(1)} c `
    + `${(cx - k).toFixed(1)} ${(cy + r).toFixed(1)} ${(cx - r).toFixed(1)} ${(cy + k).toFixed(1)} ${(cx - r).toFixed(1)} ${cy.toFixed(1)} c `
    + `${(cx - r).toFixed(1)} ${(cy - k).toFixed(1)} ${(cx - k).toFixed(1)} ${(cy - r).toFixed(1)} ${cx.toFixed(1)} ${(cy - r).toFixed(1)} c `
    + `${(cx + k).toFixed(1)} ${(cy - r).toFixed(1)} ${(cx + r).toFixed(1)} ${(cy - k).toFixed(1)} ${(cx + r).toFixed(1)} ${cy.toFixed(1)} c S`;
}

function pageContent(items: Item[], o: { sheetName: string; sub: string; meta: string; page: number; pages: number; zoom: boolean }): string {
  const c = new Ops();
  c.push('0 G 0 g 2 w').rect(1, 1, W - 2, H - 2, 'S');
  c.push('q').push(`0 ${H - DRAW_H} ${W} ${DRAW_H} re W n`);
  // The design's detail sheet: scale(1.75) translate(-70px, -150px) from the top-left corner.
  if (o.zoom) c.push(`1.75 0 0 1.75 ${-70 * 1.75} ${-0.75 * H + 150 * 1.75} cm`);
  items.forEach((i) => drawItem(c, i));
  c.push('Q');
  // Title block and legend band
  const bandTop = H - 118;
  c.push('0 G 2 w').line(0, bandTop, W, bandTop).push('1 w').line(250, bandTop, 250, H);
  c.text(o.sheetName, 12, bandTop + 22, 15, 'F2');
  c.text(o.sub, 12, bandTop + 40, 12, 'F1');
  c.text(o.meta, 12, H - 26, 11, 'F3');
  c.text(`Sheet ${o.page} of ${o.pages}`, 12, H - 12, 11, 'F3');
  const prim = items.filter((i) => !i.ctx);
  const seen: Layer[] = [];
  prim.forEach((i) => { if (!seen.includes(i.l)) seen.push(i.l); });
  let lx = 262, ly = bandTop + 12;
  const entries = seen.map((l) => ({ l, label: `${LAYER_LABEL[l]}  ${prim.filter((p) => p.l === l).length} on plan` }));
  if (items.some((i) => i.ctx)) entries.push({ l: 'tables', label: 'Grey outlines are context from the furniture sheet' });
  entries.forEach((e, idx) => {
    const wEntry = 34 + textWidth(e.label, 12);
    if (lx + wEntry > W - 12) { lx = 262; ly += 22; }
    const ctx = idx === seen.length;
    drawItem(c, { l: ctx ? 'tables' : e.l, x: lx, y: ly, w: 26, h: e.l === 'cords' ? 0 : 16, label: '', ctx });
    c.push('0 g').text(e.label, lx + 34, ly + 12, 12);
    lx += wEntry + 18;
  });
  return c.parts.join('\n');
}

function assemble(pages: string[]): Uint8Array {
  const objs: string[] = [];
  const add = (s: string) => { objs.push(s); return objs.length; };
  const fonts = [
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>')
  ];
  const pagesId = objs.length + 1 + pages.length * 2;
  const kids: number[] = [];
  pages.forEach((content) => {
    const bytes = latin1(content);
    const cid = add(`<< /Length ${bytes.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${cid} 0 R /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> >>`));
  });
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(latin1(out).length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = latin1(out).length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1(out);
}

function latin1(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

const FALLBACK: SheetSpec = { kind: 'line', stations: 4, st: 'ZONE', stW: 150, stH: 200 };

/** The sample PDF for one plan of one demo sector. */
export function samplePlanPdf(sectorId: string, sectorName: string, key: PlanKey, pages: number, uploadedOn: string): Uint8Array {
  const all = genPlan(SHEET_SPECS[sectorId] ?? FALLBACK);
  const { layers, context } = LAYERS[key];
  let items = [...all.filter((i) => context.includes(i.l)).map((i) => ({ ...i, ctx: true })), ...all.filter((i) => layers.includes(i.l))];
  if (!items.some((i) => !i.ctx)) items = all.filter((i) => i.l === 'stations');
  const kind = planKind(key);
  const detail = SHEET_DETAIL[`${sectorId}-${key}`];
  return assemble(Array.from({ length: pages }, (_, n) => pageContent(items, {
    sheetName: kind.name.toUpperCase(),
    sub: `${sectorName} · ${n > 0 && detail ? detail : 'General arrangement'}`,
    meta: `Scale 1:100 · ${uploadedOn}`,
    page: n + 1, pages, zoom: n > 0
  })));
}
