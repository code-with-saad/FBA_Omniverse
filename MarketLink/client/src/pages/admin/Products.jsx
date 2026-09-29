import { useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { action, badge, dateCell, display, esc, link, moneyCell, muted } from '../../utils/cells';
import { productPath } from '../../utils/links';

const FILTERS = [
  { name: 'status', label: 'Listing', options: [{ value: 'available', label: 'Available' }, { value: 'sold_out', label: 'Sold out' }, { value: 'unavailable', label: 'Unavailable' }, { value: 'removed', label: 'Removed by admin' }] },
  { name: 'category', label: 'Category', options: 'categories' },
  { name: 'farmer', label: 'Farmer', options: 'farmers' },
  { name: 'city', label: 'City', options: 'cities' },
  { name: 'stock', label: 'Stock', options: [{ value: 'low', label: 'Low (5 or less)' }] },
  { name: 'minPrice', label: 'Min price', type: 'number', placeholder: 'Rs' },
  { name: 'maxPrice', label: 'Max price', type: 'number', placeholder: 'Rs' },
];

const COLUMNS = [
  {
    data: 'name',
    title: 'Product',
    responsivePriority: 1,
    render: display((v, p) => `<div class="d-flex align-items-center gap-2"><span class="thumb-sm" style="background:${esc(p.category?.color || '#f1ebdd')}"><img src="${esc(p.image)}" alt=""></span><div class="min-w-0">${p.isRemoved ? `<strong class="small d-block">${esc(v)}</strong>` : link(productPath(p), v, 'small fw-semi d-block')}${muted(p.category?.name || '')}</div></div>`),
  },
  { data: 'farmer.stallName', title: 'Farmer', orderable: false, render: display((v, p) => `<span class="small">${esc(v)}</span><div>${muted(p.farmer?.city || '')}</div>`) },
  { data: 'price', title: 'Price', className: 'text-end', render: display((v, p) => `${moneyCell(v)}<div>${muted(`per ${p.unit}`)}</div>`) },
  { data: 'quantityAvailable', title: 'Stock', className: 'text-end', render: display((v) => (v <= 5 ? `<span class="text-danger fw-semi">${esc(v)}</span>` : esc(v))) },
  { data: 'totalSold', title: 'Sold', className: 'text-end' },
  { data: 'ratingAvg', title: 'Rating', className: 'text-end', render: display((v, p) => (p.ratingCount ? `${esc(v)} <i class="bi bi-star-fill text-warning"></i>` : '-')) },
  { data: 'status', title: 'Status', orderable: false, render: display((v, p) => (p.isRemoved ? badge('removed', 'Removed') : badge(v)), (v, p) => (p.isRemoved ? 'removed' : v)) },
  { data: 'createdAt', title: 'Listed', render: display((v) => dateCell(v)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end no-export',
    responsivePriority: 2,
    render: (v, type, p) => (p.isRemoved ? action('restore', 'Restore', 'btn-soft') : action('remove', 'Remove', 'btn-outline-danger')),
  },
];

export default function AdminProducts() {
  useDocumentTitle('Product listings');
  const { toast } = useToast();
  const [filters, setFilters] = useState({ status: '', category: '', farmer: '', city: '', stock: '', minPrice: '', maxPrice: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [removing, setRemoving] = useState(null);
  const [reason, setReason] = useState('Violates platform guidelines');

  async function moderate(product, act, why) {
    try {
      await api.patch(`/admin/products/${product._id}/moderate`, { action: act, reason: why });
      toast(act === 'remove' ? 'Listing removed and farmer notified' : 'Listing restored');
      setRemoving(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <DashHeader title="Product listings" subtitle="Every listing on MarketLink. Remove anything inappropriate; the farmer is told why." />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid
          table="products"
          columns={COLUMNS}
          filters={filters}
          order={[[7, 'desc']]}
          exportName="MarketLink products"
          reloadKey={reloadKey}
          searchPlaceholder="Product or farmer…"
          onAction={(name, p) => (name === 'remove' ? setRemoving(p) : moderate(p, 'restore'))}
        />
      </div>
      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove “${removing?.name}”?`}
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => moderate(removing, 'remove', reason)}>
              Remove listing
            </button>
          </>
        }
      >
        <label className="form-label" htmlFor="rm-reason">Reason (sent to the farmer)</label>
        <input id="rm-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
