import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import ReviewModal from '../reviews/ReviewModal';
import { formatDate, money } from '../../utils/format';
import { productName, t } from '../../i18n';

/**
 * "Did you receive this order?" after the farmer marks a pre-order as picked up. "Yes" goes straight on
 * to a review of the stall; "No" (with an optional note) tells the farmer and the MarketLink team.
 * `inline` shows it as a box on the order page instead of a dialog.
 */
export default function ReceiptCheck({ order, onDone, onClose, inline = false }) {
  const { toast } = useToast();
  const [step, setStep] = useState('ask'); // ask | problem | review
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  async function answer(received) {
    setBusy(received ? 'yes' : 'no');
    try {
      const res = await api.post(`/orders/${order._id}/receipt`, { received, note });
      toast(res.message, received ? 'success' : 'info');
      if (received) setStep('review');
      else onDone?.(res.order);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  if (step === 'review') {
    return (
      <ReviewModal
        target={{ type: 'farmer', orderId: order._id, orderNumber: order.orderNumber, farmerId: order.farmer?._id || order.farmer, name: order.farmer?.stallName || t('the farmer') }}
        onClose={() => onDone?.({ _id: order._id, receipt: { status: 'received' } })}
        onDone={() => onDone?.({ _id: order._id, receipt: { status: 'received' } })}
      />
    );
  }

  const items = (order.items || []).map((i) => `${i.quantity} × ${productName(i)}`).join(', ');
  const body = (
    <>
      <p className="mb-2">{t('{stall} marked pre-order {number} as picked up. Did you receive it?', { stall: order.farmer?.stallName || t('The farmer'), number: order.orderNumber })}</p>
      <div className="receipt-order">
        <span className="small text-muted-2">{order.completedAt ? formatDate(order.completedAt) : ''}</span>
        <span className="small">{items}</span>
        <strong>{money(order.totalAmount)}</strong>
      </div>
      {step === 'problem' && (
        <div className="mt-3">
          <label className="form-label" htmlFor={`receipt-note-${order._id}`}>
            {t('What went wrong?')} <span className="text-muted-2 fw-normal">{t('(optional)')}</span>
          </label>
          <textarea id={`receipt-note-${order._id}`} className="form-control" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. The stall was closed when I arrived')} />
        </div>
      )}
    </>
  );
  const buttons =
    step === 'problem' ? (
      <>
        <button type="button" className="btn btn-white" onClick={() => setStep('ask')} disabled={Boolean(busy)}>
          {t('Back')}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => answer(false)} disabled={Boolean(busy)}>
          {busy === 'no' && <span className="spinner-border spinner-border-sm" aria-hidden="true" />} {t('Send')}
        </button>
      </>
    ) : (
      <>
        <button type="button" className="btn btn-white" onClick={() => setStep('problem')} disabled={Boolean(busy)}>
          <i className="bi bi-x-circle" aria-hidden="true" /> {t('No, I did not')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => answer(true)} disabled={Boolean(busy)}>
          {busy === 'yes' ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-check2-circle" aria-hidden="true" />} {t('Yes, I received it')}
        </button>
      </>
    );

  if (inline) {
    return (
      <div className="receipt-box">
        <strong className="d-block mb-1">
          <i className="bi bi-bag-check" aria-hidden="true" /> {t('Did you receive your order?')}
        </strong>
        {body}
        <div className="d-flex gap-2 flex-wrap justify-content-end mt-3">{buttons}</div>
      </div>
    );
  }
  return (
    <Modal open onClose={onClose} title={t('Did you receive your order?')} footer={buttons} guardChanges={false}>
      {body}
      <p className="fs-7 text-muted-2 mb-0 mt-3">
        <Link to={`/account/orders/${order._id}`} onClick={onClose}>
          {t('Open the order')}
        </Link>
      </p>
    </Modal>
  );
}
