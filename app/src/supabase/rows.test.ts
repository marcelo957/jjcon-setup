import { seedData } from '../ops/data/seed';
import type { OpsData } from '../ops/data/types';
import { diffRows, fromRows, toRows } from './rows';

const seed = () => seedData(new Date('2026-10-24T12:00:00Z'));
/** Same content regardless of order, undefined fields, or no tasks written vs an empty task list. */
const norm = (d: OpsData) => JSON.parse(JSON.stringify({
  ...d,
  people: [...d.people].sort((a, b) => a.id.localeCompare(b.id)),
  sectors: [...d.sectors].sort((a, b) => a.id.localeCompare(b.id)).map((s) => ({ ...s, tasks: s.tasks ?? {} }))
}));

describe('app data as database rows', () => {
  it('comes back from the rows exactly as it went in', () => {
    const d = seed();
    expect(norm(fromRows(toRows(d)))).toEqual(norm(d));
  });

  it('reads timestamps, dates and times the way the database returns them', () => {
    const t = toRows(seed());
    t.sectors.forEach((r) => { r.window_from = `${r.window_from}:00`; if (r.content_changed_at) r.content_changed_at = (r.content_changed_at as string).replace('.000Z', '+00:00'); });
    expect(norm(fromRows(t))).toEqual(norm(seed()));
  });

  it('writes only the rows that changed, and deletes the ones that went', () => {
    const before = seed();
    const after = structuredClone(before);
    const s = after.sectors.find((x) => x.id === 'customer')!;
    s.blocks.mainMat.rows[0].checked = !s.blocks.mainMat.rows[0].checked;
    s.blocks.instr.steps.pop();
    const diff = diffRows(toRows(before), toRows(after));
    expect(diff.upsert).toEqual({ material_items: [expect.objectContaining({ id: s.blocks.mainMat.rows[0].id, arrived: s.blocks.mainMat.rows[0].checked })] });
    expect(diff.remove).toEqual({ steps: [before.sectors.find((x) => x.id === 'customer')!.blocks.instr.steps.at(-1)!.id] });
    expect(diff.count).toBe(2);
  });

  it("doesn't rewrite every task when one task changes", () => {
    const before = seed();
    const after = structuredClone(before);
    const s = after.sectors.find((x) => x.id === 'customer')!;
    s.tasks = { ...s.tasks, A: { ...s.tasks?.A, due: '2027-08-01' } };
    after.tasksUpdated = { by: 'p-marcelo', at: '2026-10-28T10:00:00.000Z' };
    const diff = diffRows(toRows(before), toRows(after));
    expect(diff.upsert.tasks).toHaveLength(1);
    expect(diff.upsert.tasks![0]).toMatchObject({ id: 'customer:plan:A:task', due_date: '2027-08-01', updated_by: 'p-marcelo' });
  });
});
