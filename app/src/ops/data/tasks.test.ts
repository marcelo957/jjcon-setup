import { OpsStore } from './store';
import { addDays, dayDiff, taskRows, toIsoDay } from './tasks';

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
  it('marks done with who and when, and undoes it', () => {
    const s = store();
    const before = s.sector('crown')!.contentChangedAt;
    s.setTaskDone(['crown:mainMat'], true, 'p-diego');
    let r = taskRows(s.get(), today).find((x) => x.key === 'crown:mainMat')!;
    expect(r).toMatchObject({ done: true, doneBy: 'p-diego', late: false });
    expect(s.sector('crown')!.contentChangedAt).toBe(before);
    expect(s.get().tasksUpdated!.by).toBe('p-diego');
    s.setTaskDone(['crown:mainMat'], false, 'p-diego');
    r = taskRows(s.get(), today).find((x) => x.key === 'crown:mainMat')!;
    expect(r.done).toBe(false);
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
