import { useId, type ReactNode, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import type { IconName } from './icons';

/**
 * Sign-in, password reset and invitation screens share one card: app name, optional icon or
 * eyebrow, title and lead, then the screen's own content. Centred on a grey page on desktop;
 * full-bleed with 48px controls on a phone.
 */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">{children}</div>
    </main>
  );
}

export function AuthHeader({ icon, eyebrow, title, sub }: { icon?: IconName; eyebrow?: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <div className="auth-brand">
        <span className="auth-brand__org">IBJJF</span>
        <span className="auth-brand__app">JJCON SetUp</span>
      </div>
      {icon && (
        <span className="auth-icon">
          <Icon name={icon} size={24} />
        </span>
      )}
      <div className="auth-heading">
        {eyebrow && <span className="auth-heading__eyebrow">{eyebrow}</span>}
        <h1 className="auth-heading__title">{title}</h1>
        {sub && <p className="auth-heading__sub">{sub}</p>}
      </div>
    </>
  );
}

export function AuthAlert({ kind, icon, title, children }: { kind: 'danger' | 'neutral'; icon: IconName; title?: string; children: ReactNode }) {
  return (
    <div role="alert" className={`auth-alert auth-alert--${kind}`}>
      <Icon name={icon} size={16} className="auth-alert__icon" />
      <span className="auth-alert__text">
        {title && <strong className="auth-alert__title">{title}</strong>}
        {children}
      </span>
    </div>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="auth-fields">{children}</div>;
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  hint?: string;
  /** An error message, or `true` to mark the field without a message (the alert above explains it). */
  error?: string | boolean | null;
  locked?: boolean;
  onValueChange?: (value: string) => void;
};

export function TextField({ label, hint, error, locked, onValueChange, ...input }: FieldProps) {
  const id = useId();
  const message = typeof error === 'string' ? error : null;
  const describedBy = message ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-field__label">{label}</label>
      <input
        {...input}
        id={id}
        className={`auth-input${error ? ' auth-input--error' : ''}${locked ? ' auth-input--locked' : ''}`}
        readOnly={locked || input.readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
      {message ? (
        <span id={`${id}-error`} className="auth-field__error">{message}</span>
      ) : (
        hint && <span id={`${id}-hint`} className="auth-field__hint">{hint}</span>
      )}
    </div>
  );
}

export function KeepSignedIn({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="auth-keep">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Keep me signed in on this device
        <span className="auth-keep__sub">For 30 days. Untick on a shared laptop.</span>
      </span>
    </label>
  );
}

export function SubmitButton({ busy, busyLabel, children }: { busy?: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button type="submit" className="auth-btn auth-btn--primary" disabled={busy} aria-busy={busy || undefined}>
      {busy ? busyLabel : children}
    </button>
  );
}

export function ButtonLink({ to, state, href, secondary, children }: { to?: string; state?: unknown; href?: string; secondary?: boolean; children: ReactNode }) {
  const cls = `auth-btn auth-btn--${secondary ? 'secondary' : 'primary'}`;
  return href ? <a className={cls} href={href}>{children}</a> : <Link className={cls} to={to!} state={state}>{children}</Link>;
}

export function TextLink({ to, state, onClick, children }: { to?: string; state?: unknown; onClick?: () => void; children: ReactNode }) {
  return onClick ? (
    <button type="button" className="auth-link" onClick={onClick}>{children}</button>
  ) : (
    <Link className="auth-link" to={to!} state={state}>{children}</Link>
  );
}

export function AuthNote({ children }: { children: ReactNode }) {
  return <p className="auth-note">{children}</p>;
}

/** Shown while a token is checked, so the card doesn't flash the wrong state. */
export function AuthLoading() {
  return (
    <AuthPage>
      <AuthHeader title="One moment…" />
    </AuthPage>
  );
}
