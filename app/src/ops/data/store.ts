import { useSyncExternalStore } from 'react';
import { BLOCK_DEFS, PLAN_KEYS } from './meta';
import { seedData } from './seed';
import { addDays, splitKey } from './tasks';
import type { BlockKey, CustomBlock, FileRef, GroupId, OpsData, PlanKey, Sector, TaskState } from './types';

/**
 * The console's data, kept in the browser until there is a real API. Every screen reads it
 * through `useOps()` and changes it only through these methods, so swapping in a server means
 * replacing this class, not the screens.
 */

const KEY = 'jjcon.ops.v2';

/** Everything the create/edit sector form controls. */
export interface SectorStructure {
  name: string;
  group: GroupId;
  leadId: string;
  ownerId: string;
  location: string;
  day: string;
  from: string;
  to: string;
  plans: Record<PlanKey, boolean>;
  blocks: Record<BlockKey, boolean>;
  linkLabel: string;
  linkUrl: string;
  custom: CustomBlock[];
}

type Listener = () => void;

export class OpsStore {
  private data: OpsData;
  private listeners = new Set<Listener>();

  constructor(private storage: Storage = localStorage, private now: () => Date = () => new Date()) {
    this.data = this.load();
  }

  private load(): OpsData {
    try {
      const raw = this.storage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as OpsData;
        if (d.version === 1) return d;
      }
    } catch {
      /* fall back to seed */
    }
    const d = seedData(this.now());
    this.storage.setItem(KEY, JSON.stringify(d));
    return d;
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  get = () => this.data;

  private commit(next: OpsData) {
    this.data = next;
    this.storage.setItem(KEY, JSON.stringify(next));
    this.listeners.forEach((fn) => fn());
  }

  /** Copy, change, save. `content` marks the sector's printed packet as out of date. */
  private edit(id: string, fn: (s: Sector) => void, content = true) {
    const next = structuredClone(this.data);
    const s = next.sectors.find((x) => x.id === id);
    if (!s) return;
    fn(s);
    if (content) s.contentChangedAt = this.now().toISOString();
    this.commit(next);
  }

  reset() {
    this.commit(seedData(this.now()));
  }

  sector(id: string) {
    return this.data.sectors.find((s) => s.id === id);
  }

  /** Inline "Add person" from an assignment field: a name only, filled in later on the People page. */
  addPerson(name: string): string {
    const id = `p-${Math.random().toString(36).slice(2, 8)}`;
    const next = structuredClone(this.data);
    next.people.push({ id, name: name.trim(), role: '', email: '', active: true });
    this.commit(next);
    return id;
  }

  createSector(f: SectorStructure): string {
    const id = `sec-${Math.random().toString(36).slice(2, 8)}`;
    const blank: Sector = {
      id, name: '', group: f.group, leadId: '', ownerId: '', location: '', day: f.day, from: f.from, to: f.to, build: 'none',
      plans: Object.fromEntries(PLAN_KEYS.map((k) => [k, { required: false, status: 'none' }])) as Sector['plans'],
      blocks: {
        mainMat: { on: false, status: 'none', rows: [] }, netMat: { on: false, status: 'none', rows: [] },
        instr: { on: false, status: 'none', steps: [] }, install: { on: false, status: 'none', steps: [] },
        info: { on: false, status: 'none', rows: [] }, link: { on: false, status: 'none', label: '', url: '' }
      },
      custom: [],
      contentChangedAt: this.now().toISOString()
    };
    applyStructure(blank, f);
    const next = structuredClone(this.data);
    next.sectors.push(blank);
    this.commit(next);
    return id;
  }

  saveStructure(id: string, f: SectorStructure) {
    this.edit(id, (s) => applyStructure(s, f));
  }

  /** Changes made on the sector page in edit mode. */
  saveSector(id: string, fn: (s: Sector) => void) {
    this.edit(id, fn);
  }

  archive(id: string, by: string, reason = 'Not running this year') {
    this.edit(id, (s) => { s.archived = { at: this.now().toISOString(), by, reason }; }, false);
  }

  restore(id: string) {
    this.edit(id, (s) => { delete s.archived; }, false);
  }

  remove(id: string) {
    const next = structuredClone(this.data);
    next.sectors = next.sectors.filter((s) => s.id !== id);
    this.commit(next);
  }

  /** Confirming a material or checklist row on site. Shared by desktop and phone; not a content change. */
  toggleRow(id: string, block: 'mainMat' | 'netMat' | string, rowId: string) {
    this.edit(id, (s) => {
      const rows = block === 'mainMat' || block === 'netMat' ? s.blocks[block].rows : s.custom.find((c) => c.id === block)?.rows;
      const r = rows?.find((x) => x.id === rowId);
      if (r) r.checked = !r.checked;
    }, false);
  }

  toggleStep(id: string, block: 'instr' | 'install', stepId: string) {
    this.edit(id, (s) => {
      const st = s.blocks[block].steps.find((x) => x.id === stepId);
      if (st) st.done = !st.done;
    }, false);
  }

  /** Task decisions: not content, so they never mark a packet out of date. */
  private editTasks(keys: string[], by: string, fn: (t: TaskState, sectorId: string, slot: string) => void) {
    const next = structuredClone(this.data);
    keys.forEach((key) => {
      const [sid, slot] = splitKey(key);
      const s = next.sectors.find((x) => x.id === sid);
      if (!s) return;
      s.tasks = s.tasks ?? {};
      s.tasks[slot] = s.tasks[slot] ?? {};
      fn(s.tasks[slot], sid, slot);
    });
    next.tasksUpdated = { at: this.now().toISOString(), by };
    this.commit(next);
  }

  setTaskDone(keys: string[], done: boolean, by: string) {
    this.editTasks(keys, by, (t) => {
      t.done = done;
      if (done) { t.doneBy = by; t.doneAt = this.now().toISOString(); } else { delete t.doneBy; delete t.doneAt; }
    });
  }

  setTaskWho(keys: string[], who: string, by: string) {
    this.editTasks(keys, by, (t) => { t.who = who; });
  }

  setTaskDue(keys: string[], due: string, by: string) {
    this.editTasks(keys, by, (t) => { t.due = due; });
  }

  /** Move each task's current deadline by `days`. `current` gives the deadline shown now. */
  shiftTaskDue(keys: string[], days: number, by: string, current: (key: string) => string) {
    this.editTasks(keys, by, (t, sid, slot) => { t.due = addDays(current(`${sid}:${slot}`), days); });
  }

  setTaskNote(key: string, text: string, by: string) {
    this.editTasks([key], by, (t) => {
      if (text.trim()) t.note = { text: text.trim(), by, at: this.now().toISOString() };
      else delete t.note;
    });
  }

  /** Attach an uploaded PDF to a plan. A new file sets the plan back to draft unless it was approved. */
  setPlanFile(id: string, key: PlanKey, file: FileRef) {
    this.edit(id, (s) => {
      const slot = s.plans[key];
      slot.prevUploadedAt = slot.file?.uploadedAt;
      slot.file = file;
      if (slot.status !== 'approved') slot.status = 'draft';
    });
  }

  setCustomFile(id: string, blockId: string, file: FileRef) {
    this.edit(id, (s) => {
      const c = s.custom.find((x) => x.id === blockId);
      if (!c) return;
      c.file = file;
      if (c.status !== 'approved') c.status = 'draft';
    });
  }
}

/** The form's structure onto a sector. Content of blocks turned off is kept, never discarded. */
function applyStructure(s: Sector, f: SectorStructure) {
  Object.assign(s, {
    name: f.name.trim(), group: f.group, leadId: f.leadId, ownerId: f.ownerId,
    location: f.location.trim() || 'Location not set', day: f.day, from: f.from, to: f.to
  });
  PLAN_KEYS.forEach((k) => { s.plans[k].required = f.plans[k]; });
  if (PLAN_KEYS.some((k) => f.plans[k])) delete s.noFloorplans;
  BLOCK_DEFS.forEach(({ k }) => { s.blocks[k].on = f.blocks[k]; });
  if (f.blocks.link) {
    s.blocks.link.label = f.linkLabel.trim() || 'External document';
    s.blocks.link.url = f.linkUrl.trim();
  }
  s.custom = f.custom.map((c) => structuredClone(c));
}

/** Blank form for a new sector in `group`, with the group's default blocks switched on. */
export function newStructure(group: GroupId, defaults: Partial<Record<BlockKey, boolean>>): SectorStructure {
  return {
    name: '', group, leadId: '', ownerId: '', location: '', day: '2027-08-24', from: '08:00', to: '12:00',
    plans: Object.fromEntries(PLAN_KEYS.map((k) => [k, false])) as Record<PlanKey, boolean>,
    blocks: { ...Object.fromEntries(BLOCK_DEFS.map(({ k }) => [k, false])), ...defaults } as Record<BlockKey, boolean>,
    linkLabel: '', linkUrl: '', custom: []
  };
}

export function structureOf(s: Sector): SectorStructure {
  return {
    name: s.name, group: s.group, leadId: s.leadId, ownerId: s.ownerId, location: s.location, day: s.day, from: s.from, to: s.to,
    plans: Object.fromEntries(PLAN_KEYS.map((k) => [k, s.plans[k].required])) as Record<PlanKey, boolean>,
    blocks: Object.fromEntries(BLOCK_DEFS.map(({ k }) => [k, s.blocks[k].on])) as Record<BlockKey, boolean>,
    linkLabel: s.blocks.link.label, linkUrl: s.blocks.link.url,
    custom: structuredClone(s.custom)
  };
}

let defaultStore: OpsStore | null = null;
export function opsStore(): OpsStore {
  if (!defaultStore) defaultStore = new OpsStore();
  return defaultStore;
}
/** Tests swap in their own store. */
export function setOpsStore(s: OpsStore | null) {
  defaultStore = s;
}

export function useOps(): OpsData {
  const s = opsStore();
  return useSyncExternalStore(s.subscribe, s.get);
}
