import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../../auth/types';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { SearchInput } from '../../ds/Select';
import { useMe } from '../access';
import { personLoad } from '../data/people';
import { dateLabel, initials, sortPeople } from '../data/selectors';
import { useOps } from '../data/store';
import { toIsoDay } from '../data/tasks';
import type { Person } from '../data/types';
import { PageHead } from '../ui/bits';
import { LoginChip } from '../../components/LoginChip';
import { accessOf, ROLE_LABEL, useAccessList } from './access';
import { AddPersonDialog, InviteDialog, type Banner } from './PeopleDialogs';

export function BannerBar({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 12, borderRadius: 8, background: 'var(--feedback-info-background)' }}>
      <Icon fa={banner.icon} size={16} style={{ color: 'var(--brand-primary)' }} />
      <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty' }}>
        {banner.text}
        {banner.link && <> <span className="muted">Demo mode, no email is sent:</span> <Link to={banner.link}>open the invitation link</Link>.</>}
      </span>
      <button type="button" onClick={onClose} aria-label="Dismiss" style={{ border: 0, background: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon fa="xmark" size={14} /></button>
    </div>
  );
}

export const statusChip = (on: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: '.03em',
  background: on ? 'var(--feedback-success-background)' : 'var(--border-subtle)', color: on ? 'var(--feedback-success-text)' : 'var(--text-secondary)'
});

const countStyle = (n: number, danger?: boolean): React.CSSProperties => ({
  minWidth: 40, minHeight: 30, padding: '0 10px', border: 0, borderRadius: 4, background: 'none', cursor: 'pointer', fontFamily: "'Roboto Mono', monospace", fontSize: 14,
  fontWeight: danger && n ? 600 : 400, color: !n ? 'var(--color-neutral-gray-300)' : danger ? 'var(--feedback-danger-text)' : 'var(--text-primary)'
});

/** Everyone who can own a sector or a task. Every assignment field picks from this list. Admin only. */
export function PeoplePage() {
  const data = useOps();
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const { list: access, refresh, admin } = useAccessList();
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [dialog, setDialog] = useState<{ kind: 'add' } | { kind: 'invite'; person?: Person } | null>(null);
  const [banner, setBanner] = useState<Banner | null>((location.state as { banner?: Banner } | null)?.banner ?? null);
  const [fresh, setFresh] = useState<string | null>(null);

  const today = toIsoDay(new Date());
  const all = sortPeople(data.people);
  const needle = q.trim().toLowerCase();
  const list = all.filter((p) => (!activeOnly || p.active) && (!needle || [p.name, p.role, p.email].join(' ').toLowerCase().includes(needle)));
  const views = new Map(all.map((p) => [p.id, accessOf(p, access?.find((a) => a.personId === p.id))]));
  const n = (s: string) => all.filter((p) => views.get(p.id)!.state === s).length;
  const summary = [`${n('active')} can sign in`, n('invited') ? `${n('invited')} invited` : '', n('none') ? `${n('none')} without login` : ''].filter(Boolean).join(' · ');
  const team = (id: string, late = false) => navigate(`/team?person=${id}${late ? '&overdue=1' : ''}&from=people`);

  const act = async (fn: () => Promise<unknown>, b: Banner) => { await fn(); refresh(); setBanner(b); };

  return (
    <div>
      <PageHead overline="Settings · assignment list" title="People"
        lead="Everyone who can own a sector or a task. Every owner, lead and responsible field in the app picks from this list."
        actions={<>
          <Button variant="neutral" outlined icon="user-plus" onClick={() => setDialog({ kind: 'add' })}>Add person</Button>
          <Button icon="envelope" onClick={() => setDialog({ kind: 'invite' })}>Invite</Button>
        </>} />
      {banner && <BannerBar banner={banner} onClose={() => setBanner(null)} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <SearchInput placeholder="Search name, role or email" value={q} onChange={(v) => { setQ(v); setFresh(null); }} width={280} />
        <Button size="small" outlined={!activeOnly} icon="user-check" onClick={() => setActiveOnly((v) => !v)}>Active only</Button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginLeft: 'auto', font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)' }}>
          <span>{access ? summary : 'Loading logins…'}</span>
          <span className="mono" style={{ fontSize: 13 }}>{list.length} of {all.length} people · {all.filter((p) => p.active).length} active</span>
        </span>
      </div>

      <div className="card table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-divider)', background: 'var(--color-neutral-surface-50)' }}>
              {['Name', 'Job title', 'Email', 'App role', 'Login', 'Status'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', font: 'var(--ib-text-subtitle-2)' }}>{h}</th>)}
              {['Sectors led', 'Open items', 'Overdue'].map((h) => <th key={h} style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', font: 'var(--ib-text-subtitle-2)' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const L = personLoad(data, p.id, today);
              const v = views.get(p.id)!;
              const a = access?.find((x) => x.personId === p.id);
              const self = p.id === me.id;
              const roleEditable = v.hasRole && !self;
              return (
                <tr key={p.id} onClick={() => navigate(`/people/${p.id}`)} className="ppl-row"
                  style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: fresh === p.id ? 'var(--feedback-info-background)' : p.active ? 'var(--color-neutral-white)' : 'var(--color-neutral-surface-50)' }}>
                  <td style={{ padding: '8px 16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.name} px={32} on={p.active} />
                      <Link to={`/people/${p.id}`} onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 17, fontWeight: 500, color: p.active ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.name || 'Unnamed person'}</Link>
                      {fresh === p.id && <span className="badge" style={{ background: 'var(--feedback-info-background)', color: 'var(--brand-primary)' }}>New</span>}
                    </span>
                  </td>
                  <td style={{ padding: '8px 16px', fontSize: 14, color: p.role ? (p.active ? 'var(--text-primary)' : 'var(--text-secondary)') : 'var(--color-neutral-gray-300)' }}>{p.role || 'Not set'}</td>
                  <td style={{ padding: '8px 16px', fontSize: 14, color: p.email ? 'var(--text-secondary)' : 'var(--color-neutral-gray-300)' }}>{p.email || 'Not set'}</td>
                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {roleEditable && a ? (
                      <select aria-label={`App role for ${p.name}`} value={a.role} onChange={(e) => {
                        const r = e.target.value as Role;
                        void act(() => admin.setRole(p.id, r), { text: `${p.name} is now ${ROLE_LABEL[r]}. The change applies the next time they open a page.`, icon: 'user-pen' });
                      }} style={{ minHeight: 32, padding: '0 8px', border: '1px solid var(--border-divider)', borderRadius: 8, background: 'var(--color-neutral-white)', font: 'var(--ib-text-body-small)', cursor: 'pointer' }}>
                        <option value="admin">Admin</option><option value="editor">Editor</option><option value="crew">Crew</option>
                      </select>
                    ) : (
                      <>
                        <span style={{ fontSize: 14, color: v.hasRole ? 'var(--text-primary)' : 'var(--color-neutral-gray-300)' }}>{v.hasRole && a ? ROLE_LABEL[a.role] : '—'}</span>
                        {self && v.hasRole && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>You</span>}
                      </>
                    )}
                  </td>
                  <td style={{ padding: '8px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <LoginChip state={v.state} />
                    <span style={{ display: 'block', fontSize: 12, lineHeight: '17px', color: 'var(--text-secondary)', marginTop: 3 }}>{v.sub}</span>
                    {v.state === 'invited' && (
                      <span style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                        <button type="button" className="link-btn" style={{ font: 'var(--ib-text-body-small)', fontWeight: 600, textDecoration: 'underline' }}
                          onClick={async () => { const r = await admin.invite(p.id, a!.role, me.id); refresh(); setBanner({ text: `Invitation resent to ${p.email}. The earlier link no longer works.`, icon: 'paper-plane', link: r.devLink }); }}>Resend</button>
                        <button type="button" className="link-btn" style={{ font: 'var(--ib-text-body-small)', fontWeight: 600, textDecoration: 'underline' }}
                          onClick={() => void act(() => admin.revokeInvite(p.id), { text: `Invitation to ${p.name} revoked. They stay on the list as an assignable name with no login.`, icon: 'ban' })}>Revoke</button>
                      </span>
                    )}
                    {v.state === 'none' && (
                      <button type="button" className="link-btn" style={{ display: 'block', marginTop: 4, font: 'var(--ib-text-body-small)', fontWeight: 600, textDecoration: 'underline' }} onClick={() => setDialog({ kind: 'invite', person: p })}>Invite to sign in</button>
                    )}
                  </td>
                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                    <span style={statusChip(p.active)}><Icon fa={p.active ? 'circle-check' : 'circle-minus'} size={9} />{p.active ? 'Active' : 'Inactive'}</span>
                    {!p.active && p.deactivatedAt && <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>since {dateLabel(p.deactivatedAt)}</span>}
                  </td>
                  {[[L.secs.length, false], [L.open.length, false], [L.overdue, true]].map(([count, late], i) => (
                    <td key={i} style={{ padding: '8px 16px', textAlign: 'right' }}>
                      <button type="button" style={countStyle(count as number, late as boolean)} onClick={(e) => { e.stopPropagation(); team(p.id, late as boolean); }}
                        title={late ? `Open ${p.name}'s overdue items on Team` : `Open ${p.name}'s work on Team`}>{count as number}</button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && (
          <div className="empty">
            <Icon fa="user-magnifying-glass" size={40} style={{ color: 'var(--border-divider)' }} />
            <div className="empty__title" style={{ fontSize: 22 }}>Nobody matches</div>
            <div className="empty__text">{needle ? `Nobody's name, role or email contains “${q.trim()}”.` : 'Everyone on the list is inactive. Turn off Active only to see them.'}</div>
          </div>
        )}
      </div>

      {dialog?.kind === 'add' && <AddPersonDialog onClose={() => setDialog(null)} onOpen={(id) => navigate(`/people/${id}`)}
        onAdded={(id) => { setDialog(null); setQ(''); setFresh(id); refresh(); }} />}
      {dialog?.kind === 'invite' && <InviteDialog person={dialog.person} onClose={() => setDialog(null)}
        onSent={(b, id) => { setDialog(null); setBanner(b); if (!dialog.person) setFresh(id); refresh(); }} />}
    </div>
  );
}

export function Avatar({ name, px, on }: { name: string; px: number; on: boolean }) {
  return (
    <span aria-hidden="true" style={{ flex: `0 0 ${px}px`, width: px, height: px, borderRadius: '50%', background: on ? 'var(--color-neutral-surface-500)' : 'var(--border-subtle)', color: on ? 'var(--text-secondary)' : 'var(--color-neutral-gray-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto Condensed', sans-serif", fontSize: Math.round(px * 0.38) }}>
      {initials(name || '?')}
    </span>
  );
}
