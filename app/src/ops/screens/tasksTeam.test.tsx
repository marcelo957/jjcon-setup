import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { AuthProvider } from '../../auth/AuthContext';
import { MockAuthService } from '../../auth/mockAuthService';
import { saveSession } from '../../auth/session';
import type { Role } from '../../auth/types';
import { opsStore } from '../data/store';
import { taskRows, toIsoDay } from '../data/tasks';

const PEOPLE: Record<Role, { personId: string; name: string; email: string }> = {
  admin: { personId: 'p-marcelo', name: 'Marcelo', email: 'marcelo@ibjjf.com' },
  editor: { personId: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com' },
  crew: { personId: 'p-dandre', name: "D'Andre", email: 'jackson@ibjjf.com' }
};

async function renderAs(role: Role, path: string) {
  saveSession({ ...PEOPLE[role], role, keep: true, expiresAt: '2099-01-01T00:00:00.000Z' });
  render(
    <AuthProvider service={new MockAuthService({ latencyMs: 0 })}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
    </AuthProvider>
  );
  await waitFor(() => expect(screen.queryByText('Loading JJCON SetUp…')).not.toBeInTheDocument());
  return userEvent.setup();
}

const rows = () => taskRows(opsStore().get(), toIsoDay(new Date()));

describe('Tasks', () => {
  it('lists every required item with the summary strip', async () => {
    await renderAs('admin', '/tasks');
    const total = rows().length;
    expect(screen.getByText(`${total} of ${total} items`)).toBeInTheDocument();
    expect(screen.getByText('Floorplans uploaded · required plans')).toBeInTheDocument();
    expect(screen.getByText('Material lists empty')).toBeInTheDocument();
  });

  it('filters, shows removable chips, and clears them', async () => {
    const user = await renderAs('admin', '/tasks');
    await user.click(screen.getByRole('button', { name: 'Late only' }));
    const late = rows().filter((r) => r.late).length;
    expect(screen.getByText(`${late} of ${rows().length} items`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove filter Late only' }));
    expect(screen.getByText(`${rows().length} of ${rows().length} items`)).toBeInTheDocument();
  });

  it('explains that In place and Late only never overlap', async () => {
    const user = await renderAs('admin', '/tasks?status=done&late=1');
    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show late items' }));
    expect(screen.getByRole('button', { name: 'Missing', pressed: true })).toBeInTheDocument();
  });

  it('My tasks filters to the signed-in person', async () => {
    const user = await renderAs('admin', '/tasks');
    await user.click(screen.getByRole('button', { name: 'My tasks' }));
    expect(screen.getByRole('button', { name: 'Remove filter Person · Marcelo' })).toBeInTheDocument();
    const mine = rows().filter((r) => r.who === 'p-marcelo').length;
    expect(screen.getByText(`${mine} of ${rows().length} items`)).toBeInTheDocument();
  });

  it('shows what exists instead of a tick, with the way to add what is missing', async () => {
    const user = await renderAs('admin', '/tasks?sector=crown');
    expect(screen.queryByRole('checkbox', { name: / done$/ })).not.toBeInTheDocument();
    const mat = rows().find((r) => r.key === 'crown:mainMat')!;
    expect(mat.done).toBe(false);
    await user.click(screen.getAllByRole('button', { name: 'Write it' })[0]);
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('crew cannot write, upload, reassign or move deadlines from the list', async () => {
    await renderAs('crew', '/tasks?sector=seminar');
    expect(screen.queryByRole('button', { name: 'Write it' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload PDF' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Deadline for/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reassign selected/ })).not.toBeInTheDocument();
  });

  it('shifts selected deadlines by a week', async () => {
    const user = await renderAs('admin', '/tasks?sector=crown');
    const before = rows().find((r) => r.key === 'crown:G')!.due;
    await user.click(screen.getByLabelText('Select Crown Booth, Floorplan — General Layout'));
    await user.click(screen.getByRole('button', { name: '7 days later' }));
    const after = rows().find((r) => r.key === 'crown:G')!.due;
    expect(new Date(after).getTime() - new Date(before).getTime()).toBe(7 * 86_400_000);
  });
});

describe('Team', () => {
  it('puts unassigned work first and orders people by how far behind they are', async () => {
    await renderAs('admin', '/team');
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names[0]).toBe('Unassigned');
    expect(names[1]).toBe('Diego');
  });

  it('sends you to the work instead of marking it done', async () => {
    const user = await renderAs('admin', '/team?person=__un');
    const card = screen.getByRole('region', { name: 'Unassigned' });
    expect(within(card).queryByRole('button', { name: /^Mark done/ })).not.toBeInTheDocument();
    const go = within(card).getAllByRole('button', { name: /^(Write it|Upload PDF):/ });
    expect(go.length).toBeGreaterThan(0);
    await user.click(go[0]);
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('records a delay note that shows on the item', async () => {
    const user = await renderAs('admin', '/team?person=p-daniela');
    await user.click(screen.getByRole('button', { name: /^Podium World Master\s*Floorplan — Power Drops/ }));
    await user.type(screen.getByLabelText('Note on the delay'), 'Electrician out until Thursday.');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByText(/Electrician out until Thursday\./)).toBeInTheDocument();
  });

  it('presents one person at a time with keyboard navigation', async () => {
    const user = await renderAs('admin', '/team');
    await user.click(screen.getByRole('button', { name: 'Present' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Weekly planning: Unassigned');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Weekly planning: Diego');
    expect(within(screen.getByRole('dialog')).getByText(/2 of \d/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves reassignment out for crew', async () => {
    await renderAs('crew', '/team');
    expect(screen.queryByRole('button', { name: /Reassign all/ })).not.toBeInTheDocument();
  });
});
