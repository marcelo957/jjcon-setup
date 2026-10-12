import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HELP_DESK, LOAD_IN_DAYS, LOAD_IN_FIRST_DAY } from '../../config';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { useMe } from '../access';
import { BUILD, BUILD_ORDER, groupName, GROUPS } from '../data/meta';
import {
  fieldLists, fieldPlans, fieldProgress, fieldRefs, fieldSteps, fieldTabs, type FieldTab, type Notice
} from '../data/packet';
import { activeSectors, personName, windowLabel } from '../data/selectors';
import { opsStore, useOps } from '../data/store';
import { dayDiff, toIsoDay } from '../data/tasks';
import type { OpsData, Sector } from '../data/types';
import { BuildTag, PageHead } from '../ui/bits';
import { PhonePdf } from '../ui/PdfViewer';

/** Where load-in stands today, for the phone's header. */
export function loadInLine(today: string): string {
  const d = dayDiff(LOAD_IN_FIRST_DAY, today) + 1;
  if (d < 1) return `load-in in ${1 - d} day${1 - d === 1 ? '' : 's'}`;
  if (d > LOAD_IN_DAYS) return 'load-in finished';
  return `load-in day ${d} of ${LOAD_IN_DAYS}`;
}

/**
 * What a sector lead carries on the floor: their sectors, then one sector at a time with its
 * floorplan, material list and steps. Only released content shows; build status, never prep status.
 */
export function FieldView() {
  const { id } = useParams();
  const data = useOps();
  const navigate = useNavigate();
  const sector = id ? data.sectors.find((s) => s.id === id && !s.archived) : undefined;
  if (id && !sector) return <Navigate to="/field" replace />;

  return (
    <div>
      <div className="field-desk">
        <PageHead overline="On site · build-out" title="Field view"
          lead="What a sector lead carries on the floor. One thing per screen, large targets, no tables."
          actions={<Button variant="neutral" outlined icon="arrow-left" onClick={() => navigate('/prep')}>Dashboard</Button>} />
      </div>
      <div className="field-layout">
        <div className="field-phone">
          {sector ? <FieldSector key={sector.id} s={sector} data={data} /> : <FieldIndex data={data} />}
        </div>
        <aside className="field-desk field-aside">
          <section className="card card--pad" aria-label="Build status, not prep status">
            <h2 className="card__title" style={{ margin: '0 0 8px', fontWeight: 400 }}>Build status, not prep status</h2>
            <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: '22px' }}>
              The phone only shows <strong>build status</strong>, the physical work. Prep status stays in the office, and drafts are not shown on the floor.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BUILD_ORDER.map((k) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BuildTag status={k} /><span className="muted" style={{ fontSize: 13 }}>{BUILD[k].note}</span>
                </span>
              ))}
            </div>
          </section>
          {sector && (
            <>
              <Button variant="neutral" outlined icon="print" onClick={() => navigate(`/print?sector=${sector.id}`)}>Print packet for this sector</Button>
              <Link to={`/sectors/${sector.id}`} style={{ fontSize: 14 }}>Open the full sector page</Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

const isMine = (s: Sector, me: string) => s.leadId === me || s.ownerId === me;

function FieldIndex({ data }: { data: OpsData }) {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const all = params.get('all') === '1';
  const set = (k: string, v: string | null) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });

  const active = activeSectors(data);
  const mine = active.filter((s) => isMine(s, me.id));
  const needle = q.trim().toLowerCase();
  const visible = (all ? active : mine).filter((s) => !needle || s.name.toLowerCase().includes(needle));
  const today = toIsoDay(new Date());

  return (
    <>
      <div className="field-top">
        <h2 className="field-top__title">{all ? 'All sectors' : 'My sectors'}</h2>
        <div className="mono" style={{ fontSize: 13, opacity: 0.85 }}>{visible.length} sector{visible.length === 1 ? '' : 's'} · {loadInLine(today)}</div>
        <label className="field-search">
          <Icon fa="magnifying-glass" size={14} style={{ color: 'var(--icon-tertiary)' }} />
          <input type="search" aria-label="Search sectors" placeholder="Search sectors" value={q} onChange={(e) => set('q', e.target.value || null)} />
        </label>
        <button type="button" className={`field-toggle${all ? '' : ' field-toggle--on'}`} aria-pressed={!all} onClick={() => set('all', all ? null : '1')}>
          <Icon fa={all ? 'circle' : 'circle-check'} size={14} />My sectors only
        </button>
      </div>
      <div className="field-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {GROUPS.map((g) => {
          const list = visible.filter((s) => s.group === g.id);
          if (!list.length) return null;
          return (
            <div key={g.id}>
              <div className="overline" style={{ padding: '0 2px 8px' }}>{g.name} <span className="mono">{list.length}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {list.map((s) => <SectorCard key={s.id} s={s} data={data} />)}
              </div>
            </div>
          );
        })}
        {!visible.length && (
          <FieldNotice n={needle
            ? { title: 'No sectors match', text: 'Clear the search to see every sector.', icon: 'magnifying-glass' }
            : { title: 'No sectors of yours', text: 'You are not the lead or owner of any sector. Show all sectors to pick one.', icon: 'user' }}
            action={!all && !needle ? <button type="button" className="field-btn" onClick={() => set('all', '1')}>Show all sectors</button> : undefined} />
        )}
      </div>
    </>
  );
}

function SectorCard({ s, data }: { s: Sector; data: OpsData }) {
  const owner = personName(data.people, s.ownerId);
  const prog = fieldProgress(s, owner);
  const main = s.blocks.mainMat;
  return (
    <Link to={`/field/${s.id}`} className="field-sector" style={{ borderLeftColor: BUILD[s.build].accent }}>
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span className="field-sector__name">{s.name}</span>
        <BuildTag status={s.build} style={{ marginLeft: 'auto', flex: '0 0 auto' }} />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 14, color: 'var(--color-neutral-gray-300)', marginTop: 6 }}>
        <Icon fa="user" size={11} style={{ color: 'var(--icon-tertiary)' }} />{personName(data.people, s.leadId)}
        <span style={{ color: 'var(--border-divider)' }}>|</span>
        <span className="mono">{windowLabel(s)}</span>
      </span>
      {prog ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span className="field-bar" style={{ height: 8 }}><span style={{ width: `${Math.round(prog.done / prog.total * 100)}%`, background: prog.done === prog.total ? 'var(--feedback-success-text)' : 'var(--brand-primary)' }} /></span>
          <span className="mono" style={{ fontSize: 14, color: 'var(--text-secondary)' }} aria-label={`${prog.done} of ${prog.total} material lines confirmed`}>{prog.done}/{prog.total}</span>
        </span>
      ) : main.on && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, color: 'var(--text-primary)' }}>
          <Icon fa="triangle-exclamation" size={12} style={{ color: 'var(--feedback-warning-accent)' }} />
          Material list {main.status === 'draft' ? 'in draft' : main.status === 'none' ? 'not started' : 'is empty'} · {owner}
        </span>
      )}
    </Link>
  );
}

function FieldSector({ s, data }: { s: Sector; data: OpsData }) {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const owner = personName(data.people, s.ownerId);
  const tabs = fieldTabs(s);
  const want = params.get('tab') as FieldTab | null;
  const tab = tabs.find((t) => t.id === want)?.id ?? tabs[0]?.id;
  const setTab = (t: FieldTab) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });

  return (
    <>
      <div className="field-top" style={{ paddingBottom: 0 }}>
        <Link to="/field" className="field-back"><Icon fa="angle-left" size={14} />My sectors</Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="overline" style={{ color: '#fff', opacity: 0.8 }}>{groupName(s.group)}</div>
            <h2 className="field-top__name">{s.name}</h2>
          </div>
          <BuildTag status={s.build} style={{ background: 'var(--color-neutral-white)', color: 'var(--brand-primary)', flex: '0 0 auto' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, margin: '10px 0 12px', opacity: 0.92 }}>
          <span><Icon fa="user" size={12} style={{ opacity: 0.7 }} /> {personName(data.people, s.leadId)}</span>
          <span className="mono"><Icon fa="clock" size={12} style={{ opacity: 0.7 }} /> {windowLabel(s)}</span>
        </div>
        {tabs.length > 0 && (
          <div role="tablist" aria-label={s.name} style={{ display: 'flex', gap: 2 }}>
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} className="field-tab" onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="field-pad" role={tab ? 'tabpanel' : undefined}>
        {!tab && <FieldNotice n={{ title: 'Nothing to build from yet', text: `This sector has no floorplan, list or steps. Contact ${owner}.`, icon: 'circle-info' }} />}
        {tab === 'floorplan' && <FloorplanTab s={s} owner={owner} params={params} setParams={setParams} />}
        {tab === 'materials' && <MaterialsTab s={s} owner={owner} canCheck={me.canCheckOff} />}
        {tab === 'info' && <InfoTab s={s} owner={owner} />}
        {tab === 'steps' && <StepsTab s={s} owner={owner} canCheck={me.canCheckOff} />}
      </div>
    </>
  );
}

function FloorplanTab({ s, owner, params, setParams }: { s: Sector; owner: string; params: URLSearchParams; setParams: ReturnType<typeof useSearchParams>[1] }) {
  const plans = fieldPlans(s, owner);
  if (!plans.length) return <FieldNotice n={{ title: 'No floorplan for this sector', text: 'Work from the instructions tab.', icon: 'ban' }} />;
  const pick = plans.find((p) => p.key === params.get('plan')) ?? plans[0];
  return (
    <>
      {plans.length > 1 && (
        <div role="tablist" aria-label="Floorplans" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
          {plans.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={p.key === pick.key} className="field-pill"
              onClick={() => setParams((q) => { q.set('plan', p.key); return q; }, { replace: true })}>
              <span className={`field-pill__dot${p.file ? ' field-pill__dot--on' : ''}`} />{p.short}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 16, letterSpacing: '.04em', margin: '0 2px 8px' }}>{pick.name}</div>
      {pick.file ? <PhonePdf file={pick.file} /> : <FieldNotice n={pick.notice!} warn />}
    </>
  );
}

function MaterialsTab({ s, owner, canCheck }: { s: Sector; owner: string; canCheck: boolean }) {
  const lists = fieldLists(s, owner);
  const rows = lists.flatMap((l) => l.rows ?? []);
  const done = rows.filter((r) => r.checked).length;
  return (
    <>
      {rows.length > 0 && (
        <div className="field-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="mono" style={{ fontSize: 26 }}>{done}</span>
            <span className="mono muted" style={{ fontSize: 16 }}>/ {rows.length} lines confirmed</span>
          </div>
          <div className="field-bar" style={{ height: 10, marginTop: 10 }} role="progressbar" aria-label="Lines confirmed" aria-valuenow={done} aria-valuemax={rows.length}>
            <span style={{ width: `${Math.round(done / rows.length * 100)}%`, background: 'var(--brand-primary)' }} />
          </div>
        </div>
      )}
      {lists.map((l) => (
        <div key={l.block} style={{ marginBottom: 14 }}>
          <div className="overline" style={{ padding: '0 2px 8px' }}>{l.name}</div>
          {l.rows ? (
            <div className="field-card" style={{ padding: 0, overflow: 'hidden' }}>
              {l.rows.map((r) => (
                <button key={r.id} type="button" role="checkbox" aria-checked={r.checked} disabled={!canCheck} className="field-row"
                  aria-label={`${r.item}, quantity ${r.qty}`} onClick={() => opsStore().toggleRow(s.id, l.block, r.id)}>
                  <span className={`field-box${r.checked ? ' field-box--on' : ''}`}><Icon fa="check" size={14} /></span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 16, lineHeight: '22px' }}>{r.item}</span>
                    {r.note && <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{r.note}</span>}
                  </span>
                  <span className="mono" style={{ fontSize: 18, minWidth: 34, textAlign: 'right' }}>{r.qty}</span>
                </button>
              ))}
            </div>
          ) : <FieldNotice n={l.notice!} warn />}
          {l.foot && <div className="muted" style={{ fontSize: 13, padding: '6px 2px 0' }}>{l.foot}</div>}
        </div>
      ))}
      <div className="muted" style={{ fontSize: 13, padding: '0 2px' }}>Confirm a line when the item is physically at the sector. Shortages go to the set up desk on radio channel 3.</div>
    </>
  );
}

function InfoTab({ s, owner }: { s: Sector; owner: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {fieldRefs(s, owner).map((r) => (
        <div key={r.key}>
          <div className="overline" style={{ padding: '0 2px 8px' }}>{r.name}</div>
          {r.notice && <FieldNotice n={r.notice} warn />}
          {r.info && (
            <div className="field-card" style={{ padding: 0, overflow: 'hidden' }}>
              {r.info.map((row) => (
                <div key={row.label} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="overline" style={{ display: 'block' }}>{row.label}</span>
                  <span style={{ display: 'block', fontSize: 16, lineHeight: '22px', marginTop: 2 }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
          {r.link && (
            <a href={r.link.url} target="_blank" rel="noopener noreferrer" className="field-card" style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '6px solid var(--feedback-success-text)', minHeight: 64, textDecoration: 'none' }}>
              <Icon fa="table-list" size={24} style={{ color: 'var(--feedback-success-text)' }} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: "'Roboto Condensed', sans-serif", fontSize: 19, color: 'var(--text-primary)' }}>{r.link.label}</span>
              <Icon fa="arrow-up-right-from-square" size={14} style={{ color: 'var(--color-neutral-gray-300)' }} />
            </a>
          )}
          {r.shots && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {r.shots.map((sh) => (
                <div key={sh.id} className="field-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div role="img" aria-label={`${sh.title} (no photo uploaded yet)`} style={{ height: 160, background: 'var(--color-neutral-surface-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-divider)' }}><Icon fa="image" size={36} /></div>
                  <div style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'block', fontSize: 16, lineHeight: '22px' }}>{sh.title}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 14, marginTop: 2 }}>{sh.caption}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {r.file && <PhonePdf file={r.file} />}
        </div>
      ))}
    </div>
  );
}

function StepsTab({ s, owner, canCheck }: { s: Sector; owner: string; canCheck: boolean }) {
  const groups = fieldSteps(s, owner);
  return (
    <>
      {groups.map((g) => (
        <div key={g.block} style={{ marginBottom: 14 }}>
          {groups.length > 1 && <div className="overline" style={{ padding: '0 2px 8px' }}>{g.name}</div>}
          {!g.steps ? <FieldNotice n={g.notice!} warn /> : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.steps.map((st, i) => (
                <li key={st.id}>
                  {g.checkable ? (
                    <button type="button" role="checkbox" aria-checked={st.done} disabled={!canCheck} className="field-card field-step"
                      onClick={() => opsStore().toggleStep(s.id, g.block as 'instr' | 'install', st.id)}>
                      <span className={`field-num${st.done ? ' field-num--on' : ''}`}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, color: st.done ? 'var(--color-neutral-gray-300)' : 'var(--text-primary)' }}>{st.text}</span>
                      <span className={`field-box${st.done ? ' field-box--on' : ''}`}><Icon fa="check" size={14} /></span>
                    </button>
                  ) : (
                    <div className="field-card field-step"><span className="field-num">{i + 1}</span><span style={{ flex: 1, minWidth: 0 }}>{st.text}</span></div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
      <div className="field-card" style={{ borderLeft: '6px solid var(--accent-gold)', marginTop: 14 }}>
        <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 17 }}>Need help?</div>
        <div style={{ fontSize: 15, lineHeight: '22px', color: 'var(--text-secondary)', marginTop: 4 }}>{HELP_DESK.where}</div>
        <a href={`tel:${HELP_DESK.tel}`} className="field-call"><Icon fa="phone" size={14} />Call {HELP_DESK.contact}</a>
      </div>
    </>
  );
}

function FieldNotice({ n, warn, action }: { n: Notice; warn?: boolean; action?: ReactNode }) {
  return (
    <div className="field-card" style={{ padding: '18px 16px', borderLeft: warn ? '6px solid var(--feedback-warning-accent)' : undefined }}>
      <Icon fa={n.icon} size={28} style={{ color: warn ? 'var(--feedback-warning-accent)' : 'var(--icon-tertiary)' }} />
      <div style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 20, lineHeight: '26px', marginTop: 10 }}>{n.title}</div>
      <div style={{ fontSize: 15, lineHeight: '22px', color: 'var(--text-secondary)', marginTop: 6 }}>{n.text}</div>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
