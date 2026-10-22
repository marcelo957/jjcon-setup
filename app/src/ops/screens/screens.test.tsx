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
    const late = taskRows(opsStore().get(), toIsoDay(new Date())).filter((r) => r.sectorId === 'pod-wm' && r.late).length;
    expect(late).toBeGreaterThan(0);
    expect(within(row).getByText(`${late} late`)).toBeInTheDocument();
    expect(row).toHaveClass('row--late');
    await user.click(within(row).getByTitle(/2 of 4 required plans uploaded/));
    expect(screen.getByText('Required floorplans · Podium World Master')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit plan' })).toHaveLength(4);
  });

  it('leads with what is late, and filters to those sectors on click', async () => {
    const user = await renderAs('admin', '/prep');
    const rows = taskRows(opsStore().get(), toIsoDay(new Date()));
    const late = rows.filter((r) => r.late).length;
    const bar = screen.getByRole('region', { name: 'Deadlines' });
    await user.click(within(bar).getByRole('button', { name: new RegExp(`^${late} late`) }));
    const lateSectors = new Set(rows.filter((r) => r.late).map((r) => r.sectorId)).size;
    expect(screen.getByText(`${lateSectors} of 25 sectors shown`)).toBeInTheDocument();
  });

  it('filters to incomplete sectors', async () => {
    const user = await renderAs('admin', '/prep');
    await user.click(screen.getByRole('button', { name: 'Incomplete only' }));
    expect(screen.queryByRole('button', { name: 'Carpet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IBJJF Store' })).toBeInTheDocument();
  });

  it('shows what written blocks hold, with no status to set', async () => {
    await renderAs('admin', '/prep');
    expect(screen.queryByRole('button', { name: 'Mark ready' })).not.toBeInTheDocument();
    const s = opsStore().sector('rooms')!;
    const row = screen.getByRole('button', { name: 'Rooms' }).closest('tr')!;
    expect(within(row).getByText(`${s.blocks.mainMat.rows.length} items`)).toBeInTheDocument();
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
    expect(screen.getByText('/ 10 confirmed on site')).toBeInTheDocument();
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

  it('edits material rows and steps, then saves, recording who edited', async () => {
    opsStore().unlockFinal('crates', 'mainMat', 'p-marcelo');
    opsStore().unlockFinal('crates', 'instr', 'p-marcelo');
    const user = await renderAs('admin', '/sectors/crates');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const qty = screen.getAllByLabelText('Quantity 1')[0];
    await user.clear(qty);
    await user.type(qty, '10');
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.type(screen.getAllByLabelText(/^Step \d+$/).at(-1)!, 'Sweep the dock.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const s = opsStore().sector('crates')!;
    expect(s.blocks.mainMat.rows[0].qty).toBe(10);
    expect(s.blocks.instr.steps.map((x) => x.text)).toContain('Sweep the dock.');
    expect(screen.getByText('Sweep the dock.')).toBeInTheDocument();
    expect(s.blocks.instr.edited?.by).toBe('p-marcelo');
  });

  it('locks a block marked final until someone unlocks it', async () => {
    opsStore().unlockFinal('rooms', 'mainMat', 'p-marcelo');
    const user = await renderAs('admin', '/sectors/rooms');
    await user.click(screen.getAllByRole('button', { name: 'Mark final' })[0]);
    expect(opsStore().sector('rooms')!.blocks.mainMat.final?.by).toBe('p-marcelo');
    expect(screen.getAllByText(/^Final · Marcelo/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getAllByText('Final. Unlock it to edit.').length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Unlock to edit' })[0]);
    expect(opsStore().sector('rooms')!.blocks.mainMat.final).toBeUndefined();
    expect(screen.getAllByLabelText('Quantity 1').length).toBeGreaterThan(0);
  });

  it('cancel discards edits', async () => {
    const user = await renderAs('admin', '/sectors/crates?edit=1');
    await user.click(screen.getAllByRole('button', { name: /Remove/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opsStore().sector('crates')!.blocks.mainMat.rows).toHaveLength(3);
  });

  it('opens plans at 100% and keeps a chosen zoom while switching plans', async () => {
    const user = await renderAs('admin', '/sectors/customer');
    expect(await screen.findByRole('button', { name: '100%', pressed: true })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fit page' }));
    const tabs = screen.getAllByRole('tab');
    await user.click(tabs.find((t) => t.getAttribute('aria-selected') === 'false' && !t.hasAttribute('disabled'))!);
    expect(screen.getByRole('button', { name: 'Fit page', pressed: true })).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
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
