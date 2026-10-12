import { Link } from 'react-router-dom';
import { LOGIN_STATES } from '../auth/loginStates';
import { PERMISSIONS, ROLE_LABEL, ROLES } from '../auth/permissions';
import type { LoginState } from '../auth/types';
import { Icon } from '../components/Icon';
import { LoginChip } from '../components/LoginChip';

/** "5 · Roles and permissions" from JJCon Access, rendered from the same table `can()` reads. */
export function RolesReference() {
  return (
    <main className="ref-page">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="ref-overline">JJCON SetUp · access</span>
        <h1 className="ref-h1">Roles and permissions</h1>
        <p className="ref-lead">
          Anything a role can’t do is left out of the page entirely: no greyed-out Edit buttons, no locked menu items, no
          empty Settings group. Being assignable and being able to sign in are separate: everyone on the People list can
          own work, but only people with an accepted invitation can sign in. <Link to="/">Back to the app</Link>
        </p>
      </div>

      <div className="ref-panel ref-table-wrap">
        <table className="ref-table">
          <thead>
            <tr>
              <th scope="col">Capability</th>
              {ROLES.map((r) => <th scope="col" key={r}>{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.capability}>
                <td>{p.label}</td>
                {ROLES.map((r) => {
                  const g = p.grants[r];
                  return (
                    <td key={r}>
                      <span className={`ref-cell ref-cell--${g ? 'yes' : 'no'}`}>
                        <Icon name={g ? 'check' : 'minus'} size={14} />
                        {g ? g.label ?? 'Yes' : 'Hidden'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ref-grid ref-grid--states">
        {(Object.keys(LOGIN_STATES) as LoginState[]).map((s) => (
          <div className="ref-panel ref-card" key={s}>
            <LoginChip state={s} />
            <span className="ref-card__small">{LOGIN_STATES[s].text}</span>
          </div>
        ))}
      </div>

      <div className="ref-grid ref-grid--notes">
        <div className="ref-panel ref-card ref-card--note">
          <span className="ref-card__title">Sessions</span>
          <span className="ref-card__text">
            “Keep me signed in” lasts 30 days per device and is on by default. Unticked, the session ends when the browser
            closes. The sidebar always shows who is signed in, with Sign out underneath. Admins can sign a person out of
            every device from their People record.
          </span>
        </div>
        <div className="ref-panel ref-card ref-card--note">
          <span className="ref-card__title">Deactivating</span>
          <span className="ref-card__text">
            Removes the login and hides the person from assignment dropdowns. Their record, task history and name on
            printed packets stay. Open work must be reassigned first. Reactivating restores their earlier role; they sign
            in with their old password.
          </span>
        </div>
      </div>
    </main>
  );
}
