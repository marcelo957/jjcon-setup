import type { CSSProperties } from 'react';
import { DS } from './bushido';

// Font Awesome 6 names used by the design → Bushido icon names (from project/bushido-v2-adapters.js).
// Unlisted names resolve by PascalCase.
const ALIAS: Record<string, string> = {
  'table-cells': 'th', 'list-check': 'tasks', 'mobile-screen-button': 'mobile-alt', 'circle-exclamation': 'exclamation-circle',
  xmark: 'times', 'circle-check': 'check-circle', 'filter-circle-xmark': 'filter', 'user-pen': 'user-edit', 'circle-info': 'info-circle',
  'ellipsis-vertical': 'ellipsis-v', 'box-archive': 'archive', 'cloud-arrow-up': 'cloud-upload-alt', 'table-list': 'th-list',
  'arrow-up-right-from-square': 'external-link-alt', 'file-circle-exclamation': 'file', 'magnifying-glass': 'search',
  'triangle-exclamation': 'exclamation-triangle', display: 'desktop', 'angles-left': 'angle-double-left',
  'angles-right': 'angle-double-right', 'floppy-disk': 'save', 'up-right-and-down-left-from-center': 'expand-alt', 'rotate-left': 'undo-alt',
  'circle-dot': 'dot-circle', 'person-digging': 'hard-hat', gears: 'cogs', 'boxes-stacked': 'boxes', 'screwdriver-wrench': 'tools',
  'file-pen': 'file-signature', 'circle-minus': 'minus-circle', 'up-right-from-square': 'external-link-alt'
};

const pascal = (k: string) => k.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join('');
const warned = new Set<string>();

export function iconName(fa: string, outline = false): string {
  if (/^Icon(Filled|Outline|Brand)/.test(fa)) return fa;
  const p = pascal(ALIAS[fa] ?? fa);
  const tries = outline ? [`IconOutline${p}`, `IconFilled${p}`] : [`IconFilled${p}`, `IconOutline${p}`];
  for (const t of tries) {
    const r = DS.ResolveIconName(t);
    if (r) return r;
  }
  if (!warned.has(fa)) {
    warned.add(fa);
    console.warn(`[bushido] no icon for "${fa}"`);
  }
  return 'IconFilledCircle';
}

/** A Bushido icon by its Font Awesome-style name, drawn in currentColor. Decorative unless labelled. */
export function Icon({ fa, size = 14, style, label, outline }: { fa: string; size?: number; style?: CSSProperties; label?: string; outline?: boolean }) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, lineHeight: 0, ...style }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <DS.Icon name={iconName(fa, outline)} size={size} />
    </span>
  );
}
