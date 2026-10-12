import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Role } from '../../auth/types';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { LoginChip } from '../../components/LoginChip';
import { useMe } from '../access';
import { personHistory, personLoad } from '../data/people';
import { dateLabel, personName } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import { dueNote, plural, shortDue, taskRows, toIsoDay } from '../data/tasks';
import type { Person } from '../data/types';
import { findDup } from '../ui/PersonPicker';
import { accessOf, ROLE_DESC, ROLE_LABEL, useAccessList } from './access';
import { Avatar, BannerBar, statusChip } from './PeoplePage';
import { DeactivateDialog, InviteDialog, PersonDeleteDialog, type Banner } from './PeopleDialogs';

const OPEN_LIMIT = 6;

/** Name of someone just deleted here, so the redirect away from their gone record carries the banner. */
let justDeleted: { id: string; name: string } | null = null;

export function PersonPage() {
  const { id } = useParams();
  const data = useOps();
  const p = data.people.find((x) => x.id === id);
  if (!p) {
    const gone = justDeleted?.id === id ? justDeleted : null;
    return <Navigate to="/people" replace state={gone ? { banner: { text: `${gone.name} was deleted.`, icon: 'trash' } } : undefined} />;
  }
  return <PersonRecord key={p.id} p={p} />;
}

function PersonRecord({ p }: { p: Person }) {
  const data = useOps();
  const me = useMe();
  const navigate = useNavigate();
  const { list: access, refresh, admin } = useAccessList();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dialog, setDialog] = useState<'deact' | 'delete' | 'invite' | null>(null);
  const [nameDraft, setNameDraft] = useState(p.name);
  const today = toIsoDay(new Date());
  const L = personLoad(data, p.id, today);
  const history = personHistory(data, p.id, today);
  const a = access?.find((x) => x.personId === p.id);
  const v = accessOf(p, a);
  const self = p.id === me.id;
  const dup = nameDraft.trim() ? findDup(nameDraft, data.people.filter((x) => x.id !== p.id)) : null;
  const secsAll = data.sectors.filter((s) => s.leadId === p.id || s.ownerId === p.id).length;
  const rowsFor = taskRows(data, today).filter((r) => r.who === p.id).length;
  const team = (late = false) => navigate(`/team?person=${p.id}${late ? '&overdue=1' : ''}&from=people`);
  const act = async (fn: () => Promise<unknown>, b: Banner) => { await fn(); refresh(); setBanner(b); };

  const stat = (n: number, label: string, late = false) => (
    <button type="button" onClick={() => team(late)} title={late ? 'Open their overdue items on Team' : 'Open their work on Team'} className="stat-btn">
      <span className="mono" style={{ fontSize: 24, lineHeight: '28px', fontWeight: late && n ? 600 : 400, color: !n ? 'var(--color-neutral-gray-300)' : late ? 'var(--feedback-danger-text)' : 'var(--text-primary)' }}>{n}</span>
      <span className="overline">{label}</span>
    </button>
  );

  return (
    <div>
      <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 6, marginTop: 20 }}>
        <Link to="/people">People</Link><Icon fa="chevron-right" size={9} /><span>{p.name || 'Unnamed person'}</span>
      </div>
      <header className="page-head" style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <Avatar name={p.name} px={56} on={p.active} />
          <div style={{ minWidth: 0 }}>
            <h1 className="page-head__title" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {p.name || 'Unnamed person'}
              <span style={statusChip(p.active)}><Icon fa={p.active ? 'circle-check' : 'circle-minus'} size={9} />{p.active ? 'Active' : 'Inactive'}</span>
            </h1>
            <div className="page-head__lead">{p.role || 'Role not set'}</div>
          </div>
        </div>
        <div className="page-head__actions">
          {p.active && !self && <Button variant="neutral" outlined icon="user-slash" onClick={() => setDialog('deact')}>Deactivate</Button>}
          {!p.active && <Button icon="user-check" onClick={() => { opsStore().reactivatePerson(p.id); refresh(); setBanner({ text: `${p.name} is active again and back in every assignment list.${a?.login === 'active' ? ' They sign in with their old password and their earlier role.' : ''}`, icon: 'user-check' }); }}>Reactivate</Button>}
          {!self && <Button variant="danger" ghost icon="trash" onClick={() => setDialog('delete')}>Delete</Button>}
        </div>
      </header>

      {banner && <BannerBar banner={banner} onClose={() => setBanner(null)} />}
      {!p.active && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', marginBottom: 16, border: '1px solid var(--border-divider)', borderRadius: 8, background: 'var(--color-neutral-surface-50)', fontSize: 14, lineHeight: '21px' }}>
          <Icon fa="user-slash" size={14} style={{ color: 'var(--color-neutral-gray-300)', marginTop: 3 }} />
          <span style={{ textWrap: 'pretty' }}>
            Inactive since {p.deactivatedAt ? dateLabel(p.deactivatedAt) : 'an earlier edition'}{p.deactivatedBy ? `, deactivated by ${personName(data.people, p.deactivatedBy)}` : ''}. Hidden from every assignment list. Their past activity stays attributed to them, and packets already printed keep their name.
          </span>
        </div>
      )}

      <section aria-label="Login and role" className="card" style={{ maxWidth: 1200, marginBottom: 16, padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <span className="overline overline--secondary">Login</span>
          {access ? <LoginChip state={v.state} /> : <span className="muted">Loading…</span>}
          <span style={{ font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)', textWrap: 'pretty' }}>{v.sub}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="overline overline--secondary">App role</span>
          {v.hasRole && a && !self ? (
            <select aria-label="App role" value={a.role} style={{ width: 180, minHeight: 36, padding: '0 10px', border: '1px solid var(--border-divider)', borderRadius: 8, background: 'var(--color-neutral-white)', font: 'var(--ib-text-body-default)', cursor: 'pointer' }}
              onChange={(e) => { const r = e.target.value as Role; void act(() => admin.setRole(p.id, r), { text: `${p.name} is now ${ROLE_LABEL[r]}. The change applies the next time they open a page.`, icon: 'user-pen' }); }}>
              <option value="admin">Admin</option><option value="editor">Editor</option><option value="crew">Crew</option>
            </select>
          ) : <span style={{ font: 'var(--ib-text-subtitle-2)' }}>{v.hasRole && a ? ROLE_LABEL[a.role] : '—'}</span>}
          <span style={{ font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)', textWrap: 'pretty' }}>{v.hasRole && a ? ROLE_DESC[a.role] : 'No role until they are invited.'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <span className="overline overline--secondary">Access actions</span>
          {v.state === 'none' && <Button size="small" icon="envelope" onClick={() => setDialog('invite')}>Invite to sign in</Button>}
          {v.state === 'invited' && (
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="small" variant="neutral" outlined icon="paper-plane" onClick={async () => { const r = await admin.invite(p.id, a!.role, me.id); refresh(); setBanner({ text: `Invitation resent to ${p.email}. The earlier link no longer works.`, icon: 'paper-plane', link: r.devLink }); }}>Resend invitation</Button>
              <Button size="small" ghost icon="ban" onClick={() => void act(() => admin.revokeInvite(p.id), { text: `Invitation to ${p.name} revoked. They stay on the list as an assignable name with no login.`, icon: 'ban' })}>Revoke</Button>
            </span>
          )}
          {v.state === 'active' && <Button size="small" variant="neutral" outlined icon="sign-out-alt" onClick={() => void act(() => admin.signOutEverywhere(p.id), { text: `${p.name} is signed out on every device. They sign in again with their password.`, icon: 'sign-out-alt' })}>Sign out of all devices</Button>}
          <span style={{ font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)', textWrap: 'pretty' }}>
            {v.state === 'active' ? (self ? 'Your own role can only be changed by another admin.' : 'Use this if they signed in on a shared venue laptop.')
              : v.state === 'invited' ? 'Resending replaces the earlier link.' : v.state === 'none' ? 'Inviting keeps every assignment they already hold.' : 'Reactivate first to give them a login again.'}
          </span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 16, alignItems: 'start', maxWidth: 1200 }}>
        <section className="card card--pad" aria-labelledby="pr-details">
          <h2 id="pr-details" className="card__title" style={{ margin: '0 0 14px', fontWeight: 400 }}>Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label><span className="field-label">Name</span>
              <input className="input" value={nameDraft} aria-invalid={!nameDraft.trim() || undefined}
                onChange={(e) => { setNameDraft(e.target.value); if (e.target.value.trim()) opsStore().updatePerson(p.id, { name: e.target.value.trim() }); }}
                style={!nameDraft.trim() ? { borderColor: 'var(--feedback-danger-text)' } : undefined} />
              {!nameDraft.trim() && <span className="field-hint" style={{ color: 'var(--feedback-danger-text)' }}>A name is needed. It is how this person shows up in every list.</span>}
              {dup && <span className="field-hint" style={{ color: 'var(--text-primary)' }}><Icon fa="triangle-exclamation" size={11} style={{ color: 'var(--feedback-warning-accent)' }} /> {dup.name} is already on the list. Make sure these are two different people.</span>}
            </label>
            <label><span className="field-label">Role or job title</span>
              <input className="input" value={p.role} placeholder="e.g. Crew coordinator" onChange={(e) => opsStore().updatePerson(p.id, { role: e.target.value })} /></label>
            <EmailField p={p} people={data.people} loginActive={v.state === 'active' || v.state === 'invited'} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--color-neutral-surface-100)', fontSize: 13, lineHeight: '19px', color: 'var(--text-secondary)' }}>
              <Icon fa="link" size={12} style={{ marginTop: 3, color: 'var(--color-neutral-gray-300)' }} />
              <span style={{ textWrap: 'pretty' }}>{secsAll || rowsFor
                ? `Named on ${plural(secsAll, 'sector')} and ${plural(rowsFor, 'task row')}, and in those sectors' print packets. It is one record, so a change to the name shows everywhere at once.`
                : 'Not named anywhere yet. Once assigned, a change to the name shows everywhere at once.'}</span>
            </div>
            {p.addedInlineAt && <div className="muted" style={{ fontSize: 12 }}><Icon fa="circle-info" size={11} /> Added from an assignment field on {dateLabel(p.addedInlineAt)}. Role and email were left for later.</div>}
          </div>
        </section>

        <section className="card card--pad" aria-labelledby="pr-work">
          <h2 id="pr-work" className="card__title" style={{ margin: '0 0 12px', fontWeight: 400 }}>Current work</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            {stat(L.secs.length, 'Sectors led')}{stat(L.open.length, 'Open items')}{stat(L.overdue, 'Overdue', true)}
          </div>
          {L.secs.length || L.open.length ? (
            <>
              {L.secs.length > 0 && (
                <>
                  <div className="overline" style={{ marginBottom: 4 }}>Sectors</div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
                    {L.secs.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <Link to={`/sectors/${s.id}`} style={{ flex: 1, minWidth: 0, fontFamily: "'Roboto Condensed', sans-serif", fontSize: 16, color: 'var(--text-primary)' }}>{s.name}</Link>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{[s.leadId === p.id ? 'Lead' : '', s.ownerId === p.id ? 'Prep owner' : ''].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {L.open.length > 0 && (
                <>
                  <div className="overline" style={{ marginBottom: 4 }}>Open items</div>
                  {L.open.slice(0, OPEN_LIMIT).map((r) => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ flex: 1, minWidth: 0 }}><span className="overline" style={{ display: 'block' }}>{r.sector}</span><span style={{ display: 'block', fontSize: 14 }}>{r.item}</span></span>
                      <span className="mono" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{shortDue(r.due)}</span>
                      <span style={{ flex: '0 0 76px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: r.late ? 'var(--feedback-danger-text)' : 'var(--text-secondary)' }}>{r.late ? dueNote(r) : ''}</span>
                    </div>
                  ))}
                  {L.open.length > OPEN_LIMIT && <button type="button" className="link-btn" style={{ marginTop: 10, fontSize: 13 }} onClick={() => team()}>See all {L.open.length} on Team</button>}
                </>
              )}
            </>
          ) : (
            <div style={{ padding: '24px 16px', border: '1px dashed var(--border-divider)', borderRadius: 8, textAlign: 'center', background: 'var(--color-neutral-surface-50)' }}>
              <Icon fa={history.length ? 'mug-hot' : 'user-plus'} size={30} style={{ color: 'var(--border-divider)' }} />
              <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 19, marginTop: 8 }}>Nothing assigned</div>
              <div style={{ fontSize: 14, lineHeight: '21px', color: 'var(--text-secondary)', margin: '4px auto 0', maxWidth: 420, textWrap: 'pretty' }}>
                {history.length
                  ? `No open sectors or items right now.${p.active ? ' They still appear in every assignment list.' : ''} Their history keeps this record from being deleted.`
                  : `${p.name || 'This person'} has never been assigned anything, so this record can still be deleted.`}
              </div>
              {!history.length && !self && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><Button size="small" variant="danger" icon="trash" onClick={() => setDialog('delete')}>Delete person</Button></div>}
            </div>
          )}
        </section>
      </div>

      {dialog === 'deact' && <DeactivateDialog person={p} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); setBanner({ text: `${p.name} is deactivated. Their open work has new owners and their login is removed.`, icon: 'user-slash' }); }} />}
      {dialog === 'delete' && <PersonDeleteDialog person={p} onClose={() => setDialog(null)} onDeactivate={() => setDialog('deact')}
        onDeleted={() => { justDeleted = { id: p.id, name: p.name }; }} />}
      {dialog === 'invite' && <InviteDialog person={p} onClose={() => setDialog(null)} onSent={(b) => { setDialog(null); setBanner(b); refresh(); }} />}
    </div>
  );
}

/** Email edits apply when valid and not taken. For someone with a login it is also their sign-in email. */
function EmailField({ p, people, loginActive }: { p: Person; people: Person[]; loginActive: boolean }) {
  const [draft, setDraft] = useState(p.email);
  const e = draft.trim();
  const taken = e && people.find((x) => x.id !== p.id && x.email.toLowerCase() === e.toLowerCase());
  const bad = e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const blankWithLogin = !e && loginActive;
  return (
    <label><span className="field-label">Email</span>
      <input className="input" type="email" value={draft} placeholder="name@ibjjf.com" aria-invalid={!!(taken || bad || blankWithLogin) || undefined}
        onChange={(ev) => {
          setDraft(ev.target.value);
          const v = ev.target.value.trim();
          const ok = (!v && !loginActive) || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !people.some((x) => x.id !== p.id && x.email.toLowerCase() === v.toLowerCase()));
          if (ok) opsStore().updatePerson(p.id, { email: v });
        }} />
      {taken && <span className="field-hint" style={{ color: 'var(--feedback-danger-text)' }}>{taken.name} already uses this email. Not saved.</span>}
      {bad && !taken && <span className="field-hint" style={{ color: 'var(--feedback-danger-text)' }}>Enter a full email address, like name@ibjjf.com. Not saved.</span>}
      {blankWithLogin && <span className="field-hint" style={{ color: 'var(--feedback-danger-text)' }}>This is their sign-in email, so it can't be blank. Not saved.</span>}
      {loginActive && !taken && !bad && !blankWithLogin && <span className="field-hint">Also their sign-in email.</span>}
    </label>
  );
}
