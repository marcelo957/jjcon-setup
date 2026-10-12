import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../auth/format';
import { ROLE_LABEL } from '../auth/permissions';
import { AuthHeader, AuthNote, AuthPage, TextLink } from '../components/AuthCard';
import { EVENT_NAME } from '../config';

/**
 * Where sign-in lands until the JJCON SetUp console is built. It carries the same
 * "signed in as" block and Sign out the console sidebar will have, since venue laptops get shared.
 */
export function Home() {
  const { session, signOut } = useAuth();
  if (!session) return null;
  return (
    <AuthPage>
      <AuthHeader title="You’re signed in" sub={`${EVENT_NAME} set-up`} />
      <div className="signed-in" aria-label="Signed in as">
        <span className="signed-in__meta">Signed in as</span>
        <span className="signed-in__name">{session.name}</span>
        <span className="signed-in__meta">
          {ROLE_LABEL[session.role]} · {session.email}
          <br />
          {session.expiresAt ? `Session ends ${formatDate(session.expiresAt)}` : 'Session ends when you close the browser'}
        </span>
      </div>
      <button type="button" className="auth-btn auth-btn--secondary" onClick={signOut}>Sign out</button>
      <TextLink to="/access/roles">What each role can do</TextLink>
      <AuthNote>The set-up console isn’t part of this build yet. Signing in lands here for now.</AuthNote>
    </AuthPage>
  );
}
