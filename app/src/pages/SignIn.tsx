import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formatDate, firstName } from '../auth/format';
import { validateEmail } from '../auth/validation';
import { AuthAlert, AuthHeader, AuthNote, AuthPage, FieldGroup, KeepSignedIn, SubmitButton, TextField, TextLink } from '../components/AuthCard';
import { EVENT_NAME } from '../config';

type Failure = { kind: 'invalid' } | { kind: 'deactivated'; deactivatedAt: string; contactName: string };

export function SignIn() {
  const { service, session, startSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; email?: string } | null;

  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={state?.from ?? '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = { email: validateEmail(email), password: password ? null : 'Enter your password.' };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    const result = await service.signIn(email, password, keep);
    setBusy(false);
    if (result.ok) {
      startSession(result.session);
      navigate(state?.from ?? '/', { replace: true });
    } else if (result.reason === 'deactivated') {
      setFailure({ kind: 'deactivated', deactivatedAt: result.deactivatedAt, contactName: result.contactName });
    } else {
      setFailure({ kind: 'invalid' });
    }
  }

  function switchAccount() {
    setEmail('');
    setPassword('');
    setErrors({});
    setFailure(null);
  }

  return (
    <AuthPage>
      <AuthHeader title="Sign in" sub={`${EVENT_NAME} set-up`} />
      {failure?.kind === 'invalid' && (
        <AuthAlert kind="danger" icon="circle-exclamation">
          That email and password don’t match. Check caps lock, or reset your password.
        </AuthAlert>
      )}
      {failure?.kind === 'deactivated' && (
        <AuthAlert kind="neutral" icon="user-slash" title="This account is deactivated">
          Your login was turned off on {formatDate(failure.deactivatedAt)}. Your past work is kept. If you’re working this
          event, ask {firstName(failure.contactName)} in the office to reactivate you.
        </AuthAlert>
      )}
      <form className="auth-form" onSubmit={submit} noValidate>
        <FieldGroup>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@ibjjf.com"
            value={email}
            onValueChange={setEmail}
            error={errors.email}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onValueChange={setPassword}
            error={errors.password ?? failure?.kind === 'invalid'}
          />
        </FieldGroup>
        <KeepSignedIn checked={keep} onChange={setKeep} />
        <SubmitButton busy={busy} busyLabel="Signing in…">Sign in</SubmitButton>
      </form>
      {failure?.kind === 'deactivated' ? (
        <TextLink onClick={switchAccount}>Use a different account</TextLink>
      ) : (
        <TextLink to="/forgot-password" state={{ email }}>Forgot password?</TextLink>
      )}
      {!failure && <AuthNote>No account? Ask the office to invite you. Logins are created by invitation only.</AuthNote>}
    </AuthPage>
  );
}
