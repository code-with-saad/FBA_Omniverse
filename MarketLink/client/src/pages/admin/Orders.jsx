import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DashHeader } from '../../components/common/PageHeader';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { badge, dateCell, dayCell, display, esc, link, moneyCell, muted, person } from '../../utils/cells';
import { ORDER_STATUS_META, time12 } from '../../utils/format';

const FILTERS = [
  { name: 'status', label: 'Status', options: [{ value: 'open', label: 'Open (placed, accepted, ready)' }, ...Object.entries(ORDER_STATUS_META).map(([value, m]) => ({ value, label: m.label }))] },
  { name: 'city', label: 'City', options: 'cities' },
  { name: 'market', label: 'Market', options: 'markets' },
  { name: 'farmer', label: 'Farmer', options: 'farmers' },
  { name: 'placedBy', label: 'Placed by', options: [{ value: 'customer', label: 'Customer (checkout)' }, { value: 'admin', label: 'Admin' }] },
  { name: 'pickupFrom', label: 'Pickup from', type: 'date' },
  { name: 'pickupTo', label: 'Pickup to', type: 'date' },
  { name: 'from', label: 'Placed from', type: 'date' },
  { name: 'to', label: 'Placed to', type: 'date' },
  { name: 'minTotal', label: 'Min total', type: 'number', placeholder: 'Rs' },
  { name: 'maxTotal', label: 'Max total', type: 'number', placeholder: 'Rs' },
];

const COLUMNS = [
  {
    data: 'orderNumber',
    title: 'Order',
    responsivePriority: 1,
    className: 'dt-nowrap',
    render: display((v, o) => `${link(`/admin/orders/${o._id}`, v, 'fw-semi text-nowrap')}${o.placedBy === 'admin' ? ' <span class="chip chip-soft ms-1" title="Placed by an admin">admin</span>' : ''}`),
  },
  { data: 'customer.name', title: 'Customer', orderable: false, responsivePriority: 4, render: display((v, o) => person(v, o.customer?.email, o.customer?.avatar)) },
  { data: 'farmer.stallName', title: 'Farmer', orderable: false, responsivePriority: 6, className: 'dt-market', render: display((v) => `<span class="small">${esc(v)}</span>`) },
  { data: 'market.name', title: 'Market', orderable: false, responsivePriority: 7, className: 'dt-market', render: display((v, o) => `<span class="small">${esc(v)}</span><div>${muted(o.market?.city || '')}</div>`) },
  { data: 'pickupDate', title: 'Pickup', responsivePriority: 5, className: 'dt-nowrap', render: display((v, o) => `${dayCell(v)}<div>${muted(`${time12(o.pickupSlot?.start)} to ${time12(o.pickupSlot?.end)}`)}</div>`) },
  { data: 'items', title: 'Items', orderable: false, responsivePriority: 9, className: 'text-end', render: (v, type) => (type === 'display' || type === 'export' ? v.reduce((s, i) => s + i.quantity, 0) : v.length) },
  { data: 'totalAmount', title: 'Total', responsivePriority: 3, className: 'text-end', render: display(moneyCell) },
  { data: 'status', title: 'Status', responsivePriority: 2, className: 'dt-nowrap', render: display((v) => badge(v)) },
  { data: 'createdAt', title: 'Placed', responsivePriority: 8, className: 'dt-nowrap', render: display((v) => dateCell(v, true)) },
];

export default function AdminOrders() {
  useDocumentTitle('All orders');
  const { openModal, changed } = useOutletContext();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ status: params.get('status') || '', city: '', market: '', farmer: '', placedBy: '', pickupFrom: '', pickupTo: '', from: '', to: '', minTotal: '', maxTotal: '' });

  return (
    <>
      <DashHeader
        title="Orders"
        subtitle="Every pre-order on MarketLink. Filter, search, sort and export, or place an order for a customer."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('order')}>
            <i className="bi bi-bag-plus" /> Place order
          </button>
        }
      />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="orders" columns={COLUMNS} filters={filters} order={[[8, 'desc']]} exportName="MarketLink orders" reloadKey={changed} searchPlaceholder="Order number, customer or farmer…" />
      </div>
    </>
  );
}
