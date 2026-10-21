import { DEMO_PASSWORDS, DEMO_TOKENS, MockAuthService } from './mockAuthService';
import { can } from './permissions';
import { loadSession, saveSession } from './session';

const now = new Date('2027-08-12T10:00:00Z');
const svc = () => new MockAuthService({ latencyMs: 0, now: () => now });

describe('MockAuthService', () => {
  it('signs in an active account with a 30-day session when kept', async () => {
    const r = await svc().signIn('MARCELO@ibjjf.com ', DEMO_PASSWORDS.admin, true);
    expect(r.ok && r.session.role).toBe('admin');
    expect(r.ok && r.session.expiresAt).toBe('2027-09-11T10:00:00.000Z');
  });

  it('rejects a wrong password without saying whether the account exists', async () => {
    expect(await svc().signIn('jackson@ibjjf.com', 'nope', true)).toEqual({ ok: false, reason: 'invalid' });
    expect(await svc().signIn('nobody@ibjjf.com', 'nope', true)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('reports a deactivated account only for the right password', async () => {
    const s = svc();
    expect(await s.signIn('p.nakamura@ibjjf.com', 'wrong', true)).toEqual({ ok: false, reason: 'invalid' });
    const r = await s.signIn('p.nakamura@ibjjf.com', DEMO_PASSWORDS.crew, true);
    expect(r).toMatchObject({ ok: false, reason: 'deactivated', contactName: 'Marcelo' });
  });

  it('accepts a valid invitation once, keeping the person record', async () => {
    const s = svc();
    const r = await s.acceptInvitation(DEMO_TOKENS.invite, { name: 'Gordo Leal', password: 'long-enough-1', keep: false });
    expect(r.ok && r.session).toMatchObject({ personId: 'p-gordo', name: 'Gordo Leal', role: 'editor', expiresAt: null });
    expect((await s.lookupInvitation(DEMO_TOKENS.invite)).status).toBe('used');
    expect((await s.signIn('aleal@ibjjf.com', 'long-enough-1', true)).ok).toBe(true);
  });

  it('classifies expired, used and unknown invitations', async () => {
    const s = svc();
    expect((await s.lookupInvitation(DEMO_TOKENS.inviteExpired)).status).toBe('expired');
    expect((await s.lookupInvitation(DEMO_TOKENS.inviteUsed)).status).toBe('used');
    expect((await s.lookupInvitation('nope')).status).toBe('not-found');
    expect(await s.acceptInvitation(DEMO_TOKENS.inviteExpired, { name: 'x', password: 'long-enough-1', keep: true }))
      .toEqual({ ok: false, status: 'expired' });
  });

  it('issues a reset link only for active logins and uses it once', async () => {
    const s = svc();
    expect(await s.requestPasswordReset('nobody@ibjjf.com')).toEqual({});
    const { devLink } = await s.requestPasswordReset('diego@ibjjf.com');
    const token = devLink!.split('/').pop()!;
    expect(await s.lookupReset(token)).toEqual({ status: 'valid', email: 'diego@ibjjf.com' });
    expect((await s.resetPassword(token, 'a-new-password', true)).ok).toBe(true);
    expect((await s.lookupReset(token)).status).toBe('used');
    expect((await s.signIn('diego@ibjjf.com', 'a-new-password', true)).ok).toBe(true);
  });

  it('expires reset links after an hour', async () => {
    let t = now;
    const s = new MockAuthService({ latencyMs: 0, now: () => t });
    s.reset();
    t = new Date(now.getTime() + 61 * 60_000);
    expect((await s.lookupReset(DEMO_TOKENS.reset)).status).toBe('expired');
  });
});

describe('session storage', () => {
  it('keeps a kept session in localStorage and drops it once expired', () => {
    saveSession({ personId: 'p', name: 'P', email: 'p@x.com', role: 'crew', keep: true, expiresAt: '2027-09-11T10:00:00.000Z' });
    expect(localStorage.getItem('jjcon.session')).not.toBeNull();
    expect(loadSession(now)?.personId).toBe('p');
    expect(loadSession(new Date('2027-09-12T00:00:00Z'))).toBeNull();
  });

  it('keeps an unkept session in sessionStorage only', () => {
    saveSession({ personId: 'p', name: 'P', email: 'p@x.com', role: 'crew', keep: false, expiresAt: null });
    expect(localStorage.getItem('jjcon.session')).toBeNull();
    expect(loadSession(now)?.keep).toBe(false);
  });
});

describe('can', () => {
  it('matches the roles table', () => {
    expect(can('crew', 'checkOff')).toBe(true);
    expect(can('crew', 'changeDeadline')).toBe(false);
    expect(can('crew', 'markFinal', { isOwnTask: false })).toBe(false);
    expect(can('crew', 'markFinal', { isOwnTask: true })).toBe(true);
    expect(can('editor', 'editSectorContent', { leadsSector: false })).toBe(false);
    expect(can('editor', 'editSectorContent', { leadsSector: true })).toBe(true);
    expect(can('editor', 'managePeople')).toBe(false);
    expect(can('admin', 'editSectorContent', { leadsSector: false })).toBe(true);
  });
});
