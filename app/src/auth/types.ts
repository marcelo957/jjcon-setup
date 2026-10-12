export type Role = 'admin' | 'editor' | 'crew';

/** Login state shown on the People page. Being assignable and being able to sign in are separate. */
export type LoginState = 'active' | 'invited' | 'none' | 'deactivated';

export interface Person {
  id: string;
  name: string;
  /** A person added as a name only has no email and no login. */
  email?: string;
  role: Role;
  login: LoginState;
  deactivatedAt?: string;
  deactivatedBy?: string;
}

export interface Session {
  personId: string;
  name: string;
  email: string;
  role: Role;
  /** "Keep me signed in": 30 days on this device. Otherwise the session ends when the browser closes. */
  keep: boolean;
  /** ISO time the session ends, or null when it ends with the browser. */
  expiresAt: string | null;
}

export interface Invitation {
  token: string;
  personId: string;
  name: string;
  email: string;
  role: Role;
  invitedBy: string;
  invitedByEmail: string;
  sentAt: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'deactivated'; deactivatedAt: string; contactName: string };

export type InvitationLookup =
  | { status: 'valid'; invitation: Invitation }
  | { status: 'expired'; invitation: Invitation }
  | { status: 'used'; invitation: Invitation }
  | { status: 'revoked'; invitation: Invitation }
  | { status: 'not-found' };

export type ResetLookup =
  | { status: 'valid'; email: string }
  | { status: 'expired' | 'used' | 'not-found' };

export interface AuthService {
  signIn(email: string, password: string, keep: boolean): Promise<SignInResult>;
  /** Always resolves the same way whether or not the email has a login, so it can't be used to probe accounts. */
  requestPasswordReset(email: string): Promise<{ devLink?: string }>;
  lookupReset(token: string): Promise<ResetLookup>;
  resetPassword(token: string, password: string, keep: boolean): Promise<{ ok: true; session: Session } | { ok: false; status: Exclude<ResetLookup['status'], 'valid'> }>;
  lookupInvitation(token: string): Promise<InvitationLookup>;
  acceptInvitation(
    token: string,
    input: { name: string; password: string; keep: boolean }
  ): Promise<{ ok: true; session: Session } | { ok: false; status: Exclude<InvitationLookup['status'], 'valid'> }>;
}
