import type { BlockKey, BuildStatus, CustomKind, GroupId, PlanKey } from './types';

export const BUILD: Record<BuildStatus, { label: string; icon: string; accent: string; note: string }> = {
  none: { label: 'Not started', icon: 'circle-dot', accent: 'var(--border-divider)', note: 'crate unopened' },
  progress: { label: 'In progress', icon: 'person-digging', accent: 'var(--accent-gold)', note: 'crew on site' },
  complete: { label: 'Complete', icon: 'circle-check', accent: 'var(--feedback-success-text)', note: 'lead signed off' }
};
export const BUILD_ORDER: BuildStatus[] = ['none', 'progress', 'complete'];

export const GROUPS: { id: GroupId; name: string; icon: string }[] = [
  { id: 'ibjjf', name: 'IBJJF Sectors', icon: 'vector-square' },
  { id: 'third', name: 'Third Party Services', icon: 'layer-group' },
  { id: 'ops', name: 'Operations', icon: 'gears' }
];
export const groupName = (g: GroupId) => GROUPS.find((x) => x.id === g)?.name ?? g;

export const PLAN_KINDS: { key: PlanKey; name: string; short: string; icon: string }[] = [
  { key: 'G', name: 'General Layout', short: 'General', icon: 'vector-square' },
  { key: 'A', name: 'Tables, Chairs & Stanchions', short: 'Tables & chairs', icon: 'table' },
  { key: 'B', name: 'Computer Network', short: 'Network', icon: 'network-wired' },
  { key: 'C', name: 'Sign Banners', short: 'Banners', icon: 'flag' },
  { key: 'D', name: 'Power Drops & Extension Cords', short: 'Power', icon: 'bolt' }
];
export const PLAN_KEYS = PLAN_KINDS.map((k) => k.key);
export const planKind = (k: PlanKey) => PLAN_KINDS.find((p) => p.key === k)!;

export const BLOCK_DEFS: { k: BlockKey; label: string; icon: string; hint: string }[] = [
  { k: 'mainMat', label: 'Main Material List', icon: 'boxes-stacked', hint: 'Furniture, signage and everything the crew carries in.' },
  { k: 'netMat', label: 'Computers & Network Material List', icon: 'network-wired', hint: 'Laptops, tablets, switches, access points and cable runs.' },
  { k: 'instr', label: 'Instructions', icon: 'list-ol', hint: 'Numbered build steps the crew ticks off on the floor.' },
  { k: 'info', label: 'Information', icon: 'circle-info', hint: 'Supplier, specification and contact rows. Used by third party services.' },
  { k: 'install', label: 'Installation', icon: 'screwdriver-wrench', hint: 'Installation sequence carried out by the supplier.' },
  { k: 'link', label: 'External link', icon: 'arrow-up-right-from-square', hint: 'A spreadsheet or document held outside JJCON SetUp.' }
];

/** Short labels used on the dashboard and sector page. */
export const blockLabel = (k: BlockKey) => (k === 'netMat' ? 'Computers & Network' : BLOCK_DEFS.find((b) => b.k === k)!.label);

/** Selecting a group preselects these blocks. Every toggle stays editable. */
export const BLOCK_DEFAULTS: Record<GroupId, Partial<Record<BlockKey, boolean>>> = {
  ibjjf: { mainMat: true, netMat: true, instr: true },
  third: { info: true, install: true },
  ops: { instr: true }
};

export const CUSTOM_KINDS: { k: CustomKind; label: string; icon: string; hint: string }[] = [
  { k: 'pdf', label: 'PDF document', icon: 'file-pdf', hint: 'An uploaded drawing or sheet. Renders and prints like a floorplan.' },
  { k: 'checklist', label: 'Checklist', icon: 'list-check', hint: 'Rows with a quantity, a checkbox and a note. Like a material list.' },
  { k: 'text', label: 'Text section', icon: 'align-left', hint: 'Numbered steps or prose. Like instructions.' },
  { k: 'link', label: 'External link', icon: 'arrow-up-right-from-square', hint: 'A label and a URL pointing at a document held elsewhere.' },
  { k: 'gallery', label: 'Image gallery', icon: 'images', hint: 'Captioned photos, tappable to full screen on the phone.' }
];
export const customKind = (k: CustomKind) => CUSTOM_KINDS.find((c) => c.k === k)!;
