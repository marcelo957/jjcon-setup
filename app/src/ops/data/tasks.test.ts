import { OpsStore } from './store';
import { addDays, dayDiff, sectorStatus, taskRows, toIsoDay } from './tasks';

const now = new Date('2026-10-12T15:00:00');
const today = toIsoDay(now);
const store = () => new OpsStore(localStorage, () => now);

describe('task rows', () => {
  it('has one row per required plan and enabled block, in sector order', () => {
    const rows = taskRows(store().get(), today);
    const pod = rows.filter((r) => r.sectorId === 'pod-jjc').map((r) => r.item);
    expect(pod).toEqual(['Floorplan — General Layout', 'Floorplan — Tables, Chairs & Stanchions', 'Floorplan — Sign Banners', 'Main material list', 'Instructions']);
    // Championship Jiu-Jitsu Con has nothing chosen yet, so it has no rows.
    expect(rows[0].sector).toBe('Championship Master');
    expect(rows.some((r) => r.sectorId === 'champ-jjc')).toBe(false);
    expect(rows.some((r) => r.sectorId === 'crates')).toBe(false);
    const truss = rows.filter((r) => r.sectorId === 'truss').map((r) => r.item);
    expect(truss).toContain('Image gallery — Reference images');
  });

  it('seeds deadlines around today so late and soon items show', () => {
    const rows = taskRows(store().get(), today);
    expect(rows.filter((r) => r.late).length).toBeGreaterThan(5);
    expect(rows.filter((r) => r.soon).length).toBeGreaterThan(5);
    expect(rows.filter((r) => !r.done && r.who === '').map((r) => r.key).sort()).toEqual(['champ-wm:D', 'ent-mak:C', 'pod-wm:netMat']);
    expect(rows.find((r) => r.key === 'store:netMat')!.note?.text).toMatch(/till vendor/);
  });

  it('defaults instructions to the lead and plans to the owner', () => {
    const rows = taskRows(store().get(), today);
    expect(rows.find((r) => r.key === 'ent-mak:instr')!.who).toBe('p-marcelo');
    expect(rows.find((r) => r.key === 'ent-mak:A')!.who).toBe('p-gordo');
  });
});

describe('task actions', () => {
  it('a written block is in place while it holds something, whatever was marked before', () => {
    const s = store();
    const key = 'crates:mainMat';
    const row = () => taskRows(s.get(), today).find((x) => x.key === key);
    // Crates is outside the dashboard's active rows only by archive; restore it for the check.
    s.restore('crates');
    s.unlockFinal('crates', 'mainMat', 'p-diego');
    expect(row()).toMatchObject({ kind: 'content', done: true });
    expect(row()!.summary).toMatch(/^\d+ items?$/);
    s.saveSector('crates', (x) => { x.blocks.mainMat.rows = []; }, 'p-diego');
    expect(row()).toMatchObject({ done: false, summary: '' });
    expect(s.sector('crates')!.blocks.mainMat.edited).toMatchObject({ by: 'p-diego' });
  });

  it('records who edited a block, and only the block that changed', () => {
    const s = store();
    s.unlockFinal('rooms', 'mainMat', 'p-marcelo');
    const instrBefore = s.sector('rooms')!.blocks.instr.edited;
    s.saveSector('rooms', (x) => { x.blocks.mainMat.rows[0].qty += 1; }, 'p-diego');
    expect(s.sector('rooms')!.blocks.mainMat.edited).toEqual({ by: 'p-diego', at: now.toISOString() });
    expect(s.sector('rooms')!.blocks.instr.edited).toEqual(instrBefore);
  });

  it('keeps a final block exactly as it is until someone unlocks it', () => {
    const s = store();
    s.markFinal('rooms', 'mainMat', 'p-marcelo');
    const rows = s.sector('rooms')!.blocks.mainMat.rows.length;
    s.saveSector('rooms', (x) => { x.blocks.mainMat.rows = []; }, 'p-diego');
    expect(s.sector('rooms')!.blocks.mainMat.rows).toHaveLength(rows);
    expect(s.sector('rooms')!.blocks.mainMat.final).toMatchObject({ by: 'p-marcelo' });
    s.unlockFinal('rooms', 'mainMat', 'p-diego');
    expect(s.sector('rooms')!.blocks.mainMat).toMatchObject({ unlocked: { by: 'p-diego' } });
    expect(s.sector('rooms')!.blocks.mainMat.final).toBeUndefined();
    s.saveSector('rooms', (x) => { x.blocks.mainMat.rows = []; }, 'p-diego');
    expect(taskRows(s.get(), today).find((r) => r.key === 'rooms:mainMat')!.done).toBe(false);
  });

  it('reassigns and shifts deadlines in bulk', () => {
    const s = store();
    const keys = ['crown:G', 'crown:A'];
    const due = (k: string) => taskRows(s.get(), today).find((x) => x.key === k)!.due;
    const before = keys.map(due);
    s.shiftTaskDue(keys, 7, 'p-marcelo', due);
    expect(keys.map(due)).toEqual(before.map((d) => addDays(d, 7)));
    s.setTaskWho(keys, '', 'p-marcelo');
    expect(taskRows(s.get(), today).filter((r) => keys.includes(r.key)).every((r) => r.who === '')).toBe(true);
  });

  it('saves and removes a delay note', () => {
    const s = store();
    s.setTaskNote('crown:G', '  Waiting on the venue.  ', 'p-diego');
    expect(s.sector('crown')!.tasks!.G.note).toMatchObject({ text: 'Waiting on the venue.', by: 'p-diego' });
    s.setTaskNote('crown:G', '', 'p-diego');
    expect(s.sector('crown')!.tasks!.G.note).toBeUndefined();
  });
});

it('counts calendar days', () => {
  expect(dayDiff('2026-10-12', '2026-10-15')).toBe(3);
  expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
});

describe('sector status', () => {
  // Podium Jiu-Jitsu Con requires plans G, A and C, the main material list and instructions.
  const empty = () => {
    const s = structuredClone(store().sector('pod-jjc')!);
    Object.values(s.plans).forEach((p) => { delete p.file; });
    s.blocks.mainMat.rows = [];
    s.blocks.instr.steps = [];
    return s;
  };
  const file = { id: 'f-1', name: 'plan.pdf', size: 1, pages: 1, uploadedAt: '2026-10-12T00:00:00.000Z' };
  const fill = (s: ReturnType<typeof empty>) => {
    (['G', 'A', 'C'] as const).forEach((k) => { s.plans[k].file = { ...file }; });
    s.blocks.mainMat.rows = [{ id: 'r1', item: 'Table', qty: 1, checked: false }];
    s.blocks.instr.steps = [{ id: 's1', text: 'Build it', done: false }];
    return s;
  };

  it('is Not started with nothing filled in, In progress with some, Complete with every required item', () => {
    const s = empty();
    expect(sectorStatus(s)).toBe('none');
    s.plans.G.file = { ...file };
    expect(sectorStatus(s)).toBe('progress');
    fill(s);
    expect(sectorStatus(s)).toBe('complete');
  });

  it('goes back down as soon as content is removed', () => {
    const s = fill(empty());
    delete s.plans.A.file;
    expect(sectorStatus(s)).toBe('progress');
    s.blocks.instr.steps = [];
    (['G', 'C'] as const).forEach((k) => { delete s.plans[k].file; });
    expect(sectorStatus(s)).toBe('progress');
    s.blocks.mainMat.rows = [];
    expect(sectorStatus(s)).toBe('none');
  });

  it('ignores blocks and plans the sector does not require', () => {
    const s = fill(empty());
    expect(s.plans.B.required).toBe(false);
    expect(s.blocks.netMat.on).toBe(false);
    expect(sectorStatus(s)).toBe('complete');
    const other = empty();
    other.blocks.netMat.rows = [{ id: 'n1', item: 'Switch', qty: 1, checked: false }];
    other.plans.B.file = { ...file };
    expect(sectorStatus(other)).toBe('none');
  });

  it('is Not started for a sector that requires nothing', () => {
    const s = fill(empty());
    Object.values(s.plans).forEach((p) => { p.required = false; });
    (['mainMat', 'netMat', 'instr', 'install', 'info', 'link'] as const).forEach((k) => { s.blocks[k].on = false; });
    s.custom = [];
    expect(sectorStatus(s)).toBe('none');
  });
});
