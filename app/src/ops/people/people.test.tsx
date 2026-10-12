import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { AuthProvider } from '../../auth/AuthContext';
import { MockAuthService } from '../../auth/mockAuthService';
import { opsDirectory } from '../../auth/service';
import { saveSession } from '../../auth/session';
import type { Role } from '../../auth/types';
import { opsStore } from '../data/store';
import { personHistory, personLoad } from '../data/people';
import { toIsoDay } from '../data/tasks';

const PEOPLE: Record<Role, { personId: string; name: string; email: string }> = {
  admin: { personId: 'p-marcelo', name: 'Marcelo', email: 'marcelo@ibjjf.com' },
  editor: { personId: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com' },
  crew: { personId: 'p-dandre', name: "D'Andre", email: 'jackson@ibjjf.com' }
};

async function renderAs(role: Role, path: string) {
  saveSession({ ...PEOPLE[role], role, keep: true, expiresAt: '2099-01-01T00:00:00.000Z', issuedAt: new Date().toISOString() });
  render(
    <AuthProvider service={new MockAuthService({ latencyMs: 0, directory: opsDirectory })}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
    </AuthProvider>
  );
  await waitFor(() => expect(screen.queryByText('Loading JJCON SetUp…')).not.toBeInTheDocument());
  return userEvent.setup();
}

const today = () => toIsoDay(new Date());

describe('People', () => {
  it('lists everyone with their login state', async () => {
    await renderAs('admin', '/people');
    expect(await screen.findByText('3 can sign in · 1 invited · 1 without login')).toBeInTheDocument();
    const gordo = screen.getByRole('link', { name: 'Gordo' }).closest('tr')!;
    expect(within(gordo).getByText('Invited')).toBeInTheDocument();
    expect(within(gordo).getByRole('button', { name: 'Resend' })).toBeInTheDocument();
  });

  it('is left out entirely for anyone but an admin', async () => {
    await renderAs('editor', '/people');
    expect(await screen.findByRole('heading', { name: 'Prep dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /People/ })).not.toBeInTheDocument();
  });

  it('warns about a likely duplicate when adding someone', async () => {
    const user = await renderAs('admin', '/people');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Diego');
    expect(within(dialog).getByText(/is already on the list/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Rita Souza');
    await user.click(within(dialog).getByRole('button', { name: 'Add person' }));
    expect(screen.getByRole('link', { name: 'Rita Souza' })).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('invites someone new, who is assignable straight away', async () => {
    const user = await renderAs('admin', '/people');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Rita Souza');
    await user.type(within(dialog).getByLabelText('Email'), 'diego@ibjjf.com');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Diego already uses this email');
    await user.clear(within(dialog).getByLabelText('Email'));
    await user.type(within(dialog).getByLabelText('Email'), 'rita@ibjjf.com');
    await user.click(within(dialog).getByRole('radio', { name: /Editor/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByText(/Invitation sent to rita@ibjjf.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'open the invitation link' })).toBeInTheDocument();
    const row = screen.getByRole('link', { name: 'Rita Souza' }).closest('tr')!;
    expect(await within(row).findByText('Invited')).toBeInTheDocument();
    expect(opsStore().get().people.find((p) => p.name === 'Rita Souza')!.active).toBe(true);
  });

  it('changes someone’s app role', async () => {
    const user = await renderAs('admin', '/people');
    const select = await screen.findByLabelText('App role for Diego');
    await user.selectOptions(select, 'crew');
    expect(await screen.findByText(/Diego is now Crew/)).toBeInTheDocument();
  });
});

describe('Person record', () => {
  it('deactivates after moving all open work to one person', async () => {
    const user = await renderAs('admin', '/people/p-dandre');
    expect(personLoad(opsStore().get(), 'p-dandre', today()).secs.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reassign and deactivate' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: /^Move everything to:/ }));
    await user.click(screen.getByRole('option', { name: /Diego/ }));
    expect(within(dialog).getByText(/All \d+ have a new owner/)).toBeInTheDocument();
    await user.click(confirm);
    const L = personLoad(opsStore().get(), 'p-dandre', today());
    expect([L.secs.length, L.open.length]).toEqual([0, 0]);
    expect(opsStore().get().people.find((p) => p.id === 'p-dandre')!.active).toBe(false);
    expect(screen.getByText(/Inactive since/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('explains why someone with history can’t be deleted', async () => {
    const user = await renderAs('admin', '/people/p-daniela');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: "Daniela can't be deleted" });
    expect(within(dialog).getByText(/sectors as lead or owner/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Deactivate instead' })).toBeInTheDocument();
  });

  it('deletes someone never assigned anything', async () => {
    const id = opsStore().createPerson({ name: 'Temp Person', role: '', email: '', active: true });
    expect(personHistory(opsStore().get(), id, today())).toEqual([]);
    const user = await renderAs('admin', `/people/${id}`);
    await user.click(screen.getAllByRole('button', { name: /^Delete/ })[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete person' }));
    expect(await screen.findByText('Temp Person was deleted.')).toBeInTheDocument();
    expect(opsStore().get().people.some((p) => p.id === id)).toBe(false);
  });

  it('renames everywhere at once', async () => {
    const user = await renderAs('admin', '/people/p-gordo');
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    expect(screen.getByText(/A name is needed/)).toBeInTheDocument();
    await user.type(name, 'Gordo Leal');
    expect(opsStore().get().people.find((p) => p.id === 'p-gordo')!.name).toBe('Gordo Leal');
  });
});
