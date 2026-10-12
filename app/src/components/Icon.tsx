import type { CSSProperties } from 'react';
import { ICONS, type IconName } from './icons';

/** Bushido v2 filled icon, drawn in currentColor. Decorative unless given a label. */
export function Icon({ name, size = 16, label, className, style }: { name: IconName; size?: number; label?: string; className?: string; style?: CSSProperties }) {
  const d = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={d.viewBox}
      fill="none"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      dangerouslySetInnerHTML={{ __html: d.body }}
    />
  );
}
