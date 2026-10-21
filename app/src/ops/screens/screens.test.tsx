import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { AuthProvider } from '../../auth/AuthContext';
import { MockAuthService } from '../../auth/mockAuthService';
import { saveSession } from '../../auth/session';
import type { Role } from '../../auth/types';
import { opsStore } from '../data/store';

const PEOPLE: Record<Role, { personId: string; name: string; email: string }> = {
  admin: { personId: 'p-marcelo', name: 'Marcelo', email: 'marcelo@ibjjf.com' },
  editor: { personId: 'p-diego', name: 'Diego', email: 'diego@ibjjf.com' },
  crew: { personId: 'p-dandre', name: "D'Andre", email: 'jackson@ibjjf.com' }
};

async function renderAs(role: Role, path: string) {
  saveSession({ ...PEOPLE[role], role, keep: true, expiresAt: '2099-01-01T00:00:00.000Z' });
  render(
    <AuthProvider service={new MockAuthService({ latencyMs: 0 })}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
  await waitFor(() => expect(screen.queryByText('Loading JJCON SetUp…')).not.toBeInTheDocument());
  return userEvent.setup();
}

describe('Prep dashboard', () => {
  it('lists active sectors by group with their rollups', async () => {
    const user = await renderAs('admin', '/prep');
    expect(screen.getByRole('heading', { name: 'Prep dashboard' })).toBeInTheDocument();
    expect(screen.getByText('25 of 25 sectors shown')).toBeInTheDocument();
    expect(screen.queryByText('Empty Crate Return')).not.toBeInTheDocument();
    const row = screen.getByRole('button', { name: 'Podium World Master' }).closest('tr')!;
    expect(within(row).getByText('Blocked')).toBeInTheDocument();
    await user.click(within(row).getByTitle(/2 of 4 required plans uploaded/));
    expect(screen.getByText('Required floorplans · Podium World Master')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit plan' })).toHaveLength(4);
  });

  it('filters to incomplete sectors', async () => {
    const user = await renderAs('admin', '/prep');
    await user.click(screen.getByRole('button', { name: 'Incomplete only' }));
    expect(screen.queryByRole('button', { name: 'Carpet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IBJJF Store' })).toBeInTheDocument();
  });

  it('marks drafts ready on the selected sectors, leaving plans to their files', async () => {
    const user = await renderAs('admin', '/prep');
    await user.click(screen.getByLabelText('Select Entrance — Spectators'));
    await user.click(screen.getByRole('button', { name: 'Mark ready' }));
    await user.click(screen.getByRole('button', { name: 'Mark 3 drafts ready' }));
    const s = opsStore().sector('ent-spec')!;
    expect([s.blocks.mainMat.status, s.blocks.netMat.status, s.blocks.instr.status]).toEqual(['ready', 'ready', 'ready']);
    expect(s.plans.B.file).toBeUndefined();
  });

  it('leaves Add sector and bulk actions out for crew', async () => {
    await renderAs('crew', '/prep');
    expect(screen.queryByRole('button', { name: 'Add sector' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark ready' })).not.toBeInTheDocument();
  });
});

describe('Sectors index', () => {
  it('archives a sector and restores it from the Archived tab', async () => {
    const user = await renderAs('admin', '/sectors');
    await user.click(screen.getByRole('button', { name: 'Archive Square' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive sector' }));
    expect(screen.getByRole('tab', { name: 'Archived 3' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getAllByRole('button', { name: 'Restore' })[2]);
    expect(screen.getByRole('tab', { name: 'Archived 2' })).toBeInTheDocument();
  });

  it('needs the sector name typed before deleting one with content', async () => {
    const user = await renderAs('admin', '/sectors');
    await user.click(screen.getByRole('button', { name: 'Delete Rooms' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('6 instruction steps')).toBeInTheDocument();
    const del = within(dialog).getByRole('button', { name: 'Delete permanently' });
    expect(del).toBeDisabled();
    await user.type(within(dialog).getByPlaceholderText('Rooms'), 'Rooms');
    await user.click(del);
    expect(opsStore().sector('rooms')).toBeUndefined();
  });
});

describe('Sector form', () => {
  it('creates a sector with the group’s default blocks', async () => {
    const user = await renderAs('admin', '/sectors/new');
    expect(screen.getByRole('button', { name: 'Create sector' })).toBeDisabled();
    await user.type(screen.getByLabelText('Sector name'), 'Warm-up Area');
    await user.click(screen.getByRole('switch', { name: /General Layout/ }));
    await user.click(screen.getByRole('button', { name: 'Create sector' }));
    expect(await screen.findByRole('heading', { name: 'Warm-up Area' })).toBeInTheDocument();
    expect(screen.getByText('No PDF uploaded · General Layout')).toBeInTheDocument();
  });

  it('warns before turning off a block that holds content, and keeps it', async () => {
    const user = await renderAs('admin', '/sectors/truss/edit');
    await user.click(screen.getByRole('switch', { name: /Instructions/ }));
    const dialog = screen.getByRole('dialog', { name: 'Turn off Instructions?' });
    expect(dialog).toHaveTextContent('already holds 7 numbered steps');
    await user.click(within(dialog).getByRole('button', { name: 'Turn off block' }));
    expect(screen.getByRole('switch', { name: /Instructions/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Content kept')).toBeInTheDocument();
  });

  it('adds a custom block while editing', async () => {
    const user = await renderAs('admin', '/sectors/square/edit');
    await user.click(screen.getByRole('button', { name: 'Add block' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: /Text section/ }));
    await user.type(within(dialog).getByLabelText('Block name'), 'Shutdown plan');
    await user.click(within(dialog).getByRole('button', { name: 'Add block' }));
    expect(screen.getByText('New')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { name: 'Square' })).toBeInTheDocument();
    expect(opsStore().sector('square')!.custom.map((c) => c.name)).toEqual(['Shutdown plan']);
  });

  it('sends crew back to the sector page', async () => {
    await renderAs('crew', '/sectors/truss/edit');
    expect(screen.getByRole('heading', { name: 'Truss' })).toBeInTheDocument();
  });
});

describe('Sector page', () => {
  it('checks material off directly from desktop', async () => {
    const user = await renderAs('crew', '/sectors/rooms');
    expect(screen.getByText('/ 10 confirmed')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Confirm Water stations' }));
    expect(opsStore().sector('rooms')!.blocks.mainMat.rows.find((r) => r.item === 'Water stations')!.checked).toBe(true);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('lets an editor edit only the sectors they lead', async () => {
    await renderAs('editor', '/sectors/store');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sector actions' })).not.toBeInTheDocument();
  });

  it('hides Edit from an editor who does not lead the sector', async () => {
    await renderAs('editor', '/sectors/carpet');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('edits material rows and steps, then saves', async () => {
    const user = await renderAs('admin', '/sectors/crates');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const qty = screen.getAllByLabelText('Quantity 1')[0];
    await user.clear(qty);
    await user.type(qty, '10');
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.type(screen.getByLabelText('Step 4'), 'Sweep the dock.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const s = opsStore().sector('crates')!;
    expect(s.blocks.mainMat.rows[0].qty).toBe(10);
    expect(s.blocks.instr.steps.map((x) => x.text)).toContain('Sweep the dock.');
    expect(screen.getByText('Sweep the dock.')).toBeInTheDocument();
  });

  it('cancel discards edits', async () => {
    const user = await renderAs('admin', '/sectors/crates?edit=1');
    await user.click(screen.getAllByRole('button', { name: /Remove/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opsStore().sector('crates')!.blocks.mainMat.rows).toHaveLength(3);
  });

  it('shows the missing-PDF notice for a required plan with no file', async () => {
    await renderAs('admin', '/sectors/store?plan=D');
    expect(screen.getByText('No PDF uploaded · Power Drops & Extension Cords')).toBeInTheDocument();
    expect(screen.getByText('Owner Diego has to upload this plan before load-in.')).toBeInTheDocument();
  });

  it('links the goodie bag booth and assembly line to each other', async () => {
    const user = await renderAs('admin', '/sectors/goodie-booth');
    await user.click(screen.getByRole('link', { name: 'Goodie Bag Assembly Line' }));
    expect(screen.getByRole('heading', { name: 'Goodie Bag Assembly Line' })).toBeInTheDocument();
  });
});
