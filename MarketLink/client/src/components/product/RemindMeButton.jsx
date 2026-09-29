import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import { productName, t } from '../../i18n';

/**
 * "Remind me when available" for a sold-out product: signed-in customers are added straight away,
 * guests type their e-mail. When the farmer restocks, MarketLink sends a notification and an e-mail.
 * `initial` is whether a reminder is already set (known on the product page); there it can be removed.
 */
export default function RemindMeButton({ product, initial = false, className = 'btn btn-soft', compact = false }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reminding, setReminding] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && user.role !== 'customer') return null;

  async function save(address) {
    setBusy(true);
    try {
      const res = await api.post(`/products/${product._id}/remind`, address ? { email: address } : {});
      setReminding(true);
      setAsking(false);
      toast(res.message, 'success', { title: 'Reminder set' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.del(`/products/${product._id}/remind`);
      setReminding(false);
      toast(t('Reminder removed'), 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const label = reminding ? t('Reminder set') : compact ? t('Remind me') : t('Remind me when available');
  return (
    <>
      <button
        type="button"
        className={`${className} remind-btn ${reminding ? 'is-on' : ''}`}
        disabled={busy}
        aria-pressed={reminding}
        aria-label={label}
        onClick={() => (reminding ? user && cancel() : user ? save() : setAsking(true))}
        title={reminding && user ? t('Press to remove the reminder') : t('Get a notification and an e-mail when it is back')}
      >
        {busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className={`bi ${reminding ? 'bi-bell-fill' : 'bi-bell'}`} aria-hidden="true" />}
        <span className="remind-label">{label}</span>
      </button>
      {asking && (
        <Modal
          open
          onClose={() => setAsking(false)}
          title={t('Remind me when available')}
          footer={
            <>
              <button type="button" data-modal-cancel className="btn btn-white" onClick={() => setAsking(false)}>
                {t('Cancel')}
              </button>
              <button type="submit" form="remind-form" className="btn btn-primary" disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm" aria-hidden="true" />} {t('Remind me')}
              </button>
            </>
          }
        >
          <form
            id="remind-form"
            onSubmit={(e) => {
              e.preventDefault();
              save(email);
            }}
          >
            <p className="small text-muted-2">{t('{name} is sold out. We will e-mail you as soon as the farmer has it again.', { name: productName(product) })}</p>
            <label className="form-label" htmlFor="remind-email">
              {t('Your e-mail address')}
            </label>
            <input id="remind-email" type="email" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} />
          </form>
        </Modal>
      )}
    </>
  );
}
