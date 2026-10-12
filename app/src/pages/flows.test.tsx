import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { DEMO_PASSWORDS, DEMO_TOKENS, MockAuthService } from '../auth/mockAuthService';

function renderAt(path: string) {
  const service = new MockAuthService({ latencyMs: 0 });
  render(
    <AuthProvider service={service}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
  return userEvent.setup();
}

describe('sign in', () => {
  it('redirects to sign-in, then lands signed in with Sign out', async () => {
    const user = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText(/Logins are created by invitation only/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Keep me signed in/)).toBeChecked();
    await user.type(screen.getByLabelText('Email'), 'marcelo@ibjjf.com');
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORDS.admin);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Marcelo')).toBeInTheDocument();
    expect(screen.getByText(/Session ends \d{2} \w{3} \d{4}/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the wrong-password error and marks the field', async () => {
    const user = renderAt('/sign-in');
    await user.type(screen.getByLabelText('Email'), 'jackson@ibjjf.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-one');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match.');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/Logins are created by invitation only/)).not.toBeInTheDocument();
  });

  it('shows the deactivated state with "Use a different account"', async () => {
    const user = renderAt('/sign-in');
    await user.type(screen.getByLabelText('Email'), 'p.nakamura@ibjjf.com');
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORDS.crew);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/This account is deactivated.*ask Marcelo in the office/);
    await user.click(screen.getByRole('button', { name: 'Use a different account' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('validates before calling the service', async () => {
    const user = renderAt('/sign-in');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter an email like name@ibjjf.com.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });
});

describe('password reset', () => {
  it('requests a link, follows it and sets a new password', async () => {
    const user = renderAt('/forgot-password');
    await user.type(screen.getByLabelText('Email'), 'cardoso@ibjjf.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Open the reset link' }));
    expect(await screen.findByText('For cardoso@ibjjf.com')).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'brand-new-pass');
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'brand-new-pass');
    await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
    expect(await screen.findByRole('heading', { name: 'You’re signed in' })).toBeInTheDocument();
  });

  it('handles an unknown reset link', async () => {
    renderAt('/reset-password/nope');
    expect(await screen.findByRole('heading', { name: 'This reset link isn’t valid' })).toBeInTheDocument();
  });
});

describe('invitation', () => {
  it('accepts an invitation with the email locked', async () => {
    const user = renderAt(`/invite/${DEMO_TOKENS.invite}`);
    expect(await screen.findByRole('heading', { name: /Marcelo invited you/ })).toBeInTheDocument();
    expect(screen.getByText(/You’ll join as Editor/)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Gordo');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText('Choose a password'), 'gordo-password');
    await user.click(screen.getByRole('button', { name: 'Create account and sign in' }));
    expect(await screen.findByText(/Editor · aleal@ibjjf.com/)).toBeInTheDocument();
  });

  it('shows the expired state with a mailto to the inviter', async () => {
    renderAt(`/invite/${DEMO_TOKENS.inviteExpired}`);
    expect(await screen.findByRole('heading', { name: 'This invitation has expired' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email Marcelo for a new link' })).toHaveAttribute(
      'href', 'mailto:marcelo@ibjjf.com?subject=JJCON%20SetUp%20invitation'
    );
  });

  it('shows the already-used state', async () => {
    renderAt(`/invite/${DEMO_TOKENS.inviteUsed}`);
    expect(await screen.findByRole('heading', { name: 'This invitation has already been used' })).toBeInTheDocument();
    expect(screen.getByText(/The account for cardoso@ibjjf.com is already set up/)).toBeInTheDocument();
  });
});

it('renders the roles reference from the permissions table', async () => {
  renderAt('/access/roles');
  expect(screen.getByRole('columnheader', { name: 'Crew' })).toBeInTheDocument();
  expect(screen.getAllByText('Hidden')).toHaveLength(8);
  expect(screen.getByText('Login removed')).toBeInTheDocument();
});
