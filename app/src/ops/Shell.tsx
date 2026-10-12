import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL } from '../auth/permissions';
import { DS } from '../ds/bushido';
import { Icon, iconName } from '../ds/Icon';
import { useMe } from './access';
import { activeSectors, dateLabel, initials } from './data/selectors';
import { useOps } from './data/store';
import { LOAD_IN_FIRST_DAY, LOAD_IN_LABEL } from '../config';

function NavItem({ to, label, icon, match }: { to: string; label: string; icon: string; match: (path: string) => boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const on = match(pathname);
  return (
    <NavLink to={to} style={{ textDecoration: 'none', color: 'inherit' }} aria-current={on ? 'page' : undefined}
      onClick={(e) => { e.preventDefault(); navigate(to); }}>
      <DS.MenuItem label={label} selected={on} style={{ cursor: 'pointer' }}
        icon={<DS.Icon name={iconName(icon)} size={24} style={{ color: on ? 'var(--brand-primary)' : 'var(--text-secondary)' }} />} />
    </NavLink>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ops-nav__group">
      <span className="ops-nav__label">{label}</span>
      {children}
    </div>
  );
}

const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000);

/** The console frame: Bushido header, the menu, and who is signed in with Sign out. */
export function Shell() {
  const me = useMe();
  const data = useOps();
  const [navOpen, setNavOpen] = useState(() => window.innerWidth > 900);
  const person = data.people.find((p) => p.id === me.id);
  const name = person?.name ?? me.session.name;
  const left = daysUntil(LOAD_IN_FIRST_DAY);

  return (
    <div className="ops-shell">
      <DS.Header user={name} language="EN" showNotifications={false} onMenu={() => setNavOpen((v) => !v)} />
      <div className="ops-body">
        {navOpen && (
          <nav className="ops-nav" aria-label="JJCON SetUp">
            <NavGroup label="Set up">
              <NavItem to="/prep" label={`Prep dashboard · ${activeSectors(data).length}`} icon="IconFilledTh" match={(p) => p.startsWith('/prep')} />
              <NavItem to="/tasks" label="Tasks" icon="IconFilledTasks" match={(p) => p.startsWith('/tasks')} />
              <NavItem to="/team" label="Team" icon="IconFilledUsers" match={(p) => p.startsWith('/team')} />
              <NavItem to="/sectors" label="Sectors" icon="IconFilledVectorSquare" match={(p) => p.startsWith('/sectors')} />
            </NavGroup>
            <div className="ops-nav__foot">
              <div className="ops-nav__countdown">
                Load-in {LOAD_IN_LABEL}<br />
                <span style={{ font: 'var(--ib-text-numeric-small)' }}>{left > 0 ? `T-minus ${left} day${left === 1 ? '' : 's'}` : left === 0 ? 'Load-in starts today' : 'Load-in under way'}</span>
              </div>
              <div className="ops-me" aria-label="Signed in as">
                <span className="overline">Signed in as</span>
                <div className="ops-me__row">
                  <span className="ops-avatar" aria-hidden="true">{initials(name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ops-me__name">{name}</div>
                    <div className="ops-me__email">{me.session.email}</div>
                  </div>
                  <span className="ops-role">{ROLE_LABEL[me.role]}</span>
                </div>
                <div style={{ font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)', textWrap: 'pretty' }}>
                  {me.session.expiresAt
                    ? `Signed in on this device until ${dateLabel(me.session.expiresAt)}. On a shared laptop, sign out when you step away.`
                    : 'Signed in until you close the browser.'}
                </div>
                <button type="button" className="ops-signout" onClick={me.signOut}><Icon fa="sign-out-alt" size={14} />Sign out</button>
              </div>
            </div>
          </nav>
        )}
        <main className="ops-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
