import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../ds/Icon';
import { BUILD } from '../data/meta';
import type { BuildStatus } from '../data/types';

/**
 * What a written block holds, never a typed status. Something written is quiet ("12 items");
 * empty is outlined; empty past its deadline is red. A lock marks a block frozen as final.
 */
export function ContentChip({ summary, late, final, size, onClick, title }: {
  summary: string; late?: boolean; final?: boolean; size?: 'lg'; onClick?: () => void; title?: string;
}) {
  const state = summary ? 'has' : late ? 'late' : 'empty';
  const cls = `chip chip--${state}${size === 'lg' ? ' chip--lg' : ''}`;
  const body = (
    <>
      <Icon fa={summary ? (final ? 'lock' : 'circle-check') : late ? 'triangle-exclamation' : 'circle'} outline={!summary && !late} size={10} label={final ? 'Final' : undefined} />
      <span>{summary || (late ? 'Empty · late' : 'Empty')}</span>
    </>
  );
  return onClick
    ? <button type="button" className={cls} onClick={onClick} title={title}>{body}</button>
    : <span className={cls} title={title}>{body}</span>;
}

export function BuildTag({ status, style }: { status: BuildStatus; style?: React.CSSProperties }) {
  const b = BUILD[status];
  return <span className={`build build--${status}`} style={style}><Icon fa={b.icon} size={9} />{b.label}</span>;
}

/**
 * One segment per item: filled when the work exists (file uploaded, content written), dashed when
 * it doesn't, red when it doesn't and its deadline has passed.
 */
export function Segments({ items }: { items: { name: string; done: boolean; late?: boolean; kind?: 'upload' | 'content'; summary?: string }[] }) {
  const what = (i: (typeof items)[number]) => (i.done ? (i.summary || 'Uploaded') : `${i.kind === 'content' ? 'Empty' : 'No PDF'}${i.late ? ' · late' : ''}`);
  return (
    <span className="segs">
      {items.map((i, n) => <span key={n} className={`seg seg--${i.done ? 'in' : i.late ? 'late' : 'out'}`} title={`${i.name} · ${what(i)}`} />)}
    </span>
  );
}

/** An upload's only states: the file is there, or it isn't (red once its deadline has passed). */
export function UploadChip({ done, late, size, onClick, title }: { done: boolean; late?: boolean; size?: 'lg'; onClick?: () => void; title?: string }) {
  const cls = `chip chip--${done ? 'has' : late ? 'late' : 'empty'}${size === 'lg' ? ' chip--lg' : ''}`;
  const body = (<><Icon fa={done ? 'circle-check' : late ? 'triangle-exclamation' : 'file-circle-exclamation'} size={10} /><span>{done ? 'Uploaded' : late ? 'No PDF · late' : 'No PDF'}</span></>);
  return onClick
    ? <button type="button" className={cls} onClick={onClick} title={title}>{body}</button>
    : <span className={cls} title={title}>{body}</span>;
}

/**
 * The first thing on every deadline screen: how much is late, and how much is due in the next
 * 7 days, each a button to that list. Nothing late shows green.
 */
export function AttentionBar({ late, week, done, total, onLate, onWeek, lateOn, weekOn, scope = '' }: {
  late: number; week: number; done?: number; total?: number;
  onLate?: () => void; onWeek?: () => void; lateOn?: boolean; weekOn?: boolean; scope?: string;
}) {
  const block = (on: boolean | undefined, tone: 'late' | 'week' | 'clear', n: number, label: string, sub: string, onClick?: () => void) => {
    const body = (
      <>
        <span className="attn__n">{n}</span>
        <span className="attn__text"><span className="attn__label">{label}</span><span className="attn__sub">{sub}</span></span>
      </>
    );
    return onClick
      ? <button type="button" className={`attn__block attn__block--${tone}`} aria-pressed={!!on} aria-label={`${n} ${label}, ${sub}`} onClick={onClick}>{body}</button>
      : <div className={`attn__block attn__block--${tone}`} role="group" aria-label={`${n} ${label}, ${sub}`}>{body}</div>;
  };
  return (
    <section className="attn" aria-label="Deadlines">
      {late > 0
        ? block(lateOn, 'late', late, `late${scope}`, 'past the deadline, nothing in place', onLate)
        : block(false, 'clear', 0, `late${scope}`, 'nothing is past its deadline')}
      {block(weekOn, 'week', week, 'due in the next 7 days', 'still missing', onWeek)}
      {total !== undefined && done !== undefined && (
        <div className="attn__done"><span className="mono">{done} of {total}</span> in place</div>
      )}
    </section>
  );
}

export function Overline({ children, secondary, style }: { children: ReactNode; secondary?: boolean; style?: React.CSSProperties }) {
  return <span className={`overline${secondary ? ' overline--secondary' : ''}`} style={style}>{children}</span>;
}

export function PageHead({ overline, crumbs, title, lead, actions }: { overline?: string; crumbs?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div style={{ flex: '1 1 440px', minWidth: 0 }}>
        {overline && <div className="overline" style={{ marginBottom: 4 }}>{overline}</div>}
        {crumbs && <div className="crumbs">{crumbs}</div>}
        {typeof title === 'string' ? <h1 className="page-head__title">{title}</h1> : title}
        {lead && <div className="page-head__lead">{lead}</div>}
      </div>
      {actions && <div className="page-head__actions" style={{ marginLeft: 'auto' }}>{actions}</div>}
    </header>
  );
}

export function IconBtn({ fa, label, onClick, danger, disabled, size }: { fa: string; label: string; onClick?: () => void; danger?: boolean; disabled?: boolean; size?: 30 }) {
  return (
    <button type="button" className={`icon-btn${danger ? ' icon-btn--danger' : ''}${size === 30 ? ' icon-btn--30' : ''}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon fa={fa} size={14} />
    </button>
  );
}

/** Centred dialog on a dimmed backdrop. Escape and the backdrop close it; focus moves inside. */
export function Modal({ title, icon, iconColor, onClose, children, footer, width = 560 }: {
  title: string; icon: string; iconColor: string; onClose: () => void; children: ReactNode; footer: ReactNode; width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, button:not([disabled]), select, textarea');
    first?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ width: `min(${width}px, 100%)` }}>
        <div className="modal__head">
          <Icon fa={icon} size={14} style={{ color: iconColor }} />
          <h2 id="modal-title" className="modal__title">{title}</h2>
        </div>
        {children}
        <div className="modal__foot">{footer}</div>
      </div>
    </div>
  );
}

export function KeptCallout({ children }: { children: ReactNode }) {
  return (
    <div className="callout">
      <Icon fa="circle-check" size={14} style={{ color: 'var(--feedback-success-text)', marginTop: 3 }} />
      <span>{children}</span>
    </div>
  );
}
