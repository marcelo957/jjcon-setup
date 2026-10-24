import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DEMO_PASSWORDS, DEMO_TOKENS } from '../auth/mockAuthService';
import { IS_MOCK_AUTH, mockAuth } from '../auth/service';
import type { ConnectionCheck } from '../lib/supabase';

type Row = { id: string; caption: string; to: string; how?: string };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: '1 · Sign in',
    rows: [
      { id: '1a', caption: 'Sign in', to: '/sign-in', how: `marcelo@ibjjf.com / ${DEMO_PASSWORDS.admin}` },
      { id: '1b', caption: 'Wrong password', to: '/sign-in', how: 'jackson@ibjjf.com with any other password' },
      { id: '1c', caption: 'Deactivated account', to: '/sign-in', how: `p.nakamura@ibjjf.com / ${DEMO_PASSWORDS.crew}` }
    ]
  },
  {
    title: '2 · Forgot password',
    rows: [
      { id: '2a', caption: 'Request a reset link', to: '/forgot-password' },
      { id: '2b', caption: 'Link sent', to: '/forgot-password', how: 'submit any email' },
      { id: '2c', caption: 'Set a new password', to: `/reset-password/${DEMO_TOKENS.reset}`, how: 'for diego@ibjjf.com' }
    ]
  },
  {
    title: '3 · Invitation link',
    rows: [
      { id: '3a', caption: 'Accept invitation', to: `/invite/${DEMO_TOKENS.invite}`, how: 'Gordo, invited as Editor' },
      { id: '3b', caption: 'Expired invitation', to: `/invite/${DEMO_TOKENS.inviteExpired}` },
      { id: '3c', caption: 'Invitation already used', to: `/invite/${DEMO_TOKENS.inviteUsed}` }
    ]
  },
  { title: '5 · Roles and permissions', rows: [{ id: '5a', caption: 'Roles reference', to: '/access/roles' }] }
];

/** Index of every designed state, like the JJCon Access canvas. Phone layouts are the same routes under 480px wide. */
/**
 * Whether this build is connected to the Supabase project. Loads the Supabase client only
 * here, so the rest of the app doesn't carry it until it's actually used.
 */
function BackendStatus() {
  const [check, setCheck] = useState<ConnectionCheck | null>(null);
  useEffect(() => {
    let live = true;
    import('../lib/supabase').then((m) => m.checkConnection()).then((c) => { if (live) setCheck(c); });
    return () => { live = false; };
  }, []);
  const text = !check ? 'Checking the connection to Supabase…'
    : check.state === 'not-configured' ? 'Supabase is not set up in this build: the project URL and anon key are missing. The app keeps using its built-in demo data.'
    : check.state === 'connected' ? `Connected to Supabase project ${check.host}. The URL and anon key work.`
    : check.state === 'bad-key' ? `Supabase project ${check.host} answered, but rejected the anon key. Copy the anon / public key again from Project Settings → API.`
    : `Can't reach Supabase project ${check.host}. ${check.reason}`;
  const tone = check?.state === 'connected' ? 'var(--feedback-success-text)' : check && check.state !== 'not-configured' ? 'var(--feedback-danger-text)' : 'var(--text-secondary)';
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Backend">
      <h2 className="ref-h2">Backend</h2>
      <p className="ref-text" role="status" style={{ color: tone }}>{text}</p>
    </section>
  );
}

export function AccessIndex() {
  const { signOut } = useAuth();
  const [resetDone, setResetDone] = useState(false);
  return (
    <main className="ref-page">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="ref-overline">JJCON SetUp · access</span>
        <h1 className="ref-h1">Sign in, password reset and invitations</h1>
        <p className="ref-lead">
          There is no public sign-up. An admin invites each person from the People page; the invitation email is the only
          way to create a login. <Link to="/">Open the app</Link>
        </p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="ref-h2">{s.title}</h2>
          <ul className="ref-links">
            {s.rows.map((r) => (
              <li key={r.id}>
                <span className="ref-tag">{r.id}</span>
                <Link to={r.to}>{r.caption}</Link>
                {r.how && <span className="ref-code">{r.how}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="ref-text">On a phone (under 480px wide) the same screens drop the card and use 48px fields and buttons.</p>
      <BackendStatus />
      {IS_MOCK_AUTH && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="auth-btn auth-btn--secondary"
            style={{ width: 'auto', padding: '0 16px', minHeight: 36 }}
            onClick={() => { mockAuth.reset(); signOut(); setResetDone(true); }}
          >
            Reset demo data
          </button>
          {resetDone && <span className="ref-text" role="status">Demo accounts, invitations and reset links are back to their starting state.</span>}
        </div>
      )}
    </main>
  );
}
