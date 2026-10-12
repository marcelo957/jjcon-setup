import { PLAN_KINDS } from './meta';
import { chunkRows, fieldLists, fieldProgress, fieldTabs, packetPages, type PacketRow } from './packet';
import { opsStore } from './store';

const sector = (id: string) => structuredClone(opsStore().sector(id)!);

describe('Field content', () => {
  it('gives a sector one tab per kind of thing it has', () => {
    expect(fieldTabs(sector('customer')).map((t) => t.id)).toEqual(['floorplan', 'materials', 'steps']);
    const s = sector('customer');
    s.blocks.mainMat.on = false; s.blocks.netMat.on = false;
    s.blocks.info.on = true;
    expect(fieldTabs(s).map((t) => t.label)).toEqual(['Floorplan', 'Information', 'Instructions']);
  });

  it('keeps drafts off the floor', () => {
    const s = sector('customer');
    s.blocks.mainMat.status = 'draft';
    const [main, net] = fieldLists(s, 'Diego');
    expect(main.rows).toBeNull();
    expect(main.notice?.title).toBe('Material list in draft');
    expect(net.rows?.length).toBeGreaterThan(0);
    expect(fieldProgress(s, 'Diego')!.total).toBe(net.rows!.length);
  });
});

describe('Packet pages', () => {
  it('prints every plan page, the material list and the instructions', () => {
    const s = sector('customer');
    const pages = packetPages(s, "D'Andre");
    expect(pages.map((p) => p.kind)).toEqual(['plan', 'plan', 'plan', 'rows', 'steps']);
    const mat = pages[3];
    expect(mat.kind === 'rows' && mat.sign && !mat.notice).toBe(true);
  });

  it('prints a notice in place of anything not released', () => {
    const s = sector('customer');
    const key = PLAN_KINDS.find((k) => s.plans[k.key].required)!;
    s.plans[key.key].status = 'draft';
    s.blocks.instr.status = 'none';
    const pages = packetPages(s, 'Diego');
    const plan = pages.find((p) => p.kind === 'plan' && p.sheet === key.name);
    expect(plan?.kind === 'plan' && plan.notice?.title).toMatch(/^No released PDF/);
    const steps = pages.find((p) => p.kind === 'steps');
    expect(steps?.kind === 'steps' && steps.notice?.title).toBe('No instructions yet');
  });

  it('still gives an empty sector one page', () => {
    const s = sector('customer');
    (Object.keys(s.plans) as (keyof typeof s.plans)[]).forEach((k) => { s.plans[k].required = false; });
    Object.values(s.blocks).forEach((b) => { b.on = false; });
    s.custom = [];
    expect(packetPages(s, 'Diego')).toEqual([{ kind: 'empty', sheet: 'Packet' }]);
  });

  it('never leaves a group heading alone at the foot of a page', () => {
    const rows: PacketRow[] = [];
    for (let g = 0; g < 3; g++) {
      rows.push({ group: true, item: `Group ${g}` });
      for (let i = 0; i < 6; i++) rows.push({ group: false, item: `Item ${g}.${i}`, qty: '1' });
    }
    const pages = chunkRows(rows, 300);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p) => expect(p[p.length - 1].group).toBe(false));
    expect(pages.flat()).toHaveLength(rows.length);
  });
});
