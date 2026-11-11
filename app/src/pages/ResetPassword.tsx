import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { ResetLookup } from '../auth/types';
import { MIN_PASSWORD_LENGTH, validateConfirm, validateNewPassword } from '../auth/validation';
import {
  AuthHeader, AuthLoading, AuthPage, ButtonLink, FieldGroup, KeepSignedIn, SubmitButton, TextField, TextLink
} from '../components/AuthCard';

const DEAD_LINK = {
  expired: { title: 'This reset link has expired', sub: 'Reset links work for 1 hour. Ask for a new one and use it straight away.' },
  used: { title: 'This reset link has already been used', sub: 'Each link sets a password once. Sign in with your new password, or ask for another link.' },
  'not-found': { title: 'This reset link isn’t valid', sub: 'Check that you opened the whole link from the email, or ask for a new one.' }
} as const;

export function ResetPassword() {
  const { token = '' } = useParams();
  const { service, startSession } = useAuth();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState<ResetLookup | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [keep, setKeep] = useState(true);
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    service.lookupReset(token).then((r) => live && setLookup(r));
    return () => { live = false; };
  }, [service, token]);

  if (!lookup) return <AuthLoading />;

  if (lookup.status === 'confirm') {
    // The emailed link is used only on this press, so a mail scanner opening it first can't use it up.
    const go = async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      await service.confirmLink?.('recovery');
      setLookup(await service.lookupReset(token));
      setBusy(false);
    };
    return (
      <AuthPage>
        <AuthHeader title="Reset your password" sub="Continue to choose a new password for JJCON SetUp." />
        <form className="auth-form" onSubmit={go} noValidate>
          <SubmitButton busy={busy} busyLabel="Opening…">Continue</SubmitButton>
        </form>
      </AuthPage>
    );
  }

  if (lookup.status !== 'valid') {
    const copy = DEAD_LINK[lookup.status];
    return (
      <AuthPage>
        <AuthHeader icon="clock" title={copy.title} sub={copy.sub} />
        <ButtonLink to="/forgot-password">Send a new reset link</ButtonLink>
        <TextLink to="/sign-in">Back to sign in</TextLink>
      </AuthPage>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = { password: validateNewPassword(password), confirm: validateConfirm(password, confirm) };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    const result = await service.resetPassword(token, password, keep);
    setBusy(false);
    if (result.ok) {
      startSession(result.session);
      navigate('/', { replace: true });
    } else if ('refused' in result) {
      setErrors({ password: result.refused });
    } else {
      setLookup({ status: result.status });
    }
  }

  return (
    <AuthPage>
      <AuthHeader title="Set a new password" sub={`For ${lookup.email}`} />
      <form className="auth-form" onSubmit={submit} noValidate>
        {/* Lets password managers file the new password under the right account. */}
        <input type="email" name="username" autoComplete="username" value={lookup.email} readOnly hidden />
        <FieldGroup>
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            value={password}
            onValueChange={setPassword}
            error={errors.password}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onValueChange={setConfirm}
            error={errors.confirm}
          />
        </FieldGroup>
        <KeepSignedIn checked={keep} onChange={setKeep} />
        <SubmitButton busy={busy} busyLabel="Saving…">Save and sign in</SubmitButton>
      </form>
    </AuthPage>
  );
}
