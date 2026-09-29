import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import AiWriteButton from '../../components/common/AiWriteButton';
import { productName, t } from '../../i18n';

export const ORDER_ACTIONS = {
  placed: [
    { action: 'accept', label: 'Accept', icon: 'bi-check-lg', cls: 'btn-primary' },
    { action: 'decline', label: 'Decline', icon: 'bi-x-lg', cls: 'btn-outline-danger' },
  ],
  accepted: [
    { action: 'ready', label: 'Mark ready for pickup', icon: 'bi-bag-check', cls: 'btn-primary' },
    { action: 'decline', label: 'Decline', icon: 'bi-x-lg', cls: 'btn-outline-danger' },
  ],
  ready: [{ action: 'complete', label: 'Mark picked up', icon: 'bi-check2-all', cls: 'btn-forest' }],
};

export const ACTION_DONE = {
  accept: 'Order accepted and the customer notified',
  decline: 'Order declined and stock released',
  ready: 'Customer notified that the order is ready',
  complete: 'Order completed',
};

/** Accept / ready / complete / decline one pre-order; returns the updated order. */
export async function runOrderAction(order, action, note) {
  const res = await api.post(`/farmer/orders/${order._id}/${action}`, { note });
  return res.order;
}

/** Asks for the reason before a pre-order is declined (the customer sees it). */
export function DeclineModal({ order, onClose, onDone }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function decline() {
    setBusy(true);
    try {
      const updated = await runOrderAction(order, 'decline', reason);
      toast(ACTION_DONE.decline);
      onDone?.(updated);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t('Decline {orderNumber}?', { orderNumber: order.orderNumber })}
      onClose={onClose}
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            {t('Back')}
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={decline}>
            {t('Decline order')}
          </button>
        </>
      }
    >
      <p className="small text-muted-2">{t('The reserved stock goes back to your inventory and the customer receives an e-mail with your reason.')}</p>
      <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
        <label className="form-label mb-0" htmlFor="decline-reason">{t('Reason (shown to the customer)')}</label>
        <AiWriteButton kind="decline-reason" context={{ items: (order.items || []).map(productName).join(', ') }} onText={(text) => setReason(text.slice(0, 300))} />
      </div>
      <textarea id="decline-reason" className="form-control" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('e.g. Harvest was smaller than expected this week')} maxLength={300} />
    </Modal>
  );
}

/** Accept / decline / ready / complete buttons for a farmer's pre-order. */
export default function FarmerOrderActions({ order, onChange, compact = false }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState('');
  const [declining, setDeclining] = useState(false);
  const actions = ORDER_ACTIONS[order.status] || [];
  if (!actions.length) return null;

  async function run(action) {
    setBusy(action);
    try {
      const updated = await runOrderAction(order, action);
      toast(t(ACTION_DONE[action]));
      onChange?.(updated);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className={compact ? 'd-flex gap-2 flex-wrap' : 'panel mb-4 d-flex align-items-center gap-2 flex-wrap'}>
      {!compact && <strong className="me-auto">{t('Update this pre-order')}</strong>}
      {actions.map((a) => (
        <button
          key={a.action}
          type="button"
          className={`btn ${a.cls} ${compact ? 'btn-sm' : ''}`}
          disabled={Boolean(busy)}
          onClick={() => (a.action === 'decline' ? setDeclining(true) : run(a.action))}
        >
          {busy === a.action ? <span className="spinner-border spinner-border-sm" /> : <i className={`bi ${a.icon}`} />} {t(a.label)}
        </button>
      ))}
      {declining && (
        <DeclineModal
          order={order}
          onClose={() => setDeclining(false)}
          onDone={(updated) => {
            setDeclining(false);
            onChange?.(updated);
          }}
        />
      )}
    </div>
  );
}
