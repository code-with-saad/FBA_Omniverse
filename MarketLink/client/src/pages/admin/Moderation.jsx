import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useFetch from '../../hooks/useFetch';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import Modal from '../../components/common/Modal';
import DataGrid from '../../components/admin/DataGrid';
import AiWriteButton from '../../components/common/AiWriteButton';
import FilterBar from '../../components/admin/FilterBar';
import { action, badge, dateCell, display, esc, link, muted } from '../../utils/cells';
import { productPath } from '../../utils/links';

export const REASON_LABEL = {
  spam: 'Spam',
  offensive: 'Offensive',
  misleading: 'Misleading',
  wrong_info: 'Wrong info',
  other: 'Other',
  auto_language: 'Word filter',
};

const STATUS_TABS = [
  ['open', 'Open'],
  ['resolved', 'Resolved'],
  ['dismissed', 'Dismissed'],
  ['', 'All'],
];

const FILTERS = [
  { name: 'targetType', label: 'Content', options: [{ value: 'review', label: 'Reviews' }, { value: 'product', label: 'Product listings' }, { value: 'farmer', label: 'Farmer stalls' }] },
  { name: 'reason', label: 'Reason', options: Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const stars = (n) => `<span class="text-nowrap text-warning" title="${n} of 5">${'<i class="bi bi-star-fill"></i>'.repeat(n)}${'<i class="bi bi-star"></i>'.repeat(5 - n)}</span>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const TYPE_ICON = { review: 'bi-chat-left-quote', product: 'bi-basket', farmer: 'bi-shop-window' };

function targetCell(r) {
  const icon = `<i class="bi ${TYPE_ICON[r.targetType]}"></i>`;
  if (r.targetType === 'review') {
    const rev = r.review;
    if (!rev) return `${icon} ${muted('Review deleted')}`;
    return `<div class="mod-target"><span class="chip chip-soft">${icon} Review</span> ${stars(rev.rating)}
      <div class="small mt-1">“${esc(rev.comment || 'No comment')}”</div>
      ${muted(`by ${rev.customer?.name || 'Customer'}${r.product?.name ? ` on ${r.product.name}` : ''}${r.farmer?.stallName ? ` · ${r.farmer.stallName}` : ''}`)}
      ${rev.isRemoved ? `<div class="fs-7 text-danger mt-1"><i class="bi bi-eye-slash"></i> Hidden${rev.removedReason ? `: ${esc(rev.removedReason)}` : ''}</div>` : ''}</div>`;
  }
  if (r.targetType === 'product') {
    const p = r.product;
    if (!p) return `${icon} ${muted('Listing deleted')}`;
    return `<div class="mod-target"><span class="chip chip-soft">${icon} Listing</span> ${link(productPath(p), p.name, 'small fw-semi')}
      <div>${muted(r.farmer?.stallName || '')}</div>${p.isRemoved ? '<div class="fs-7 text-danger mt-1"><i class="bi bi-eye-slash"></i> Removed from the shop</div>' : ''}</div>`;
  }
  const f = r.farmer;
  if (!f) return `${icon} ${muted('Stall deleted')}`;
  return `<div class="mod-target"><span class="chip chip-soft">${icon} Stall</span> ${link(`/farmers/${f.slug}`, f.stallName, 'small fw-semi')}${f.isActive === false ? '<div class="fs-7 text-danger mt-1"><i class="bi bi-slash-circle"></i> Suspended</div>' : ''}</div>`;
}

function actionsCell(r) {
  const out = [];
  const hidden = r.targetType === 'review' ? r.review?.isRemoved : r.targetType === 'product' ? r.product?.isRemoved : r.farmer?.isActive === false;
  if (r.status === 'open') {
    if (r.targetType === 'farmer') out.push(action('suspend', 'Suspend stall', 'btn-outline-danger', 'bi-slash-circle'));
    else if (hidden) out.push(action('restore', r.reason === 'auto_language' ? 'Publish' : 'Restore', 'btn-soft', 'bi-eye'), action('remove', 'Keep hidden', 'btn-outline-danger', 'bi-eye-slash'));
    else out.push(action('remove', 'Remove', 'btn-outline-danger', 'bi-eye-slash'));
    out.push(action('dismiss', 'Dismiss', 'btn-white', 'bi-x-lg'));
  } else if (hidden && r.targetType !== 'farmer' && (r.review || r.product)) {
    out.push(action('restore', 'Restore', 'btn-soft', 'bi-arrow-counterclockwise'));
  }
  return `<div class="mod-actions">${out.join('')}</div>`;
}

const COLUMNS = [
  { data: 'targetType', title: 'Reported content', orderable: true, responsivePriority: 1, className: 'dt-comment', render: display((v, r) => targetCell(r), (v, r) => `${v}: ${r.review?.comment || r.product?.name || r.farmer?.stallName || ''}`) },
  {
    data: 'reason',
    title: 'Reason',
    render: display((v, r) => `<span class="chip ${v === 'auto_language' ? 'chip-warn' : 'chip-danger'}">${esc(REASON_LABEL[v] || v)}</span>${r.note ? `<div class="fs-7 text-muted-2 mt-1">${esc(r.note)}</div>` : ''}`, (v) => REASON_LABEL[v] || v),
  },
  { data: 'reporter.name', title: 'Reported by', orderable: false, render: display((v, r) => (r.reporter ? `<strong class="small d-block">${esc(v)}</strong>${muted(r.reporter.role)}` : `<span class="small"><i class="bi bi-robot"></i> Automatic</span>`), (v) => v || 'Automatic') },
  { data: 'createdAt', title: 'Date', render: display((v) => dateCell(v, true)) },
  {
    data: 'status',
    title: 'Status',
    render: display(
      (v, r) => `${badge(v === 'open' ? 'placed' : v === 'resolved' ? 'completed' : 'cancelled', v === 'open' ? 'Open' : v === 'resolved' ? `Resolved: ${r.action}` : 'Dismissed')}${r.resolvedBy ? `<div class="fs-7 text-muted-2 mt-1">${esc(r.resolvedBy.name)}${r.resolutionNote ? ` · ${esc(r.resolutionNote)}` : ''}</div>` : ''}`,
      (v, r) => (v === 'resolved' ? `resolved (${r.action})` : v)
    ),
  },
  { data: null, title: 'Actions', orderable: false, className: 'text-end no-export', responsivePriority: 2, render: (v, type, r) => actionsCell(r) },
];

const CONFIRM = {
  remove: { title: 'Remove this content', button: 'Remove', cls: 'btn-danger', hint: 'The content is hidden from the website. The reason is shown to the farmer.' },
  restore: { title: 'Publish / restore', button: 'Restore', cls: 'btn-primary', hint: 'The content becomes visible again and ratings are recalculated.' },
  suspend: { title: 'Suspend this stall', button: 'Suspend stall', cls: 'btn-danger', hint: 'The farmer can no longer sell and their products are hidden. They get an e-mail with the reason.' },
  dismiss: { title: 'Dismiss the report', button: 'Dismiss', cls: 'btn-primary', hint: 'Nothing changes on the website. Use this when the content is fine.' },
};

function ResolveModal({ job, onClose, onDone }) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = CONFIRM[job.action];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.patch(`/admin/moderation/${job.flag._id}`, { action: job.action, note });
      toast(res.message);
      onDone();
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
      title={meta.title}
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="resolve-form" className={`btn ${meta.cls}`} disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm" />} {meta.button}
          </button>
        </>
      }
    >
      <form id="resolve-form" onSubmit={submit} className="d-grid gap-3">
        <p className="small text-muted-2 mb-0">{meta.hint} Other open reports about the same content are closed too.</p>
        <div>
          <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
            <label className="form-label mb-0" htmlFor="resolve-note">
              {job.action === 'dismiss' || job.action === 'restore' ? 'Note (optional)' : 'Reason'}
            </label>
            <AiWriteButton kind="moderation-note" english context={{ action: job.action, reason: REASON_LABEL[job.flag.reason] || '' }} onText={(text) => setNote(text.slice(0, 300))} />
          </div>
          <textarea
            id="resolve-note"
            className="form-control"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={job.action === 'suspend' ? 'e.g. Repeated misleading listings' : job.action === 'remove' ? 'e.g. Abusive language' : ''}
          />
        </div>
      </form>
    </Modal>
  );
}

/** Admin: reports from customers and farmers plus reviews held by the word filter. */
export default function AdminModeration() {
  useDocumentTitle('Moderation');
  const { refreshBadges } = useOutletContext() || {};
  const [filters, setFilters] = useState({ status: 'open', targetType: '', reason: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [job, setJob] = useState(null);
  const { data: sum, reload: reloadSummary } = useFetch('/admin/moderation/summary');

  return (
    <>
      <DashHeader title="Content moderation" subtitle="Reports about reviews, product listings and stalls, and reviews held by the word filter. Resolve each one to keep MarketLink friendly and honest." />
      <div className="row g-2 g-xl-3 mb-3 kpi-row">
        <div className="col-6 col-md-3">
          <KpiCard variant="danger" icon="bi-flag" label="Open reports" value={sum?.open ?? '-'} sub={sum ? `${plural(sum.reviews, 'review')} · ${plural(sum.products, 'listing')} · ${plural(sum.farmers, 'stall')}` : ''} />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard variant="warn" icon="bi-hourglass-split" label="Held by word filter" value={sum?.held ?? '-'} sub="reviews waiting for a check" />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard icon="bi-check2-circle" label="Handled (30 days)" value={sum?.resolved30 ?? '-'} sub="resolved or dismissed" />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard variant="info" icon="bi-eye-slash" label="Hidden content" value={sum ? sum.removedReviews + sum.removedProducts : '-'} sub={sum ? `${plural(sum.removedReviews, 'review')} · ${plural(sum.removedProducts, 'listing')}` : ''} />
        </div>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <div className="tabs-pill" role="tablist" aria-label="Report status">
            {STATUS_TABS.map(([v, l]) => (
              <button key={v || 'all'} type="button" role="tab" aria-selected={filters.status === v} className={filters.status === v ? 'active' : ''} onClick={() => setFilters({ ...filters, status: v })}>
                {l}
                {v === 'open' && sum?.open > 0 && <span className="n">{sum.open}</span>}
              </button>
            ))}
          </div>
        </div>
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid
          table="flags"
          columns={COLUMNS}
          filters={filters}
          order={[[3, 'desc']]}
          exportName="MarketLink moderation reports"
          reloadKey={reloadKey}
          searchPlaceholder="Note or reporter…"
          onAction={(name, flag) => setJob({ action: name, flag })}
        />
      </div>
      {job && (
        <ResolveModal
          job={job}
          onClose={() => setJob(null)}
          onDone={() => {
            setJob(null);
            setReloadKey((k) => k + 1);
            reloadSummary();
            refreshBadges?.();
          }}
        />
      )}
    </>
  );
}
