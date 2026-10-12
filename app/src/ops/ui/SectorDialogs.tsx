import { useState } from 'react';
import { Button } from '../../ds/Button';
import { Icon } from '../../ds/Icon';
import { sectorInventory } from '../data/selectors';
import { opsStore } from '../data/store';
import type { Sector } from '../data/types';
import { Modal } from './bits';

export function ArchiveDialog({ sector, by, onClose, onDone }: { sector: Sector; by: string; onClose: () => void; onDone: () => void }) {
  return (
    <Modal title={`Archive ${sector.name}?`} icon="box-archive" iconColor="var(--text-secondary)" onClose={onClose} width={520}
      footer={<>
        <Button ghost onClick={onClose}>Cancel</Button>
        <Button icon="box-archive" onClick={() => { opsStore().archive(sector.id, by); onDone(); }}>Archive sector</Button>
      </>}>
      <div className="modal__body">
        It leaves the prep dashboard, the task list and the sector index, and stops counting toward any progress bar.
        Everything it holds stays with it. You can restore it from the Archived tab.
      </div>
    </Modal>
  );
}

/** Permanent delete. A sector with content needs its name typed, and the dialog steers toward Archive. */
export function DeleteDialog({ sector, by, onClose, onDeleted, onArchived }: {
  sector: Sector; by: string; onClose: () => void; onDeleted: () => void; onArchived: () => void;
}) {
  const [typed, setTyped] = useState('');
  const inv = sectorInventory(sector);
  const empty = inv.length === 0;
  const remove = () => { opsStore().remove(sector.id); onDeleted(); };
  return (
    <Modal title={`Delete ${sector.name}?`} icon="circle-exclamation" iconColor="var(--feedback-danger-text)" onClose={onClose} width={600}
      footer={<>
        <Button ghost onClick={onClose}>Cancel</Button>
        {empty
          ? <Button variant="danger" icon="trash" onClick={remove}>Delete sector</Button>
          : <Button variant="danger" icon="trash" disabled={typed.trim() !== sector.name.trim()} onClick={remove}>Delete permanently</Button>}
      </>}>
      <div className="modal__body">
        {empty ? 'This sector holds nothing yet. Deleting it removes it permanently.' : (
          <>
            Deleting is permanent. This will be lost:
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: '24px' }}>
              {inv.map((t) => <li key={t}>{t}</li>)}
              <li>All task rows for this sector and their completion history</li>
            </ul>
            {!sector.archived && (
              <>
                <div className="callout callout--archive">
                  <Icon fa="box-archive" size={14} style={{ color: 'var(--color-brand-ibjjf-tertiary-500)', marginTop: 3 }} />
                  <span style={{ flex: 1 }}>Archive instead if this sector is only cancelled for this year. It keeps everything and can be restored.</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button size="small" variant="neutral" outlined icon="box-archive" onClick={() => { opsStore().archive(sector.id, by); onArchived(); }}>Archive instead</Button>
                </div>
              </>
            )}
            <label style={{ display: 'block', marginTop: 18 }}>
              <span className="field-label">Type {sector.name} to confirm</span>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={sector.name} style={{ borderColor: 'var(--feedback-danger-text)' }} />
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
