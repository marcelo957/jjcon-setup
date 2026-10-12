import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { firstName, formatDate } from '../auth/format';
import { ROLE_LABEL } from '../auth/permissions';
import type { InvitationLookup } from '../auth/types';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../auth/validation';
import {
  AuthHeader, AuthLoading, AuthNote, AuthPage, ButtonLink, FieldGroup, KeepSignedIn, SubmitButton, TextField, TextLink
} from '../components/AuthCard';
import { EVENT_NAME } from '../config';

export function AcceptInvitation() {
  const { token = '' } = useParams();
  const { service, startSession } = useAuth();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState<InvitationLookup | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [errors, setErrors] = useState<{ name?: string | null; password?: string | null }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    service.lookupInvitation(token).then((r) => {
      if (!live) return;
      setLookup(r);
      if (r.status === 'valid') setName(r.invitation.name);
    });
    return () => { live = false; };
  }, [service, token]);

  if (!lookup) return <AuthLoading />;

  if (lookup.status === 'not-found') {
    return (
      <AuthPage>
        <AuthHeader
          icon="circle-exclamation"
          title="This invitation link isn’t valid"
          sub="Check that you opened the whole link from the email, or ask the office to send a new invitation."
        />
        <ButtonLink to="/sign-in">Go to sign in</ButtonLink>
      </AuthPage>
    );
  }

  const inv = lookup.invitation;
  const inviter = firstName(inv.invitedBy);
  const askAgain = `mailto:${inv.invitedByEmail}?subject=${encodeURIComponent('JJCON SetUp invitation')}`;

  if (lookup.status === 'expired' || lookup.status === 'revoked') {
    const expired = lookup.status === 'expired';
    return (
      <AuthPage>
        <AuthHeader
          icon="clock"
          title={expired ? 'This invitation has expired' : 'This invitation was withdrawn'}
          sub={
            expired
              ? `Invitations work for 7 days. This one was sent by ${inviter} on ${formatDate(inv.sentAt)}.`
              : `${inviter} cancelled this invitation. If you’re working this event, ask for a new one.`
          }
        />
        <ButtonLink href={askAgain} secondary>Email {inviter} for a new link</ButtonLink>
        <AuthNote>A new invitation keeps everything already assigned to you.</AuthNote>
      </AuthPage>
    );
  }

  if (lookup.status === 'used') {
    return (
      <AuthPage>
        <AuthHeader
          icon="circle-check"
          title="This invitation has already been used"
          sub={`The account for ${inv.email} is already set up. Sign in with the password you chose.`}
        />
        <ButtonLink to="/sign-in" state={{ email: inv.email }}>Go to sign in</ButtonLink>
        <TextLink to="/forgot-password" state={{ email: inv.email }}>Forgot password?</TextLink>
      </AuthPage>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = { name: name.trim() ? null : 'Enter your name.', password: validateNewPassword(password) };
    setErrors(next);
    if (next.name || next.password) return;
    setBusy(true);
    const result = await service.acceptInvitation(token, { name, password, keep });
    setBusy(false);
    if (result.ok) {
      startSession(result.session);
      navigate('/', { replace: true });
    } else {
      setLookup(await service.lookupInvitation(token));
    }
  }

  return (
    <AuthPage>
      <AuthHeader
        eyebrow="Invitation"
        title={<>{inviter} invited you<span className="desktop-only"> to JJCON SetUp</span></>}
        sub={
          <>
            You’ll join as {ROLE_LABEL[inv.role]} for the {EVENT_NAME} set-up.
            <span className="desktop-only"> The sectors and tasks already assigned to you will be waiting.</span>
          </>
        }
      />
      <form className="auth-form" onSubmit={submit} noValidate>
        <FieldGroup>
          <TextField
            label="Name"
            type="text"
            autoComplete="name"
            hint="This is how your name appears on sectors, tasks and print packets."
            value={name}
            onValueChange={setName}
            error={errors.name}
          />
          <TextField label="Email" type="email" autoComplete="username" value={inv.email} locked />
          <TextField
            label="Choose a password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            value={password}
            onValueChange={setPassword}
            error={errors.password}
          />
        </FieldGroup>
        <KeepSignedIn checked={keep} onChange={setKeep} />
        <SubmitButton busy={busy} busyLabel="Creating account…">Create account and sign in</SubmitButton>
      </form>
    </AuthPage>
  );
}
