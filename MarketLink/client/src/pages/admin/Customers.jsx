import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import { ConfirmModal } from '../../components/common/Modal';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { action, badge, dateCell, display, esc, moneyCell, person } from '../../utils/cells';

const FILTERS = [
  { name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }] },
  { name: 'city', label: 'City', options: 'cities' },
  { name: 'household', label: 'Family sharing', options: [{ value: 'yes', label: 'In a household' }] },
  { name: 'from', label: 'Joined from', type: 'date' },
  { name: 'to', label: 'Joined to', type: 'date' },
];

const COLUMNS = [
  { data: 'name', title: 'Customer', responsivePriority: 1, render: display((v, c) => person(v, c.email, c.avatar)) },
  { data: 'phone', title: 'Phone', orderable: false, render: display((v) => `<span class="text-nowrap small">${esc(v || '-')}</span>`) },
  { data: 'city', title: 'City', render: display((v) => esc(v || '-')) },
  { data: 'orderCount', title: 'Orders', orderable: false, className: 'text-end' },
  { data: 'completed', title: 'Completed', orderable: false, className: 'text-end' },
  { data: 'spent', title: 'Spent', orderable: false, className: 'text-end', render: display(moneyCell) },
  { data: 'lastOrderAt', title: 'Last order', orderable: false, render: display((v) => dateCell(v)) },
  { data: 'status', title: 'Status', render: display((v) => badge(v, v === 'inactive' ? 'Deactivated' : 'Active')) },
  { data: 'createdAt', title: 'Joined', render: display((v) => dateCell(v)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, c) => [action('history', 'History', 'btn-soft', 'bi-clock-history'), c.status === 'active' ? action('deactivate', 'Deactivate', 'btn-outline-danger') : action('activate', 'Activate', 'btn-primary')].join(' '),
  },
];

export default function AdminCustomers() {
  useDocumentTitle('Customers');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openModal, changed } = useOutletContext();
  const [filters, setFilters] = useState({ status: '', city: '', household: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState(null);

  async function setStatus(customer, next) {
    try {
      await api.patch(`/admin/customers/${customer._id}/status`, { status: next });
      toast(`${customer.name} ${next === 'active' ? 'activated' : 'deactivated'}`);
      setTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function onAction(name, customer) {
    if (name === 'history') navigate(`/admin/customers/${customer._id}`);
    if (name === 'activate') return setStatus(customer, 'active'); // the button spins until it is saved
    if (name === 'deactivate') setTarget(customer);
    return undefined;
  }

  return (
    <>
      <DashHeader
        title="Customers"
        subtitle="Every customer with their orders and spending. Open History for the full order history and what they bought from each farmer."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('customer')}>
            <i className="bi bi-person-plus" /> Add customer
          </button>
        }
      />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="customers" columns={COLUMNS} filters={filters} order={[[8, 'desc']]} exportName="MarketLink customers" onAction={onAction} reloadKey={reloadKey + changed} searchPlaceholder="Search name, e-mail, phone…" />
      </div>
      <ConfirmModal
        open={Boolean(target)}
        title={`Deactivate ${target?.name}?`}
        message="The customer can no longer log in or place pre-orders. You can activate the account again at any time."
        confirmLabel="Deactivate"
        danger
        onConfirm={() => setStatus(target, 'inactive')}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
