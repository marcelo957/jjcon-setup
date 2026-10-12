/** Prep status: the office's preparation of one content block. */
export type PrepStatus = 'none' | 'draft' | 'ready' | 'approved';

/** Build status: the physical work on site. */
export type BuildStatus = 'none' | 'progress' | 'complete';

/** Organisational only: where a sector is listed. It never decides what blocks a sector has. */
export type GroupId = 'ibjjf' | 'third' | 'ops';

/** The five floorplans, in their standard order. */
export type PlanKey = 'G' | 'A' | 'B' | 'C' | 'D';

export type BlockKey = 'mainMat' | 'netMat' | 'instr' | 'info' | 'install' | 'link';

export type CustomKind = 'pdf' | 'checklist' | 'text' | 'link' | 'gallery';

export interface Person {
  id: string;
  name: string;
  /** Job title. */
  role: string;
  email: string;
  /** Inactive people are hidden from every assignment field; their record and history stay. */
  active: boolean;
  deactivatedAt?: string;
  deactivatedBy?: string;
  /** Set when added by name only from an assignment field. */
  addedInlineAt?: string;
}

/** An uploaded PDF. The bytes live in the file store under `id`. */
export interface FileRef {
  id: string;
  name: string;
  size: number;
  pages: number;
  uploadedAt: string;
  uploadedBy?: string | null;
}

export interface PlanSlot {
  required: boolean;
  status: PrepStatus;
  file?: FileRef;
  /** When the file this one replaced was uploaded. */
  prevUploadedAt?: string;
}

export interface MatRow { id: string; item: string; qty: number; note?: string; checked: boolean }
export interface Step { id: string; text: string; done: boolean }
export interface InfoRow { id: string; label: string; value: string }

interface BlockBase { on: boolean; status: PrepStatus }
export interface MatBlock extends BlockBase { rows: MatRow[] }
export interface StepBlock extends BlockBase { steps: Step[] }
export interface InfoBlock extends BlockBase { rows: InfoRow[] }
export interface LinkBlock extends BlockBase { label: string; url: string }

export interface Blocks {
  mainMat: MatBlock;
  netMat: MatBlock;
  instr: StepBlock;
  info: InfoBlock;
  install: StepBlock;
  link: LinkBlock;
}

export interface Shot { id: string; title: string; caption: string }

export interface CustomBlock {
  id: string;
  kind: CustomKind;
  name: string;
  status: PrepStatus;
  /** Off keeps the content but hides the block everywhere. */
  on: boolean;
  rows?: MatRow[];
  steps?: Step[];
  shots?: Shot[];
  label?: string;
  url?: string;
  file?: FileRef;
  foot?: string;
}

/** What has been decided about one task: each required plan and each enabled block is a task. */
export interface TaskState {
  /** ISO date. Unset: the build day minus the item's lead time. */
  due?: string;
  /** Person id, or '' for unassigned. Unset: the sector's owner (lead for instructions and installation). */
  who?: string;
  /** Unset: done once the item is ready or approved. */
  done?: boolean;
  doneBy?: string;
  doneAt?: string;
  note?: { text: string; by: string; at: string };
}

export interface Sector {
  id: string;
  name: string;
  group: GroupId;
  leadId: string;
  ownerId: string;
  location: string;
  /** Build day, ISO date. */
  day: string;
  from: string;
  to: string;
  build: BuildStatus;
  /** Staff-type sectors that genuinely need no floorplan: shown as "—" instead of "Not set". */
  noFloorplans?: boolean;
  plans: Record<PlanKey, PlanSlot>;
  blocks: Blocks;
  custom: CustomBlock[];
  archived?: { at: string; by: string; reason: string };
  /** A line linking to a related sector, e.g. the goodie bag booth and assembly line. */
  xref?: { sectorId: string; text: string; tail: string };
  packetPrintedAt?: string;
  contentChangedAt?: string;
  /** Keyed by plan key, block key or custom block id. */
  tasks?: Record<string, TaskState>;
}

export interface OpsData {
  version: 1;
  people: Person[];
  sectors: Sector[];
  /** When task assignments last changed, shown on the Team page so a meeting knows it is current. */
  tasksUpdated?: { at: string; by: string };
}
