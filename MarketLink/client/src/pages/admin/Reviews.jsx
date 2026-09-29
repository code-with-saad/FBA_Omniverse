import { useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { action, badge, dateCell, display, esc, link, person } from '../../utils/cells';
import { productPath } from '../../utils/links';

const FILTERS = [
  { name: 'removed', label: 'Visibility', options: [{ value: 'no', label: 'Visible' }, { value: 'yes', label: 'Removed' }] },
  { name: 'type', label: 'About', options: [{ value: 'product', label: 'Products' }, { value: 'farmer', label: 'Farmers' }] },
  { name: 'verified', label: 'Purchase', options: [{ value: 'yes', label: 'Verified purchase' }, { value: 'no', label: 'Unverified' }] },
  { name: 'rating', label: 'Rating', options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n > 1 ? 's' : ''}` })) },
  { name: 'farmer', label: 'Farmer', options: 'farmers' },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const stars = (n) => `<span class="text-nowrap text-warning" title="${n} of 5">${'<i class="bi bi-star-fill"></i>'.repeat(n)}${'<i class="bi bi-star"></i>'.repeat(5 - n)}</span>`;

const COLUMNS = [
  { data: 'customer.name', title: 'Customer', orderable: false, responsivePriority: 1, render: display((v, r) => person(v || 'Customer', '', r.customer?.avatar)) },
  { data: 'rating', title: 'Rating', render: display((v) => stars(v)) },
  {
    data: 'verified',
    title: 'Purchase',
    render: display(
      (v) => (v ? '<span class="review-badge is-verified"><i class="bi bi-patch-check-fill"></i> Verified</span>' : '<span class="review-badge"><i class="bi bi-question-circle"></i> Unverified</span>'),
      (v) => (v ? 'Verified' : 'Unverified')
    ),
  },
  {
    data: 'type',
    title: 'About',
    render: display((v, r) => (v === 'product' && r.product ? `${link(productPath(r.product), r.product.name, 'small fw-semi')}<div class="fs-7 text-muted-2">${esc(r.farmer?.stallName || '')}</div>` : `<span class="small fw-semi">${esc(r.farmer?.stallName || '')}</span><div class="fs-7 text-muted-2">Farmer review</div>`), (v, r) => (v === 'product' ? r.product?.name : r.farmer?.stallName)),
  },
  { data: 'comment', title: 'Comment', orderable: false, className: 'dt-comment', render: display((v, r) => `<span class="small">${esc(v || '-')}</span>${r.response?.text ? `<div class="fs-7 text-muted-2 mt-1"><i class="bi bi-reply"></i> ${esc(r.response.text)}</div>` : ''}`) },
  { data: 'isRemoved', title: 'Status', orderable: false, render: display((v) => (v ? badge('removed', 'Removed') : badge('active', 'Visible')), (v) => (v ? 'Removed' : 'Visible')) },
  { data: 'createdAt', title: 'Date', render: display((v) => dateCell(v)) },
  { data: null, title: 'Actions', orderable: false, className: 'text-end no-export', responsivePriority: 2, render: (v, type, r) => (r.isRemoved ? action('restore', 'Restore', 'btn-soft') : action('remove', 'Remove', 'btn-outline-danger')) },
];

export default function AdminReviews() {
  useDocumentTitle('Reviews');
  const { toast } = useToast();
  const [filters, setFilters] = useState({ removed: '', type: '', verified: '', rating: '', farmer: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);

  async function moderate(review, act) {
    try {
      await api.patch(`/admin/reviews/${review._id}/moderate`, { action: act, reason: 'Violates review guidelines' });
      toast(act === 'remove' ? 'Review removed' : 'Review restored');
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <DashHeader title="Reviews" subtitle="Remove reviews that are abusive, spam or break the guidelines. Ratings are recalculated automatically." />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="reviews" columns={COLUMNS} filters={filters} order={[[6, 'desc']]} exportName="MarketLink reviews" reloadKey={reloadKey} searchPlaceholder="Comment or customer…" onAction={(name, r) => moderate(r, name)} />
      </div>
    </>
  );
}
