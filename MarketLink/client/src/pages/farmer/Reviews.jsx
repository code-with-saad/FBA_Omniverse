import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import RatingStars from '../../components/common/RatingStars';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import { timeAgo } from '../../utils/format';
import Avatar from '../../components/common/Avatar';
import ReportButton from '../../components/reviews/ReportButton';
import VerifiedBadge from '../../components/reviews/VerifiedBadge';
import Modal from '../../components/common/Modal';
import useViewMode from '../../hooks/useViewMode';
import ViewToggle from '../../components/common/ViewToggle';
import DataGrid from '../../components/admin/DataGrid';
import { action, dateCell, display, esc } from '../../utils/cells';
import { productName, t } from '../../i18n';
import AiWriteButton from '../../components/common/AiWriteButton';
import { useAuth } from '../../context/AuthContext';
import ReplyBox, { replyContext } from '../../components/reviews/ReplyBox';

const stars = (n) => `<span class="rating" aria-label="${t('Rated {value} out of 5', { value: n })}">${[1, 2, 3, 4, 5].map((i) => `<i class="bi ${n >= i ? 'bi-star-fill' : 'bi-star'}"></i>`).join('')}</span>`;

const COLUMNS = [
  { data: 'customer.name', title: 'Customer', responsivePriority: 1, render: display((v) => `<strong class="small">${esc(v || t('Customer'))}</strong>`) },
  {
    data: 'rating',
    title: 'Rating',
    render: display((v, r) => `${stars(v)}<div class="mt-1">${r.verified ? `<span class="review-badge is-verified"><i class="bi bi-patch-check-fill"></i> ${t('Verified purchase')}</span>` : `<span class="review-badge"><i class="bi bi-question-circle"></i> ${t('Unverified')}</span>`}</div>`),
  },
  { data: 'type', title: 'About', render: display((v, r) => `<span class="chip chip-soft">${esc(v === 'product' ? productName(r.product) || t('Product') : t('Stall review'))}</span>`, (v, r) => (v === 'product' ? productName(r.product) : t('Stall'))) },
  {
    data: 'comment',
    title: 'Review and your reply',
    orderable: false,
    className: 'dt-comment',
    render: display((v, r) => `<span class="small">${esc(v || '-')}</span>${r.response?.text ? `<div class="farmer-reply mt-1 fs-7"><strong class="d-block text-success">${t('Your reply')}</strong>${esc(r.response.text)}</div>` : ''}`),
  },
  { data: 'createdAt', title: 'Date', render: display((v) => dateCell(v)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end no-export',
    responsivePriority: 2,
    render: (v, type, r) => `<div class="dt-actions">${action('reply', r.response?.text ? t('Edit reply') : t('Reply'), 'btn-soft', 'bi-reply')}${action('report', t('Report'), 'btn-white', 'bi-flag')}</div>`,
  },
];

/** Reply to a review from the table view. */
function ReplyModal({ review, onClose, onSaved }) {
  const { farmer } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState(review.response?.text || '');
  const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/farmer/reviews/${review._id}/respond`, { text });
      toast(t('Reply posted'));
      onSaved(res.review);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Reply to {name}', { name: review.customer?.name || t('the customer') })}
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" form="reply-form" className="btn btn-primary" disabled={busy}>
            {t('Post reply')}
          </button>
        </>
      }
    >
      <form id="reply-form" onSubmit={send}>
        {review.comment && <blockquote className="small text-muted-2 border-start ps-2">“{review.comment}”</blockquote>}
        <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
          <label className="form-label mb-0" htmlFor="reply-text">{t('Your reply')}</label>
          <AiWriteButton kind="review-reply" context={() => replyContext(review, farmer)} onText={setText} />
        </div>
        <textarea id="reply-text" className="form-control" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} required autoFocus placeholder={t('Write a friendly reply…')} />
      </form>
    </Modal>
  );
}

export default function FarmerReviews() {
  useDocumentTitle(t('Reviews'));
  const [filter, setFilter] = useState('all');
  const { data, loading, setData } = useFetch(`/farmer/reviews${filter === 'unanswered' ? '?unanswered=true' : ''}`);
  const [view, setView] = useViewMode('farmer-reviews');
  const [replying, setReplying] = useState(null);
  const [reporting, setReporting] = useState(null);
  const saved = (rev) => setData((d) => ({ ...d, reviews: d.reviews.map((x) => (x._id === rev._id ? { ...x, response: rev.response } : x)) }));
  if (loading && !data) return <PageLoader />;
  const reviews = data.reviews;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <>
      <DashHeader title={t('Customer reviews')} subtitle={t('See what customers say about your stall and products, and reply to them.')} actions={<ViewToggle value={view} onChange={setView} />} />
      <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
        <div className="tabs-pill">
          {[
            ['all', t('All reviews')],
            ['unanswered', t('Awaiting reply')],
          ].map(([v, l]) => (
            <button key={v} type="button" className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        {filter === 'all' && reviews.length > 0 && (
          <span className="small">
            <RatingStars value={avg} /> <strong>{avg.toFixed(2)}</strong> {t('average from {n} reviews', { n: reviews.length })}
          </span>
        )}
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon="bi-chat-heart" title={t('No reviews here')} message={t('Reviews appear after customers collect their orders.')} />
      ) : view === 'table' ? (
        <div className="table-card">
          <DataGrid
            key={filter}
            data={reviews}
            columns={COLUMNS}
            order={[[4, 'desc']]}
            exportName="MarketLink reviews"
            searchPlaceholder={t('Customer, product or text…')}
            onAction={(name, r) => {
              if (name === 'reply') setReplying(r);
              if (name === 'report') setReporting(r);
            }}
          />
        </div>
      ) : (
        <div className="d-grid gap-2">
          {reviews.map((r) => (
            <div key={r._id} className="panel">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Avatar name={r.customer?.name} src={r.customer?.avatar} className="avatar-sm" />
                <strong className="small">{r.customer?.name}</strong>
                <RatingStars value={r.rating} />
                <VerifiedBadge verified={r.verified} />
                <span className="chip chip-soft">{r.type === 'product' ? r.product?.name : t('Stall review')}</span>
                <span className="fs-7 text-muted-2 ms-auto">{timeAgo(r.createdAt)}</span>
              </div>
              {r.comment && <p className="mb-0 mt-2">{r.comment}</p>}
              {r.response?.text && (
                <div className="farmer-reply mt-2">
                  <strong className="d-block fs-7 text-success">{t('Your reply')}</strong>
                  {r.response.text}
                </div>
              )}
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <ReplyBox review={r} onSaved={saved} />
                <ReportButton targetType="review" targetId={r._id} label={t('Report review')} className="mt-2" />
              </div>
            </div>
          ))}
        </div>
      )}
      {replying && (
        <ReplyModal
          review={replying}
          onClose={() => setReplying(null)}
          onSaved={(rev) => {
            saved(rev);
            setReplying(null);
          }}
        />
      )}
      {reporting && <ReportButton key={reporting._id} targetType="review" targetId={reporting._id} startOpen onClose={() => setReporting(null)} />}
    </>
  );
}
