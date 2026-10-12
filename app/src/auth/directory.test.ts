import { MockAuthService, DEMO_PASSWORDS, DEMO_TOKENS } from './mockAuthService';
import { opsDirectory } from './service';
import { opsStore } from '../ops/data/store';

const svc = () => new MockAuthService({ latencyMs: 0, directory: opsDirectory });

describe('auth with the People list as its directory', () => {
  it('signs in with the name from the People list', async () => {
    opsStore().updatePerson('p-diego', { name: 'Diego Alvarez' });
    const r = await svc().signIn('diego@ibjjf.com', DEMO_PASSWORDS.editor, true);
    expect(r.ok && r.session.name).toBe('Diego Alvarez');
  });

  it('accepting an invitation renames the person record', async () => {
    await svc().acceptInvitation(DEMO_TOKENS.invite, { name: 'Gordo Leal', password: 'long-enough-1', keep: true });
    expect(opsStore().get().people.find((p) => p.id === 'p-gordo')!.name).toBe('Gordo Leal');
  });

  it('invites someone added on the People list, and the link works', async () => {
    const s = svc();
    const id = opsStore().createPerson({ name: 'Rita Souza', role: '', email: 'rita@ibjjf.com', active: true });
    const { devLink } = await s.access.invite(id, 'editor', 'p-marcelo');
    const token = devLink!.split('/').pop()!;
    const look = await s.lookupInvitation(token);
    expect(look.status === 'valid' && look.invitation).toMatchObject({ name: 'Rita Souza', role: 'editor', invitedBy: 'Marcelo' });
    expect((await s.access.listAccess()).find((a) => a.personId === id)).toMatchObject({ login: 'invited', role: 'editor' });
    await s.access.invite(id, 'editor', 'p-marcelo');
    expect((await s.lookupInvitation(token)).status).toBe('revoked');
  });

  it('a deactivated person is told so at sign-in, and their session ends', async () => {
    const s = svc();
    const r = await s.signIn('jackson@ibjjf.com', DEMO_PASSWORDS.crew, true);
    if (!r.ok) throw new Error('expected sign in');
    opsStore().deactivatePerson('p-dandre', 'p-marcelo', { sectors: [], tasks: [] }, []);
    expect(await s.checkSession(r.session)).toBeNull();
    expect(await s.signIn('jackson@ibjjf.com', DEMO_PASSWORDS.crew, true)).toMatchObject({ ok: false, reason: 'deactivated', contactName: 'Marcelo' });
    opsStore().reactivatePerson('p-dandre');
    expect((await s.signIn('jackson@ibjjf.com', DEMO_PASSWORDS.crew, true)).ok).toBe(true);
  });

  it('role changes apply to the next check, and sign out everywhere ends older sessions', async () => {
    const s = svc();
    const r = await s.signIn('diego@ibjjf.com', DEMO_PASSWORDS.editor, true);
    if (!r.ok) throw new Error('expected sign in');
    await s.access.setRole('p-diego', 'crew');
    expect((await s.checkSession(r.session))!.role).toBe('crew');
    await new Promise((res) => setTimeout(res, 5));
    await s.access.signOutEverywhere('p-diego');
    expect(await s.checkSession(r.session)).toBeNull();
  });

  it('revoking leaves an assignable name with no login', async () => {
    const s = svc();
    await s.access.revokeInvite('p-gordo');
    expect((await s.access.listAccess()).find((a) => a.personId === 'p-gordo')!.login).toBe('none');
    expect((await s.lookupInvitation(DEMO_TOKENS.invite)).status).toBe('revoked');
  });
});
