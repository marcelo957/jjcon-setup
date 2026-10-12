import type { IconName } from '../components/icons';
import type { LoginState } from './types';

export const LOGIN_STATES: Record<LoginState, { label: string; icon: IconName; text: string }> = {
  active: { label: 'Can sign in', icon: 'circle-check', text: 'Accepted an invitation. Has a role and a password.' },
  invited: { label: 'Invited', icon: 'clock', text: 'Invitation sent, not accepted yet. Already assignable. Admins can resend or revoke.' },
  none: { label: 'No login', icon: 'minus', text: 'Added as a name only. Assignable, but cannot sign in until invited.' },
  deactivated: { label: 'Login removed', icon: 'user-slash', text: 'Deactivated. Not assignable, cannot sign in. History kept.' }
};
