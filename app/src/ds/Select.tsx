import type { CSSProperties } from 'react';
import { DS } from './bushido';

export interface Option { value: string; label: string }

/**
 * Bushido FormsSelect. FormsSelect adds a blank "Select an option" row; these selects always
 * hold a real value, so picking the blank row falls back to the first option.
 */
export function Select({ label, showLabel, value, options, onChange, width = 200, size = 'small', style }: {
  label: string; showLabel?: boolean; value: string; options: Option[]; onChange: (v: string) => void;
  width?: number | string; size?: 'small' | 'md'; style?: CSSProperties;
}) {
  return (
    <DS.FormsSelect
      label={label}
      showLabel={!!showLabel}
      size={size === 'small' ? 'sm' : 'md'}
      options={options}
      value={value}
      onChange={(v: string) => onChange(v === '' && options.length ? options[0].value : v)}
      style={{ width, ...style }}
    />
  );
}

/** v2 has no search input: a label-less FormsTextField. */
export function SearchInput({ value, onChange, placeholder, width = 240 }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width }}>
      <DS.FormsTextField label={placeholder} showLabel={false} size="sm" placeholder={placeholder} value={value} onChange={(v: string) => onChange(v)} style={{ width }} />
    </span>
  );
}
