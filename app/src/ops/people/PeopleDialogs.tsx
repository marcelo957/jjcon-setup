import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { IS_MOCK_AUTH } from '../../auth/service';
import type { Role } from '../../auth/types';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { personName } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import { deactItems, doneRowsOf, personHistory } from '../data/people';
import { plural, toIsoDay } from '../data/tasks';
import type { Person } from '../data/types';
import { Modal } from '../ui/bits';
import { findDup, PersonPicker } from '../ui/PersonPicker';
import { ROLE_DESC, ROLE_LABEL } from './access';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A banner for the People screens. In demo mode it carries the link a real backend would email. */
export interface Banner { text: string; icon: string; link?: string }

export function AddPersonDialog({ onClose, onAdded, onOpen }: { onClose: () => void; onAdded: (id: string) => void; onOpen: (id: string) => void }) {
  const data = useOps();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);
  const dup = name.trim() ? findDup(name, data.people) : null;
  const emailTaken = email.trim() && data.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  const emailBad = email.trim() && !EMAIL.test(email.trim());
  const blocked = !name.trim() || !!emailTaken || !!emailBad;
  const add = () => { if (!blocked) onAdded(opsStore().createPerson({ name, role, email, active })); };
  return (
    <Modal title="Add person" icon="user-plus" iconColor="var(--brand-primary)" onClose={onClose} width={520}
      footer={<><Button ghost onClick={onClose}>Cancel</Button><Button icon="user-plus" disabled={blocked} onClick={add}>Add person</Button></>}>
      <form className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label><span className="field-label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name or nickname" /></label>
        {dup && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: -6, padding: '10px 12px', borderRadius: 8, background: 'var(--feedback-warning-background)', fontSize: 13, lineHeight: '19px' }}>
            <Icon fa="triangle-exclamation" size={14} style={{ color: 'var(--feedback-warning-accent)', marginTop: 3 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {dup.name}{dup.role ? ` (${dup.role})` : ''} is already on the list{dup.active ? '' : ', inactive'}. If it is the same person, use that record instead.{' '}
              <button type="button" className="link-btn" style={{ fontSize: 13, fontWeight: 600, textDecoration: 'underline' }} onClick={() => onOpen(dup.id)}>Open {dup.name}</button>
            </span>
          </div>
        )}
        <label><span className="field-label">Role or job title</span><input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Optional" /></label>
        <label><span className="field-label">Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" aria-invalid={!!(emailTaken || emailBad) || undefined} />
          {emailTaken && <span className="field-hint" style={{ color: 'var(--feedback-danger-text)' }}>{emailTaken.name} already uses this email.</span>}
          {emailBad && !emailTaken && <span className="field-hint" style={{ color: 'var(--feedback-danger-text)' }}>Enter a full email address, like name@ibjjf.com.</span>}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span>Active <span className="muted">· shows up in assignment lists</span></span>
        </label>
        <div className="muted" style={{ fontSize: 12, lineHeight: '18px' }}>This is an assignment list, not an HR record. Leave out anything you don't have and fill it in later.</div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/**
 * Invite someone to sign in. A new person is added to the People list straight away, so they
 * can be assigned work before they accept. An existing person keeps every assignment.
 */
export function InviteDialog({ person, onClose, onSent }: { person?: Person; onClose: () => void; onSent: (b: Banner, id: string) => void }) {
  const data = useOps();
  const { session, service } = useAuth();
  const [name, setName] = useState(person?.name ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [role, setRole] = useState<Role>('crew');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const e = email.trim();
  const dup = e && data.people.find((p) => p.id !== person?.id && p.email.toLowerCase() === e.toLowerCase());
  const err = dup ? `${dup.name} already uses this email. Open their record and invite them from there.` : e && !EMAIL.test(e) ? 'Enter a full email address, like name@ibjjf.com.' : '';
  const blocked = !name.trim() || !e || !!err || busy;
  const send = async () => {
    if (blocked) return;
    setBusy(true);
    let id = person?.id;
    if (id) { if (person!.email !== e) opsStore().updatePerson(id, { email: e }); }
    else id = opsStore().createPerson({ name, role: '', email: e, active: true });
    try {
      const { devLink } = await service.access.invite(id, role, session!.personId);
      onSent({ text: `Invitation sent to ${e}. ${name.trim()} is assignable now and can sign in once they accept.`, icon: 'paper-plane', link: IS_MOCK_AUTH ? devLink : undefined }, id);
    } catch (x) {
      setFailed(x instanceof Error ? x.message : 'The invitation could not be sent. Try again.');
      setBusy(false);
    }
  };
  return (
    <Modal title={person ? `Invite ${person.name} to sign in` : 'Invite someone'} icon="envelope" iconColor="var(--brand-primary)" onClose={onClose}
      footer={<><Button ghost onClick={onClose}>Cancel</Button><Button icon="paper-plane" disabled={blocked} busy={busy} onClick={send}>Send invitation</Button></>}>
      <form className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(ev) => { ev.preventDefault(); void send(); }}>
        <div style={{ color: 'var(--text-secondary)' }}>
          {person ? `${person.name} is already on the People list. Inviting gives them a login and keeps every assignment they hold.` : 'Inviting adds them to the People list straight away, so you can assign them work before they accept.'}
        </div>
        <label><span className="field-label">Name</span><input className="input" value={name} readOnly={!!person} onChange={(ev) => setName(ev.target.value)} placeholder="Full name or nickname"
          style={person ? { background: 'var(--background-disabled)', color: 'var(--text-secondary)' } : undefined} /></label>
        <label><span className="field-label">Email</span><input className="input" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="name@ibjjf.com" aria-invalid={!!err || undefined} /></label>
        {(err || failed) && (
          <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: -6, font: 'var(--ib-text-body-small)', color: 'var(--feedback-danger-text)' }}>
            <Icon fa="circle-exclamation" size={13} style={{ marginTop: 3 }} /><span>{err || failed}</span>
          </div>
        )}
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="field-label" style={{ padding: 0 }}>App role</legend>
          {(['admin', 'editor', 'crew'] as Role[]).map((r) => (
            <label key={r} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: role === r ? '2px solid var(--brand-primary)' : '1px solid var(--border-divider)', background: role === r ? 'var(--feedback-info-background)' : 'var(--color-neutral-white)' }}>
              <input type="radio" name="invite-role" checked={role === r} onChange={() => setRole(r)} style={{ width: 18, height: 18, margin: '2px 0 0' }} />
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', font: 'var(--ib-text-subtitle-2)' }}>{ROLE_LABEL[r]}</span><span style={{ display: 'block', font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)' }}>{ROLE_DESC[r]}</span></span>
            </label>
          ))}
        </fieldset>
        <div style={{ font: 'var(--ib-text-body-small)', color: 'var(--text-secondary)' }}>They get an email with a link that works for 7 days. They are on the People list and assignable from now on, even before they accept.</div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Deactivating never orphans work: everything open must get a new owner first. */
export function DeactivateDialog({ person, onClose, onDone }: { person: Person; onClose: () => void; onDone: () => void }) {
  const data = useOps();
  const { session, service } = useAuth();
  const today = toIsoDay(new Date());
  const items = deactItems(data, person.id, today);
  const [mode, setMode] = useState<'bulk' | 'items'>('bulk');
  const [target, setTarget] = useState('');
  const [map, setMap] = useState<Record<string, string>>({});
  const to = (k: string) => (mode === 'bulk' ? target : map[k]) || '';
  const left = items.filter((i) => !to(i.key)).length;
  const secs = items.filter((i) => i.kind === 'sector');
  const tasks = items.filter((i) => i.kind === 'task');
  const parts = [new Set(secs.map((i) => i.sectorId)).size ? plural(new Set(secs.map((i) => i.sectorId)).size, 'sector') : '', tasks.length ? plural(tasks.length, 'open item') : ''].filter(Boolean);
  const addPerson = (n: string) => opsStore().addPerson(n);
  const confirm = async () => {
    if (left) return;
    opsStore().deactivatePerson(person.id, session!.personId, {
      sectors: secs.map((i) => ({ sectorId: i.sectorId!, field: i.field!, to: to(i.key) })),
      tasks: tasks.map((i) => ({ key: i.taskKey!, to: to(i.key) }))
    }, doneRowsOf(data, person.id, today));
    await service.access.revokeInvite(person.id);
    onDone();
  };
  const row = (i: typeof items[number]) => (
    <div key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ flex: '1 1 240px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14 }}>{i.title}</span>
        <span style={{ display: 'block', fontSize: 12, color: i.late ? 'var(--feedback-danger-text)' : 'var(--color-neutral-gray-300)' }}>{i.sub}</span>
      </span>
      {mode === 'bulk' ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', color: target ? 'var(--text-primary)' : 'var(--feedback-warning-accent)', fontWeight: target ? 400 : 600 }}>
          <Icon fa="arrow-right" size={10} />{target ? personName(data.people, target) : 'Needs a new owner'}
        </span>
      ) : (
        <div style={{ width: 200 }}>
          <PersonPicker label={`New owner for ${i.title}`} people={data.people} value={map[i.key] ?? ''} exclude={person.id} allowUnassigned={false} unLabel="Needs a new owner"
            onPick={(id) => setMap((m) => ({ ...m, [i.key]: id }))} onAdd={(n) => setMap((m) => ({ ...m, [i.key]: addPerson(n) }))} />
        </div>
      )}
    </div>
  );
  const segTab = (on: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px', border: 0, background: on ? 'var(--brand-primary)' : 'var(--color-neutral-white)', color: on ? 'var(--color-neutral-white)' : 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer' });
  return (
    <Modal title={`Deactivate ${person.name}`} icon="user-slash" iconColor="var(--text-secondary)" onClose={onClose} width={760}
      footer={<><Button ghost onClick={onClose}>Cancel</Button><Button icon="user-slash" disabled={left > 0} onClick={() => void confirm()}>{items.length ? 'Reassign and deactivate' : 'Deactivate'}</Button></>}>
      <div className="modal__body">
        {!items.length ? (
          <>{person.name} owns nothing open. Deactivating takes them out of every assignment list and removes their login. Their record and history stay, so past task activity and printed packets still show their name.</>
        ) : (
          <>
            {person.name} still owns {parts.join(' and ')}. Give all of it a new owner before deactivating, so nothing is left without one.
            <div role="group" aria-label="How to reassign" style={{ display: 'flex', width: 'fit-content', marginTop: 14, border: '1px solid var(--border-divider)', borderRadius: 8, overflow: 'hidden' }}>
              <button type="button" aria-pressed={mode === 'bulk'} style={{ ...segTab(mode === 'bulk'), borderRight: '1px solid var(--border-divider)' }} onClick={() => setMode('bulk')}><Icon fa="people-arrows" size={11} />Move everything to one person</button>
              <button type="button" aria-pressed={mode === 'items'} style={segTab(mode === 'items')} onClick={() => {
                if (target) setMap((m) => Object.fromEntries(items.map((i) => [i.key, m[i.key] || target])));
                setMode('items');
              }}><Icon fa="list" size={11} />Reassign item by item</button>
            </div>
            {mode === 'bulk' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
                <span>Move all {items.length} to</span>
                <div style={{ width: 260 }}>
                  <PersonPicker label="Move everything to" people={data.people} size="md" value={target} exclude={person.id} allowUnassigned={false} unLabel="Choose a person"
                    onPick={setTarget} onAdd={(n) => setTarget(addPerson(n))} />
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, border: '1px solid var(--border-divider)', borderRadius: 8, maxHeight: 340, overflowY: 'auto' }}>
              {secs.length > 0 && <div className="overline" style={{ padding: '8px 14px 6px', background: 'var(--color-neutral-surface-50)', borderBottom: '1px solid var(--border-subtle)' }}>Sectors · {secs.length}</div>}
              {secs.map(row)}
              {tasks.length > 0 && <div className="overline" style={{ padding: '8px 14px 6px', background: 'var(--color-neutral-surface-50)', borderBottom: '1px solid var(--border-subtle)' }}>Open items · {tasks.length}</div>}
              {tasks.map(row)}
            </div>
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: left ? 'var(--feedback-warning-accent)' : 'var(--feedback-success-text)' }}>
              <Icon fa={left ? 'circle-exclamation' : 'circle-check'} size={12} />
              <span>{left ? `${left} of ${items.length} still need a new owner` : `All ${items.length} have a new owner`}</span>
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Completed items stay attributed to {person.name}.</div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Delete only for someone never assigned anything; otherwise explain and point to Deactivate. */
export function PersonDeleteDialog({ person, onClose, onDeleted, onDeactivate }: { person: Person; onClose: () => void; onDeleted: () => void; onDeactivate: () => void }) {
  const data = useOps();
  const { service } = useAuth();
  const history = personHistory(data, person.id, toIsoDay(new Date()));
  const can = history.length === 0;
  return (
    <Modal title={can ? `Delete ${person.name}?` : `${person.name} can't be deleted`} icon={can ? 'trash' : 'circle-info'} iconColor={can ? 'var(--feedback-danger-text)' : 'var(--brand-primary)'} onClose={onClose} width={540}
      footer={<>
        <Button ghost onClick={onClose}>{can ? 'Cancel' : 'Close'}</Button>
        {can && <Button variant="danger" icon="trash" onClick={async () => { await service.access.revokeInvite(person.id); onDeleted(); opsStore().deletePerson(person.id); }}>Delete person</Button>}
        {!can && person.active && <Button icon="user-slash" onClick={onDeactivate}>Deactivate instead</Button>}
      </>}>
      <div className="modal__body">
        {can ? <>{person.name} has never been assigned anything, so nothing else in the app changes. The record is removed permanently.</> : (
          <>
            Delete is only offered for someone who has never been assigned anything. {person.name} has:
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: '21px' }}>{history.map((h) => <li key={h}>{h[0].toUpperCase() + h.slice(1)}</li>)}</ul>
            <div className="callout" style={{ borderLeftColor: 'var(--brand-primary)', color: 'var(--text-primary)' }}>
              <Icon fa="user-slash" size={14} style={{ color: 'var(--brand-primary)', marginTop: 3 }} />
              <span>{person.active
                ? `Deleting would leave that history pointing at nobody. Deactivate instead: ${person.name} leaves every assignment list and the history stays readable.`
                : `${person.name} is already inactive, which removes them from every assignment list. That is as far as removal goes for someone with history.`}</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
