import { createSession } from './session';
import type { AuthService, Invitation, InvitationLookup, Person, ResetLookup } from './types';

/**
 * In-browser stand-in for the real auth API. It keeps a small people/invitation/reset-token
 * store in localStorage so flows survive a reload (reset a password, then sign in with it).
 * Passwords are stored in plain text: this is demo data only, never a pattern for the server.
 */

const DB_KEY = 'jjcon.mockdb.v1';
const DAY = 86_400_000;
const INVITE_DAYS = 7;
const RESET_MINUTES = 60;

interface Account extends Person {
  password?: string;
}

interface ResetToken {
  token: string;
  personId: string;
  expiresAt: string;
  usedAt?: string;
}

interface Db {
  people: Account[];
  invitations: Invitation[];
  resets: ResetToken[];
}

/** Demo passwords, printed on the /access index so every state can be reached. */
export const DEMO_PASSWORDS = {
  admin: 'jjcon-admin-2027',
  editor: 'jjcon-editor-2027',
  crew: 'jjcon-crew-2027'
} as const;

/** Tokens seeded into the mock store, one per designed state. */
export const DEMO_TOKENS = {
  invite: 'demo-invite',
  inviteExpired: 'demo-invite-expired',
  inviteUsed: 'demo-invite-used',
  reset: 'demo-reset'
} as const;

export function seedDb(now: Date): Db {
  const t = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
  const marcelo = { name: 'Marcelo', email: 'marcelo@ibjjf.com' };
  const invite = (token: string, p: Account, sentAt: string, extra: Partial<Invitation> = {}): Invitation => ({
    token,
    personId: p.id,
    name: p.name,
    email: p.email!,
    role: p.role,
    invitedBy: marcelo.name,
    invitedByEmail: marcelo.email,
    sentAt,
    expiresAt: new Date(new Date(sentAt).getTime() + INVITE_DAYS * DAY).toISOString(),
    ...extra
  });

  const people: Account[] = [
    { id: 'p-marcelo', name: 'Marcelo', email: marcelo.email, role: 'admin', login: 'active', password: DEMO_PASSWORDS.admin },
    { id: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com', role: 'editor', login: 'active', password: DEMO_PASSWORDS.editor },
    { id: 'p-dandre', name: "D'Andre", email: 'jackson@ibjjf.com', role: 'crew', login: 'active', password: DEMO_PASSWORDS.crew },
    { id: 'p-cardoso', name: 'Cardoso', email: 'cardoso@ibjjf.com', role: 'editor', login: 'active', password: DEMO_PASSWORDS.editor },
    { id: 'p-gordo', name: 'Gordo', email: 'aleal@ibjjf.com', role: 'editor', login: 'invited' },
    { id: 'p-rafa', name: 'Rafa', email: 'rafa@ibjjf.com', role: 'crew', login: 'invited' },
    { id: 'p-daniela', name: 'Daniela', role: 'crew', login: 'none' },
    {
      id: 'p-nakamura', name: 'P. Nakamura', email: 'p.nakamura@ibjjf.com', role: 'crew', login: 'deactivated',
      password: DEMO_PASSWORDS.crew, deactivatedAt: t(-10 * DAY), deactivatedBy: marcelo.name
    }
  ];
  const by = (id: string) => people.find((p) => p.id === id)!;

  return {
    people,
    invitations: [
      invite(DEMO_TOKENS.invite, by('p-gordo'), t(-1 * DAY)),
      invite(DEMO_TOKENS.inviteExpired, by('p-rafa'), t(-9 * DAY)),
      invite(DEMO_TOKENS.inviteUsed, by('p-cardoso'), t(-20 * DAY), { usedAt: t(-19 * DAY) })
    ],
    resets: [{ token: DEMO_TOKENS.reset, personId: 'p-cardoso', expiresAt: t(RESET_MINUTES * 60_000) }]
  };
}

export interface MockOptions {
  /** Simulated network latency, so loading states are visible. 0 in tests. */
  latencyMs?: number;
  now?: () => Date;
  storage?: Storage;
}

export class MockAuthService implements AuthService {
  private latencyMs: number;
  private now: () => Date;
  private storage: Storage;

  constructor(opts: MockOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 400;
    this.now = opts.now ?? (() => new Date());
    this.storage = opts.storage ?? localStorage;
  }

  /** Restore the seeded demo data. */
  reset() {
    this.write(seedDb(this.now()));
  }

  private read(): Db {
    try {
      const raw = this.storage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch {
      /* fall through to a fresh seed */
    }
    const db = seedDb(this.now());
    this.write(db);
    return db;
  }

  private write(db: Db) {
    this.storage.setItem(DB_KEY, JSON.stringify(db));
  }

  private wait() {
    return this.latencyMs ? new Promise((r) => setTimeout(r, this.latencyMs)) : Promise.resolve();
  }

  private findByEmail(db: Db, email: string) {
    const e = email.trim().toLowerCase();
    return db.people.find((p) => p.email?.toLowerCase() === e);
  }

  async signIn(email: string, password: string, keep: boolean) {
    await this.wait();
    const db = this.read();
    const p = this.findByEmail(db, email);
    // Only a correct password reveals that an account is deactivated.
    if (!p || !p.password || p.password !== password) return { ok: false as const, reason: 'invalid' as const };
    if (p.login === 'deactivated') {
      return { ok: false as const, reason: 'deactivated' as const, deactivatedAt: p.deactivatedAt!, contactName: p.deactivatedBy ?? 'the office' };
    }
    if (p.login !== 'active') return { ok: false as const, reason: 'invalid' as const };
    return { ok: true as const, session: createSession({ ...p, email: p.email! }, keep, this.now()) };
  }

  async requestPasswordReset(email: string) {
    await this.wait();
    const db = this.read();
    const p = this.findByEmail(db, email);
    if (!p || p.login !== 'active') return {};
    const token = `reset-${crypto.randomUUID()}`;
    db.resets.push({ token, personId: p.id, expiresAt: new Date(this.now().getTime() + RESET_MINUTES * 60_000).toISOString() });
    this.write(db);
    // A real backend emails this link; the mock hands it back so the demo can follow it.
    return { devLink: `/reset-password/${token}` };
  }

  private resetStatus(db: Db, token: string): { status: ResetLookup['status']; reset?: ResetToken; person?: Account } {
    const reset = db.resets.find((r) => r.token === token);
    if (!reset) return { status: 'not-found' };
    if (reset.usedAt) return { status: 'used' };
    if (new Date(reset.expiresAt) <= this.now()) return { status: 'expired' };
    const person = db.people.find((p) => p.id === reset.personId);
    if (!person?.email || person.login !== 'active') return { status: 'not-found' };
    return { status: 'valid', reset, person };
  }

  async lookupReset(token: string): Promise<ResetLookup> {
    await this.wait();
    const r = this.resetStatus(this.read(), token);
    return r.status === 'valid' ? { status: 'valid', email: r.person!.email! } : { status: r.status };
  }

  async resetPassword(token: string, password: string, keep: boolean) {
    await this.wait();
    const db = this.read();
    const r = this.resetStatus(db, token);
    if (r.status !== 'valid') return { ok: false as const, status: r.status };
    r.person!.password = password;
    r.reset!.usedAt = this.now().toISOString();
    this.write(db);
    return { ok: true as const, session: createSession({ ...r.person!, email: r.person!.email! }, keep, this.now()) };
  }

  private invitationStatus(db: Db, token: string): InvitationLookup {
    const invitation = db.invitations.find((i) => i.token === token);
    if (!invitation) return { status: 'not-found' };
    if (invitation.usedAt) return { status: 'used', invitation };
    if (invitation.revokedAt) return { status: 'revoked', invitation };
    if (new Date(invitation.expiresAt) <= this.now()) return { status: 'expired', invitation };
    return { status: 'valid', invitation };
  }

  async lookupInvitation(token: string) {
    await this.wait();
    return this.invitationStatus(this.read(), token);
  }

  async acceptInvitation(token: string, input: { name: string; password: string; keep: boolean }) {
    await this.wait();
    const db = this.read();
    const lookup = this.invitationStatus(db, token);
    if (lookup.status !== 'valid') return { ok: false as const, status: lookup.status };
    const inv = db.invitations.find((i) => i.token === token)!;
    const person = db.people.find((p) => p.id === inv.personId)!;
    // Accepting keeps the existing person record, so everything already assigned stays with them.
    person.name = input.name.trim();
    person.password = input.password;
    person.login = 'active';
    person.role = inv.role;
    inv.usedAt = this.now().toISOString();
    this.write(db);
    return { ok: true as const, session: createSession({ ...person, email: person.email! }, input.keep, this.now()) };
  }
}
