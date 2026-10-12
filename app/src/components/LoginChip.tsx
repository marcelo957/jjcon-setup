import { LOGIN_STATES } from '../auth/loginStates';
import type { LoginState } from '../auth/types';
import { Icon } from './Icon';

export function LoginChip({ state }: { state: LoginState }) {
  const s = LOGIN_STATES[state];
  return (
    <span className={`login-chip login-chip--${state}`}>
      <Icon name={s.icon} size={11} />
      {s.label}
    </span>
  );
}
