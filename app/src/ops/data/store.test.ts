import { BLOCK_DEFAULTS } from './meta';
import { activeSectors, isBlocked, otherRoll, planRoll, sectorInventory, sortSectors } from './selectors';
import { newStructure, OpsStore, structureOf } from './store';
import { samplePlanPdf } from '../files/samplePdf';

const now = new Date('2026-10-12T10:00:00Z');
const store = () => new OpsStore(localStorage, () => now);

describe('seed data', () => {
  it('has the design’s 25 active and 2 archived sectors and five people', () => {
    const d = store().get();
    expect(activeSectors(d)).toHaveLength(25);
    expect(d.sectors.filter((s) => s.archived)).toHaveLength(2);
    expect(d.people.map((p) => p.name)).toEqual(['Diego', "D'Andre", 'Gordo', 'Daniela', 'Marcelo']);
  });

  it('counts plans against the required set only', () => {
    const d = store().get();
    const pod = d.sectors.find((s) => s.id === 'pod-jjc')!;
    expect(planRoll(pod)).toMatchObject({ ready: 3, total: 3 });
    const store1 = d.sectors.find((s) => s.id === 'store')!;
    expect(planRoll(store1)).toMatchObject({ ready: 3, total: 5 });
    expect(isBlocked(store1)).toBe(true);
    const truss = d.sectors.find((s) => s.id === 'truss')!;
    expect(otherRoll(truss).items.map((i) => i.name)).toEqual(['Reference images']);
  });
});

describe('sortSectors', () => {
  it('sorts by group, then the full name ignoring case, treating | and — as plain characters', () => {
    const names = sortSectors(store().get().sectors.filter((s) => s.group === 'ibjjf')).map((s) => s.name);
    expect(names.indexOf('Championship Jiu-Jitsu Con')).toBeLessThan(names.indexOf('Championship Master'));
    expect(names.indexOf('Entrance | Black Belt')).toBeLessThan(names.indexOf('Entrance — Athletes | Master Adult Kids'));
  });
});

describe('OpsStore', () => {
  it('creates a sector from the form and slots it alphabetically', () => {
    const s = store();
    const f = { ...newStructure('ibjjf', BLOCK_DEFAULTS.ibjjf), name: 'Warm-up Area' };
    f.plans.G = true;
    const id = s.createSector(f);
    const sec = s.sector(id)!;
    expect(sec.blocks.mainMat.on && sec.blocks.netMat.on && sec.blocks.instr.on).toBe(true);
    expect(planRoll(sec)).toMatchObject({ ready: 0, total: 1 });
    expect(sectorInventory(sec)).toEqual([]);
    const ibjjf = activeSectors(s.get()).filter((x) => x.group === 'ibjjf').map((x) => x.name);
    expect(ibjjf[ibjjf.length - 1]).toBe('Warm-up Area');
  });

  it('keeps content when a block is turned off, and restores it when turned back on', () => {
    const s = store();
    const before = s.sector('pod-wm')!.blocks.mainMat.rows.length;
    const f = structureOf(s.sector('pod-wm')!);
    s.saveStructure('pod-wm', { ...f, blocks: { ...f.blocks, mainMat: false } });
    expect(s.sector('pod-wm')!.blocks.mainMat.on).toBe(false);
    s.saveStructure('pod-wm', f);
    expect(s.sector('pod-wm')!.blocks.mainMat.rows).toHaveLength(before);
  });

  it('archives, restores and deletes', () => {
    const s = store();
    s.archive('square', 'p-marcelo');
    expect(activeSectors(s.get()).some((x) => x.id === 'square')).toBe(false);
    s.restore('square');
    expect(activeSectors(s.get()).some((x) => x.id === 'square')).toBe(true);
    s.remove('square');
    expect(s.sector('square')).toBeUndefined();
  });

  it('checking a row off does not mark the packet out of date', () => {
    const s = store();
    const before = s.sector('rooms')!.contentChangedAt;
    const row = s.sector('rooms')!.blocks.mainMat.rows[5];
    s.toggleRow('rooms', 'mainMat', row.id);
    expect(s.sector('rooms')!.blocks.mainMat.rows[5].checked).toBe(!row.checked);
    expect(s.sector('rooms')!.contentChangedAt).toBe(before);
  });

  it('a new plan file goes back to draft unless the plan was approved', () => {
    const s = store();
    const file = { id: 'f-1', name: 'new.pdf', size: 10, pages: 1, uploadedAt: now.toISOString() };
    s.setPlanFile('store', 'C', file);
    expect(s.sector('store')!.plans.C).toMatchObject({ status: 'draft', file });
    s.setPlanFile('store', 'G', file);
    expect(s.sector('store')!.plans.G.status).toBe('approved');
    expect(s.sector('store')!.plans.G.prevUploadedAt).toBeDefined();
  });

  it('persists across instances', () => {
    store().archive('rooms', 'p-marcelo');
    expect(store().sector('rooms')!.archived).toBeDefined();
  });
});

describe('sample floorplan PDFs', () => {
  it('writes a well-formed PDF with one page per sheet', () => {
    const bytes = samplePlanPdf('power', 'Power Drops', 'D', 2, '12 Oct 2026');
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('POWER DROPS & EXTENSION CORDS');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
