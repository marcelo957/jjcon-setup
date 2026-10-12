import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../ds/Icon';
import { initials, sortPeople } from '../data/selectors';
import type { Person } from '../data/types';

/**
 * Searchable person select from the design's PersonPicker: active people only, "Unassigned"
 * kept visible rather than blank, and an inline "Add person" that takes just a name.
 */
export function PersonPicker({
  people, value = '', onPick, onAdd, size = 'sm', action, actionLabel, disabled, allowUnassigned = true, unLabel = 'Unassigned', exclude, label
}: {
  people: Person[];
  value?: string;
  onPick: (id: string) => void;
  onAdd: (name: string) => void;
  size?: 'sm' | 'md';
  /** A button that picks someone for a bulk action rather than showing a current value. */
  action?: boolean;
  actionLabel?: string;
  disabled?: boolean;
  allowUnassigned?: boolean;
  unLabel?: string;
  exclude?: string;
  /** Accessible name of the field, e.g. "Assigned lead". */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, w: 280, up: false, bottom: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = () => { setOpen(false); setQ(''); setAdding(false); setNewName(''); };

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(); };
    const scroll = (e: Event) => { if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return; close(); };
    document.addEventListener('mousedown', down);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', scroll);
    return () => {
      document.removeEventListener('mousedown', down);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', scroll);
    };
  }, [open]);

  useLayoutEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useLayoutEffect(() => { if (adding) nameRef.current?.focus(); }, [adding]);

  const toggle = () => {
    if (disabled) return;
    if (open) { close(); return; }
    const r = btnRef.current!.getBoundingClientRect();
    const w = Math.max(r.width, 280);
    const up = r.bottom + 380 > window.innerHeight && r.top > 380;
    setPos({ top: r.bottom + 4, bottom: window.innerHeight - r.top + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), w, up });
    setOpen(true);
  };

  const pick = (id: string) => { onPick(id); close(); };
  const doAdd = () => { const n = newName.trim(); if (!n) return; onAdd(n); close(); };

  const active = sortPeople(people.filter((p) => p.active && p.id !== exclude));
  const needle = q.trim().toLowerCase();
  const opts = active.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.role.toLowerCase().includes(needle));
  const showUn = allowUnassigned && (!needle || 'unassigned'.includes(needle));
  const isUn = !action && !value;
  const cur = people.find((p) => p.id === value);
  const shown = action ? actionLabel ?? 'Reassign to…' : isUn ? unLabel : cur?.name ?? 'Unknown person';
  const dup = adding ? findDup(newName, people) : null;
  const typed = q.trim();
  const h = size === 'md' ? 40 : 34;

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', fontFamily: 'Inter, sans-serif' }}>
      <button ref={btnRef} type="button" onClick={toggle} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        aria-label={label ? `${label}: ${shown}` : shown} title={action ? shown : `Responsible: ${shown}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', minHeight: h, padding: '0 10px',
          border: open ? '1px solid var(--brand-primary)' : isUn ? '1px dashed var(--feedback-warning-accent)' : '1px solid var(--border-divider)',
          borderRadius: 8, background: disabled ? 'var(--border-subtle)' : isUn ? 'var(--feedback-warning-background)' : 'var(--color-neutral-white)',
          fontFamily: 'Inter, sans-serif', fontSize: size === 'md' ? 14 : 13, fontWeight: isUn ? 600 : 400,
          color: disabled ? 'var(--color-neutral-gray-300)' : 'var(--text-primary)', cursor: disabled ? 'default' : 'pointer'
        }}>
        {isUn && <Icon fa="user-slash" size={11} style={{ color: 'var(--feedback-warning-accent)' }} />}
        {action && <Icon fa="user-pen" size={11} style={{ color: 'var(--color-neutral-gray-300)' }} />}
        {!action && !isUn && <Avatar name={cur?.name ?? '?'} size={22} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{shown}</span>
        {cur && !cur.active && <span className="badge badge--kept">Inactive</span>}
        <Icon fa="chevron-down" size={10} style={{ color: 'var(--color-neutral-gray-300)' }} />
      </button>

      {open && (
        <div ref={popRef} role="dialog" aria-label="Choose a person" style={{
          position: 'fixed', ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }), left: pos.left, width: pos.w, zIndex: 1400,
          background: 'var(--color-neutral-white)', border: '1px solid var(--border-divider)', borderRadius: 8, boxShadow: 'var(--ib-elevation-3)', overflow: 'hidden', textAlign: 'left'
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 10px', border: '1px solid var(--border-divider)', borderRadius: 8 }}>
              <Icon fa="magnifying-glass" size={12} style={{ color: 'var(--icon-tertiary)' }} />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search active people" aria-label="Search people" aria-controls={listId}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close();
                  if (e.key === 'Enter') { e.preventDefault(); if (opts.length === 1) pick(opts[0].id); else if (!opts.length && typed) { setAdding(true); setNewName(typed); } }
                }}
                style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div id={listId} role="listbox" style={{ maxHeight: 236, overflowY: 'auto', padding: '4px 0' }}>
            {showUn && (
              <Opt selected={isUn} onClick={() => pick('')} first>
                <span style={{ flex: '0 0 28px', height: 28, borderRadius: '50%', border: '1px dashed var(--feedback-warning-accent)', color: 'var(--feedback-warning-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon fa="user-slash" size={11} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>Unassigned</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-gray-300)' }}>No owner. Listed on Team until someone takes it.</span>
                </span>
              </Opt>
            )}
            {opts.map((p) => (
              <Opt key={p.id} selected={!action && p.id === value} onClick={() => pick(p.id)}>
                <Avatar name={p.name} size={28} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-gray-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.role || 'Role not set'}</span>
                </span>
              </Opt>
            ))}
            {!opts.length && !showUn && (
              <div style={{ padding: '10px 12px', fontSize: 13, lineHeight: '19px', color: 'var(--color-neutral-gray-300)' }}>
                {typed ? `No active person matches “${typed}”. Add them below if they are new.` : 'Nobody else is active.'}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 6, background: 'var(--color-neutral-surface-50)' }}>
            {!adding ? (
              <button type="button" onClick={() => { setAdding(true); setNewName(typed); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 36, padding: '0 8px', border: 0, borderRadius: 4, background: 'none', color: 'var(--brand-primary)', fontFamily: 'Inter, sans-serif', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                <Icon fa="user-plus" size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typed && !opts.length ? `Add “${typed}” as a new person` : 'Add person'}</span>
              </button>
            ) : (
              <div style={{ padding: 4 }}>
                <label htmlFor={`${listId}-new`} style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>New person's name</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input id={`${listId}-new`} ref={nameRef} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name or nickname"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
                    style={{ flex: 1, minWidth: 0, minHeight: 34, padding: '0 10px', border: '1px solid var(--brand-primary)', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }} />
                  <button type="button" onClick={doAdd} disabled={!newName.trim()}
                    style={{ minHeight: 34, padding: '0 14px', border: 0, borderRadius: 8, background: newName.trim() ? 'var(--brand-primary)' : 'var(--border-divider)', color: 'var(--color-neutral-white)', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'default' }}>Add</button>
                </div>
                {dup && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--feedback-warning-background)', fontSize: 12, lineHeight: '17px', color: 'var(--text-primary)' }}>
                    <Icon fa="triangle-exclamation" size={11} style={{ color: 'var(--feedback-warning-accent)', marginTop: 3 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {dup.active
                        ? `${dup.name} is already on the list${dup.role ? ` (${dup.role})` : ''}. Adding again creates a second person.`
                        : `${dup.name} is already on the list but inactive. Reactivate them on the People page instead of adding a second record.`}
                      {dup.active && dup.id !== exclude && (
                        <button type="button" onClick={() => pick(dup.id)} style={{ display: 'block', marginTop: 4, border: 0, background: 'none', padding: 0, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Use {dup.name}</button>
                      )}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ flex: 1, fontSize: 12, lineHeight: '16px', color: 'var(--color-neutral-gray-300)' }}>Assigned straight away. Role and email can wait for the People page.</span>
                  <button type="button" onClick={() => { setAdding(false); setNewName(''); }} style={{ border: 0, background: 'none', padding: '0 2px', fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Opt({ selected, onClick, first, children }: { selected: boolean; onClick: () => void; first?: boolean; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" role="option" aria-selected={selected} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '4px 12px', border: 0,
        borderBottom: first ? '1px solid var(--border-subtle)' : 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        background: selected ? (first ? 'var(--feedback-warning-background)' : 'var(--feedback-info-background)') : hover ? 'var(--color-neutral-surface-100)' : 'var(--color-neutral-white)'
      }}>
      {children}
      {selected && <Icon fa="check" size={12} style={{ color: 'var(--brand-primary)' }} />}
    </button>
  );
}

export function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <span aria-hidden="true" style={{ flex: `0 0 ${size}px`, height: size, borderRadius: '50%', background: 'var(--color-neutral-surface-500)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto Condensed', sans-serif", fontSize: size > 24 ? 12 : 10 }}>
      {initials(name)}
    </span>
  );
}

/** Same name, same surname, or a single word matching part of an existing name: "Carlos" vs "Carlos S.". */
export function findDup(name: string, people: Person[]): Person | null {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-zÀ-ɏ\s]/g, ' ').split(/\s+/).filter(Boolean);
  const nn = norm(name);
  if (!nn.length) return null;
  const last = nn[nn.length - 1];
  return people.find((o) => {
    const on = norm(o.name);
    if (!on.length) return false;
    if (on.join(' ') === nn.join(' ')) return true;
    if (on[on.length - 1] === last && last.length > 2) return true;
    return nn.length === 1 && on.some((t) => t.length > 2 && t === nn[0]);
  }) ?? null;
}
