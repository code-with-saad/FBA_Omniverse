import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import AiWriteButton from '../common/AiWriteButton';
import { t } from '../../i18n';

const REASONS = [
  ['misleading', 'Misleading or false'],
  ['wrong_info', 'Wrong product information'],
  ['offensive', 'Offensive or abusive'],
  ['spam', 'Spam or advertising'],
  ['other', 'Something else'],
];

/** "Report" link for a review, a product listing or a stall: sends it to the admin moderation queue. */
export default function ReportButton({ targetType, targetId, label = t('Report'), className = '', startOpen = false, onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpenState] = useState(startOpen);
  // `startOpen` + `onClose`: opened from a table action, with no button of its own
  const setOpen = (value) => {
    setOpenState(value);
    if (!value) onClose?.();
  };
  const [reason, setReason] = useState('misleading');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function start() {
    if (!user) return navigate('/login');
    setOpen(true);
    return undefined;
  }

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/flags', { targetType, targetId, reason, note });
      toast(res.message);
      setOpen(false);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!startOpen && (
        <button type="button" className={`btn-report ${className}`} onClick={start}>
          <i className="bi bi-flag" aria-hidden="true" /> {label}
        </button>
      )}
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={targetType === 'farmer' ? t('Report this stall') : targetType === 'product' ? t('Report this listing') : t('Report this review')}
          footer={
            <>
              <button type="button" data-modal-cancel className="btn btn-white" onClick={() => setOpen(false)}>
                {t('Cancel')}
              </button>
              <button type="submit" form="report-form" className="btn btn-danger" disabled={busy}>
                {t('Send report')}
              </button>
            </>
          }
        >
          <form id="report-form" onSubmit={send} className="d-grid gap-3">
            <div className="d-grid gap-1" role="radiogroup" aria-label={t('Reason')}>
              {REASONS.map(([v, l]) => (
                <label key={v} className="form-check">
                  <input type="radio" className="form-check-input" name="report-reason" checked={reason === v} onChange={() => setReason(v)} /> <span className="form-check-label small">{t(l)}</span>
                </label>
              ))}
            </div>
            <div>
              <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
                <label className="form-label mb-0" htmlFor="report-note">{t('Details (optional)')}</label>
                <AiWriteButton kind="report-note" context={() => ({ reason: t(REASONS.find(([v]) => v === reason)?.[1] || ''), targetType })} onText={(text) => setNote(text.slice(0, 500))} />
              </div>
              <textarea id="report-note" className="form-control" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="fs-7 text-muted-2 mb-0">{t('The MarketLink team checks every report. The person you report is not told who sent it.')}</p>
          </form>
        </Modal>
      )}
    </>
  );
}
