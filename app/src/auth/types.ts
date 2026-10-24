export type Role = 'admin' | 'editor' | 'crew';

/** Login state shown on the People page. Being assignable and being able to sign in are separate. */
export type LoginState = 'active' | 'invited' | 'none' | 'deactivated';

export interface Session {
  personId: string;
  name: string;
  email: string;
  role: Role;
  /** "Keep me signed in": 30 days on this device. Otherwise the session ends when the browser closes. */
  keep: boolean;
  /** ISO time the session ends, or null when it ends with the browser. */
  expiresAt: string | null;
  /** When the session started. "Sign out of all devices" ends sessions issued before it. */
  issuedAt?: string;
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
  /** The sign-in service couldn't be reached (offline, or the backend is down). */
  | { ok: false; reason: 'unavailable' }
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

/** What the People page shows about someone's login. */
export interface AccessInfo {
  personId: string;
  role: Role;
  login: 'active' | 'invited' | 'none';
  lastSignInAt?: string;
  invitation?: { sentAt: string; sentBy: string; expiresAt: string; expired: boolean };
}

/** Admin actions on logins. A real backend checks the caller is an admin; the mock trusts the UI. */
export interface AccessAdmin {
  listAccess(): Promise<AccessInfo[]>;
  /** Sends (or re-sends) an invitation. The person must already be on the People list with an email. */
  invite(personId: string, role: Role, invitedBy: string): Promise<{ devLink?: string }>;
  revokeInvite(personId: string): Promise<void>;
  setRole(personId: string, role: Role): Promise<void>;
  signOutEverywhere(personId: string): Promise<void>;
}

export interface AuthService {
  /** End the session with the backend too (the demo has nothing to end). */
  signOut?(): Promise<void>;
  /** The session as it stands now: role and name refreshed, or null once it was signed out, deactivated or removed. */
  checkSession(session: Session): Promise<Session | null>;
  access: AccessAdmin;
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
