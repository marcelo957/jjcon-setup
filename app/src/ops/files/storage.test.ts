import { vi } from 'vitest';
import { opsStore } from '../data/store';
import { taskRows, toIsoDay } from '../data/tasks';

const upload = vi.fn(async () => ({ data: {}, error: null as null | { message: string } }));
const remove = vi.fn(async () => ({ data: [{}], error: null }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock('../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ upload, remove, download: vi.fn() }) }, rpc } }));

const { storePdf, discardPdf } = await import('./fileStore');

const pdf = () => new File(['%PDF-1.4 test'], 'Banners plan (v2).pdf', { type: 'application/pdf' });
const row = (sector: string, slot: string) => taskRows(opsStore().get(), toIsoDay(new Date())).find((r) => r.key === `${sector}:${slot}`)!;
const stored = (over: Partial<{ sector_id: string; slot: string; path: string }> = {}) => ({
  sector_id: 'customer', slot: 'plan-A', path: 'customer/plan-A/1-new.pdf', name: 'new.pdf', size: 2048, pages: 2,
  uploaded_at: '2026-10-26T10:00:00Z', uploaded_by: 'p-marcelo', replaced_uploaded_at: '2026-10-20T10:00:00Z', ...over
});

describe('Floorplans in Supabase Storage', () => {
  it('uploads into the sector and plan folder, with the name, pages and replaced date', async () => {
    const f = await storePdf(pdf(), 'p-marcelo', async () => 3, { sectorId: 'customer', slot: 'plan:C' }, '2026-10-01T00:00:00Z');
    expect(f.id).toMatch(/^sb:customer\/plan-C\/\d+-Banners-plan-v2-.pdf$/);
    expect(upload).toHaveBeenCalledWith(f.id.slice(3), expect.any(File), expect.objectContaining({
      contentType: 'application/pdf', metadata: { name: 'Banners plan (v2).pdf', pages: '3', replaces: '2026-10-01T00:00:00Z' }
    }));
  });

  it('explains a refused upload in plain words', async () => {
    upload.mockResolvedValueOnce({ data: {}, error: { message: 'new row violates row-level security policy' } });
    await expect(storePdf(pdf(), 'p-dandre', async () => 1, { sectorId: 'customer', slot: 'plan:A' })).rejects.toThrow(/can't upload plans for this sector/);
  });

  it('removes a stored file from Storage, and a demo drawing through the database', async () => {
    await discardPdf({ id: 'sb:customer/plan-A/1-new.pdf', name: 'n', size: 1, pages: 1, uploadedAt: '' }, { sectorId: 'customer', slot: 'plan:A' });
    expect(remove).toHaveBeenCalledWith(['customer/plan-A/1-new.pdf']);
    await discardPdf({ id: 'sample:customer:D', name: 'n', size: 1, pages: 1, uploadedAt: '' }, { sectorId: 'customer', slot: 'plan:D' });
    expect(rpc).toHaveBeenCalledWith('remove_demo_file', { sid: 'customer', block_slot: 'plan:D' });
  });

  it('shows a file someone else uploaded, and drops it once it is gone from Storage', () => {
    opsStore().applyStoredFiles([stored()], []);
    expect(opsStore().sector('customer')!.plans.A.file).toMatchObject({ id: 'sb:customer/plan-A/1-new.pdf', name: 'new.pdf', pages: 2 });
    expect(row('customer', 'A')).toMatchObject({ done: true, doneBy: 'p-marcelo' });
    opsStore().applyStoredFiles([], []);
    expect(opsStore().sector('customer')!.plans.A.file).toBeUndefined();
    expect(row('customer', 'A').done).toBe(false);
  });

  it('keeps demo drawings until one is removed, then drops just that one', () => {
    const before = opsStore().sector('customer')!.plans.D.file;
    expect(before?.id).toMatch(/^sample:/);
    opsStore().applyStoredFiles([], []);
    expect(opsStore().sector('customer')!.plans.D.file?.id).toBe(before!.id);
    opsStore().applyStoredFiles([], [{ sector_id: 'customer', slot: 'plan:D' }]);
    expect(opsStore().sector('customer')!.plans.D.file).toBeUndefined();
    expect(opsStore().sector('customer')!.plans.A.file?.id).toMatch(/^sample:/);
  });
});
