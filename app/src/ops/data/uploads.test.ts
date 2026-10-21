import { isBlocked, planRoll } from './selectors';
import { opsStore } from './store';
import { taskRows, toIsoDay } from './tasks';

const file = { id: 'f-new', name: 'JJC27-banners.pdf', size: 2048, pages: 1, uploadedAt: '2026-10-20T10:00:00.000Z', uploadedBy: 'p-daniela' };
const row = (sectorId: string, slot: string) => taskRows(opsStore().get(), toIsoDay(new Date())).find((r) => r.key === `${sectorId}:${slot}`)!;

describe('Uploads decide their own status', () => {
  it('is done the moment the PDF is uploaded, with no status to set', () => {
    // Championship Master gains the Sign Banners plan; nothing uploaded yet.
    const id = opsStore().get().sectors.find((s) => s.name === 'Championship Master')!.id;
    opsStore().saveSector(id, (s) => { s.plans.C.required = true; delete s.plans.C.file; });
    expect(row(id, 'C')).toMatchObject({ auto: true, done: false });
    opsStore().setPlanFile(id, 'C', file);
    expect(row(id, 'C')).toMatchObject({ done: true, doneBy: 'p-daniela', doneAt: file.uploadedAt });
    const roll = planRoll(opsStore().sector(id)!);
    expect(roll.plans.find((p) => p.key === 'C')!.done).toBe(true);
  });

  it('stays done when the PDF is replaced, and goes back when it is removed', () => {
    const id = 'customer';
    expect(row(id, 'A').done).toBe(true);
    opsStore().setPlanFile(id, 'A', file);
    expect(row(id, 'A').done).toBe(true);
    opsStore().removePlanFile(id, 'A');
    expect(row(id, 'A').done).toBe(false);
    expect(isBlocked(opsStore().sector(id)!)).toBe(true);
  });

  it('ignores a done mark saved by an older version of the app', () => {
    const id = 'customer';
    opsStore().removePlanFile(id, 'A');
    opsStore().saveSector(id, (s) => { (s.tasks!.A as Record<string, unknown>).done = true; });
    expect(row(id, 'A').done).toBe(false);
  });

  it('treats a PDF block the same way', () => {
    const id = 'customer';
    opsStore().saveSector(id, (s) => { s.custom.push({ id: 'cb-sheet', kind: 'pdf', name: 'Seating sheet', on: true }); });
    expect(row(id, 'cb-sheet')).toMatchObject({ auto: true, done: false });
    opsStore().setCustomFile(id, 'cb-sheet', file);
    expect(row(id, 'cb-sheet').done).toBe(true);
    opsStore().removeCustomFile(id, 'cb-sheet');
    expect(row(id, 'cb-sheet').done).toBe(false);
  });
});
