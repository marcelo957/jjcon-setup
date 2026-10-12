import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../ds/Icon';
import { BUILD, PREP } from '../data/meta';
import type { BuildStatus, PrepStatus } from '../data/types';

export function PrepChip({ status, size, onClick, title }: { status: PrepStatus; size?: 'lg'; onClick?: () => void; title?: string }) {
  const p = PREP[status];
  const cls = `chip chip--${status}${size === 'lg' ? ' chip--lg' : ''}`;
  const body = (<><Icon fa={p.icon} size={10} /><span>{p.label}</span></>);
  return onClick
    ? <button type="button" className={cls} onClick={onClick} title={title}>{body}</button>
    : <span className={cls} title={title}>{body}</span>;
}

export function BuildTag({ status, style }: { status: BuildStatus; style?: React.CSSProperties }) {
  const b = BUILD[status];
  return <span className={`build build--${status}`} style={style}><Icon fa={b.icon} size={9} />{b.label}</span>;
}

export function Segments({ items }: { items: { status: PrepStatus; name: string }[] }) {
  return (
    <span className="segs">
      {items.map((i, n) => <span key={n} className={`seg seg--${i.status}`} title={`${i.name} · ${PREP[i.status].label}`} />)}
    </span>
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
