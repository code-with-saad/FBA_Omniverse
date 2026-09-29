import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import PickupPicker from '../order/PickupPicker';
import { formatDate, formatDateKey, time12 } from '../../utils/format';
import { t } from '../../i18n';

export const ISSUE_LABEL = {
  open: 'Not received: waiting for an answer',
  new_pickup: 'New pickup arranged',
  disputed: 'Farmer says it was collected: MarketLink will decide',
  resolved: 'Sorted out',
};

const OUTCOME_LABEL = {
  received: 'The customer received the order',
  collected_after_new_pickup: 'Collected at the new pickup',
  cancelled: 'The order was cancelled',
  farmer_right: 'The order was collected (the farmer is right)',
};

const ACTION_LABEL = {
  reported: 'Customer: not received',
  reported_again: 'Customer: not received again',
  new_pickup: 'New pickup arranged',
  collected: 'Farmer: the customer collected it',
  received: 'Customer: received it',
  resolved: 'MarketLink closed the problem',
};

const WHO = { customer: 'Customer', farmer: 'Farmer', admin: 'MarketLink team' };

/**
 * "I did not receive it" on the order page, for the customer, the farmer and the admin: what happened so far
 * and what each of them can do next (a new pickup, "it was collected", "I got it after all", close it).
 */
export default function IssuePanel({ order, role, onChange }) {
  const { toast } = useToast();
  const issue = order.issue;
  const [dialog, setDialog] = useState(null); // pickup | collected | resolve | received
  const [pickup, setPickup] = useState({ pickupDate: '', marketId: '', slotStart: '' });
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('received');
  const [busy, setBusy] = useState(false);
  if (!issue?.status) return null;

  const active = issue.status !== 'resolved';
  const close = () => {
    setDialog(null);
    setNote('');
  };

  async function send(path, body) {
    setBusy(true);
    try {
      const res = await api.post(`/orders/${order._id}/issue/${path}`, body);
      toast(res.message);
      close();
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const canNewPickup = active && ['open', 'disputed'].includes(issue.status);
  const buttons = [];
  if (canNewPickup)
    buttons.push(
      <button key="pickup" type="button" className="btn btn-primary" onClick={() => setDialog('pickup')}>
        <i className="bi bi-calendar-plus" aria-hidden="true" /> {role === 'customer' ? t('Choose a new pickup time') : t('Arrange a new pickup')}
      </button>
    );
  if (role === 'farmer' && issue.status === 'open')
    buttons.push(
      <button key="collected" type="button" className="btn btn-white" onClick={() => setDialog('collected')}>
        <i className="bi bi-person-check" aria-hidden="true" /> {t('The customer collected it')}
      </button>
    );
  if (role === 'customer' && active)
    buttons.push(
      <button key="received" type="button" className="btn btn-white" onClick={() => setDialog('received')}>
        <i className="bi bi-check2-circle" aria-hidden="true" /> {t('I received it after all')}
      </button>
    );
  if (role === 'admin' && active)
    buttons.push(
      <button key="resolve" type="button" className="btn btn-white" onClick={() => setDialog('resolve')}>
        <i className="bi bi-clipboard-check" aria-hidden="true" /> {t('Close the problem')}
      </button>
    );

  const hint = {
    customer: {
      open: t('Choose a new pickup time with the farmer, or tell us if it turned up after all.'),
      new_pickup: t('Collect your order at the new time below. You will be asked again after the pickup.'),
      disputed: t('The farmer says the order was collected. The MarketLink team will check and contact you. You can still choose a new pickup time.'),
    },
    farmer: {
      open: t('Arrange a new pickup so the customer gets the order, or tell MarketLink if the customer did collect it.'),
      new_pickup: t('Have the order ready at the new pickup time below and mark it picked up as usual.'),
      disputed: t('The MarketLink team is checking. You can still arrange a new pickup.'),
    },
    admin: {
      open: t('Check with both sides. Arrange a new pickup or close the problem with the outcome.'),
      new_pickup: t('A new pickup is arranged. It closes by itself when the customer confirms, or you can close it.'),
      disputed: t('The farmer says the customer collected it. Decide and close the problem.'),
    },
  }[role]?.[issue.status];

  return (
    <section className={`panel issue-panel mb-4 is-${issue.status}`} aria-labelledby="issue-title">
      <div className="issue-head">
        <span className="issue-icon" aria-hidden="true">
          <i className={`bi ${active ? 'bi-exclamation-octagon' : 'bi-check2-circle'}`} />
        </span>
        <div className="min-w-0 flex-grow-1">
          <h2 id="issue-title" className="issue-title">
            {t('Pickup problem')} <span className={`issue-chip is-${issue.status}`}>{t(ISSUE_LABEL[issue.status])}</span>
          </h2>
          {issue.note && <p className="issue-note">“{issue.note}”</p>}
          {!active && issue.resolution && <p className="issue-note fw-semi">{t(OUTCOME_LABEL[issue.resolution])}</p>}
          {active && hint && <p className="small text-muted-2 mb-0">{hint}</p>}
          {issue.status === 'new_pickup' && (
            <p className="issue-new-pickup">
              <i className="bi bi-calendar-check" aria-hidden="true" /> {formatDateKey(order.pickupDate, { withYear: true })}, {time12(order.pickupSlot.start)} · {order.market?.name}
            </p>
          )}
        </div>
      </div>
      {buttons.length > 0 && <div className="issue-actions">{buttons}</div>}
      {issue.history?.length > 0 && (
        <ol className="issue-history">
          {issue.history.map((h, i) => (
            <li key={i}>
              <span className="issue-dot" aria-hidden="true" />
              <div className="min-w-0">
                <strong>{t(ACTION_LABEL[h.action] || h.action)}</strong>
                <span className="small text-muted-2 d-block">
                  {t(WHO[h.by] || h.by)} · {formatDate(h.at, { time: true })}
                </span>
                {h.note && <span className="small d-block">{h.note}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={dialog === 'pickup'}
        onClose={close}
        title={t('New pickup for {n}', { n: order.orderNumber })}
        size="modal-lg"
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={close} disabled={busy}>
              {t('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !pickup.slotStart}
              onClick={() => send('new-pickup', { date: pickup.pickupDate, slotStart: pickup.slotStart, marketId: pickup.marketId, note })}
            >
              {busy && <span className="spinner-border spinner-border-sm" />} {t('Save the new pickup')}
            </button>
          </>
        }
      >
        <p className="small text-muted-2">{t('The order is ready again at the new time. The customer, the farmer and the MarketLink team are told.')}</p>
        {dialog === 'pickup' && <PickupPicker farmerId={order.farmer._id} value={pickup} onChange={setPickup} excludeOrder={order._id} />}
        <label className="form-label mt-3" htmlFor="issue-pickup-note">
          {t('Message')} <span className="text-muted-2 fw-normal">{t('(optional)')}</span>
        </label>
        <input id="issue-pickup-note" className="form-control" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. Sorry for the trouble, it will be packed with your name on it')} />
      </Modal>

      <Modal
        open={dialog === 'collected'}
        onClose={close}
        title={t('The customer collected it?')}
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={close} disabled={busy}>
              {t('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || note.trim().length < 5} onClick={() => send('collected', { note })}>
              {busy && <span className="spinner-border spinner-border-sm" />} {t('Send to MarketLink')}
            </button>
          </>
        }
      >
        <p className="small text-muted-2">{t('Tell us who collected the order and when. The MarketLink team checks with the customer and decides.')}</p>
        <label className="form-label" htmlFor="issue-collected-note">
          {t('What happened?')}
        </label>
        <textarea id="issue-collected-note" className="form-control" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. Collected by her brother at 9:15 am, he showed the order number')} />
      </Modal>

      <Modal
        open={dialog === 'received'}
        onClose={close}
        title={t('Received it after all?')}
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={close} disabled={busy}>
              {t('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send('received', { note })}>
              {busy && <span className="spinner-border spinner-border-sm" />} {t('Yes, I have it')}
            </button>
          </>
        }
      >
        <p className="small text-muted-2 mb-0">{t('The problem is closed and the farmer is told.')}</p>
      </Modal>

      <Modal
        open={dialog === 'resolve'}
        onClose={close}
        title={t('Close the problem with {n}', { n: order.orderNumber })}
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={close} disabled={busy}>
              {t('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send('resolve', { outcome, note })}>
              {busy && <span className="spinner-border spinner-border-sm" />} {t('Close the problem')}
            </button>
          </>
        }
      >
        <fieldset>
          <legend className="form-label">{t('How did it end?')}</legend>
          {['received', 'farmer_right', 'cancelled'].map((o) => (
            <div key={o} className="form-check">
              <input className="form-check-input" type="radio" name="issue-outcome" id={`outcome-${o}`} checked={outcome === o} onChange={() => setOutcome(o)} />
              <label className="form-check-label" htmlFor={`outcome-${o}`}>
                {t(OUTCOME_LABEL[o])}
              </label>
            </div>
          ))}
        </fieldset>
        <label className="form-label mt-3" htmlFor="issue-resolve-note">
          {t('Note for both sides')} <span className="text-muted-2 fw-normal">{t('(optional)')}</span>
        </label>
        <textarea id="issue-resolve-note" className="form-control" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </section>
  );
}
