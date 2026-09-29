import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import AiWriteButton from '../common/AiWriteButton';
import { productName, t } from '../../i18n';

// What "Generate with AI" needs to write a reply to a review
export const replyContext = (review, farmer) => ({
  rating: review.rating,
  comment: review.comment,
  customerName: review.customer?.name,
  stallName: farmer?.stallName,
  about: review.type === 'product' ? productName(review.product) : '',
});

/** "Reply" / "Edit reply" under a review for the stall's own farmer (the Reviews page and the public stall page). */
export default function ReplyBox({ review, onSaved }) {
  const { toast } = useToast();
  const { farmer } = useAuth();
  const [text, setText] = useState(review.response?.text || '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/farmer/reviews/${review._id}/respond`, { text });
      toast(t('Reply posted'));
      setOpen(false);
      onSaved(res.review);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" className="btn btn-sm btn-soft mt-2" onClick={() => setOpen(true)}>
        <i className="bi bi-reply" /> {review.response?.text ? t('Edit reply') : t('Reply')}
      </button>
    );
  return (
    <form className="reply-box mt-2 flex-grow-1" onSubmit={send}>
      <textarea className="form-control form-control-sm" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Write a friendly reply…')} maxLength={1000} required aria-label={t('Reply')} autoFocus />
      <div className="d-flex gap-2 flex-wrap mt-2">
        <AiWriteButton kind="review-reply" context={() => replyContext(review, farmer)} onText={setText} />
        <button type="submit" className="btn btn-primary btn-sm ms-auto" disabled={busy}>
          {t('Post')}
        </button>
        <button type="button" className="btn btn-white btn-sm" onClick={() => setOpen(false)}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  );
}
