import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { AuthProvider } from '../../auth/AuthContext';
import { MockAuthService } from '../../auth/mockAuthService';
import { opsDirectory } from '../../auth/service';
import { saveSession } from '../../auth/session';
import type { Role } from '../../auth/types';
import { packetPages } from '../data/packet';
import { activeSectors } from '../data/selectors';
import { opsStore } from '../data/store';

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

describe('Field view', () => {
  it('opens on the signed-in lead’s own sectors', async () => {
    const user = await renderAs('crew', '/field');
    expect(await screen.findByRole('heading', { name: 'My sectors' })).toBeInTheDocument();
    const mine = activeSectors(opsStore().get()).filter((s) => s.leadId === 'p-dandre' || s.ownerId === 'p-dandre');
    expect(screen.getAllByRole('link', { name: /·/ }).filter((a) => a.classList.contains('field-sector'))).toHaveLength(mine.length);
    await user.click(screen.getByRole('button', { name: 'My sectors only' }));
    expect(screen.getByRole('heading', { name: 'All sectors' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Crown Booth/ })).toBeInTheDocument();
  });

  it('confirms material lines on the shared list', async () => {
    const s = opsStore().sector('rooms')!;
    const row = s.blocks.mainMat.rows.find((r) => !r.checked)!;
    const user = await renderAs('crew', '/field/rooms?tab=materials');
    const box = await screen.findByRole('checkbox', { name: new RegExp(`^${row.item}, quantity`) });
    expect(box).toHaveAttribute('aria-checked', 'false');
    await user.click(box);
    expect(opsStore().sector('rooms')!.blocks.mainMat.rows.find((r) => r.id === row.id)!.checked).toBe(true);
    expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('shows a draft as not released instead of its content', async () => {
    opsStore().saveSector('customer', (x) => { x.blocks.instr.status = 'draft'; });
    await renderAs('crew', '/field/customer?tab=steps');
    expect(await screen.findByText('Instructions in draft')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Call Marcelo/ })).toHaveAttribute('href', 'tel:+17025550143');
  });
});

describe('Print packets', () => {
  it('previews a packet and counts the batch', async () => {
    const user = await renderAs('crew', '/print?sector=customer');
    expect(await screen.findByText('Preview · Customer Service')).toBeInTheDocument();
    expect(screen.getByText('Letter · 5 pages · grayscale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print 1 packet' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Select all sectors' }));
    const n = activeSectors(opsStore().get()).length;
    expect(screen.getByRole('button', { name: `Print ${n} packets` })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('button', { name: 'Print 0 packets' })).toBeDisabled();
  });

  it('prints, then records the packet as current once confirmed', async () => {
    // A sector with no released PDF prints straight away; PDF sheets wait for their canvas.
    const data = opsStore().get();
    const s = activeSectors(data).find((x) => !packetPages(x, 'x').some((p) => p.kind === 'plan' && p.file))!;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = await renderAs('admin', `/print?sector=${s.id}`);
    await user.click(await screen.findByRole('button', { name: 'Print 1 packet' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const dialog = await screen.findByRole('dialog', { name: 'Did the packets print?' });
    await user.click(within(dialog).getByRole('button', { name: 'Mark as printed' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 packet marked as printed');
    expect(opsStore().sector(s.id)!.packetPrintedAt).toBeTruthy();
    print.mockRestore();
  });

  it('is offered from the dashboard for the selected sectors', async () => {
    const user = await renderAs('crew', '/prep');
    await user.click(await screen.findByRole('checkbox', { name: 'Select Customer Service' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Rooms' }));
    // The header's button opens the page; the one beside the bulk actions takes the selection.
    await user.click(screen.getAllByRole('button', { name: 'Print packets' }).at(-1)!);
    expect(await screen.findByRole('button', { name: 'Print 2 packets' })).toBeInTheDocument();
  });
});
