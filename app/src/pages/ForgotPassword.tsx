import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IS_MOCK_AUTH } from '../auth/service';
import { validateEmail } from '../auth/validation';
import { AuthHeader, AuthNote, AuthPage, FieldGroup, SubmitButton, TextField, TextLink } from '../components/AuthCard';

export function ForgotPassword() {
  const { service } = useAuth();
  const initial = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; devLink?: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setBusy(true);
    const { devLink } = await service.requestPasswordReset(email);
    setBusy(false);
    setSent({ email: email.trim(), devLink });
  }

  if (sent) {
    return (
      <AuthPage>
        <AuthHeader
          icon="envelope"
          title="Check your email"
          sub={`If ${sent.email} has a login, a reset link is on its way. The link works for 1 hour.`}
        />
        {IS_MOCK_AUTH && (
          <p className="dev-hint">
            Demo mode, no email is sent.{' '}
            {sent.devLink ? <Link to={sent.devLink}>Open the reset link</Link> : 'This email has no active login, so no link was made.'}
          </p>
        )}
        <TextLink to="/sign-in" state={{ email: sent.email }}>Back to sign in</TextLink>
        <AuthNote>Nothing after 5 minutes? Check your spam folder, or ask the office to resend your invitation.</AuthNote>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeader
        title="Reset your password"
        sub="Enter the email your invitation was sent to. We’ll email you a link to set a new password."
      />
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
            error={error}
          />
        </FieldGroup>
        <SubmitButton busy={busy} busyLabel="Sending…">Send reset link</SubmitButton>
      </form>
      <TextLink to="/sign-in" state={{ email }}>Back to sign in</TextLink>
    </AuthPage>
  );
}
