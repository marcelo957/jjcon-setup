import type { CSSProperties, ReactNode } from 'react';
import { DS } from './bushido';
import { iconName } from './Icon';

/**
 * Bushido v2 Button with the design's vocabulary: `variant` primary | neutral | danger,
 * `outlined` and `ghost` modifiers, `size` small | default.
 */
export function Button({
  children, onClick, variant = 'primary', outlined, ghost, size, icon, disabled, busy, type = 'button', block, style, 'aria-label': label
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'neutral' | 'danger';
  outlined?: boolean;
  ghost?: boolean;
  size?: 'small' | 'large';
  icon?: string;
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
  block?: boolean;
  style?: CSSProperties;
  'aria-label'?: string;
}) {
  const v = ghost ? 'ghost' : outlined ? 'outline' : variant === 'danger' ? 'danger' : variant === 'neutral' ? 'secondary' : 'primary';
  return (
    <DS.Button
      variant={v}
      size={size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'md'}
      state={disabled ? 'disabled' : busy ? 'loading' : undefined}
      showLeadingIcon={!!icon}
      leadingIcon={icon ? iconName(icon) : undefined}
      block={!!block}
      type={type}
      onClick={onClick}
      style={style}
      aria-label={label}
    >
      {children}
    </DS.Button>
  );
}
