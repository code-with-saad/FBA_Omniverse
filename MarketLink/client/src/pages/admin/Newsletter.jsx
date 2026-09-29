import { useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { action, dateCell, display, esc, muted } from '../../utils/cells';

const SOURCE = { home: 'Home page', footer: 'Footer', checkout: 'Checkout', admin: 'Admin' };

const FILTERS = [
  { name: 'status', label: 'Status', options: [{ value: 'subscribed', label: 'Subscribed' }, { value: 'unsubscribed', label: 'Unsubscribed' }] },
  { name: 'source', label: 'Signed up on', options: Object.entries(SOURCE).map(([value, label]) => ({ value, label })) },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const COLUMNS = [
  { data: 'email', title: 'E-mail', responsivePriority: 1, render: display((v, s) => `<strong class="small d-block">${esc(v)}</strong>${s.name ? muted(s.name) : ''}`) },
  { data: 'source', title: 'Signed up on', render: display((v) => `<span class="small">${esc(SOURCE[v] || v)}</span>`, (v) => SOURCE[v] || v) },
  {
    data: 'status',
    title: 'Status',
    render: display((v, s) => (v === 'subscribed' ? '<span class="chip chip-lime">Subscribed</span>' : `<span class="chip">Unsubscribed</span>${s.unsubscribedAt ? `<div class="fs-7 text-muted-2 mt-1">${dateCell(s.unsubscribedAt)}</div>` : ''}`)),
  },
  { data: 'createdAt', title: 'Signed up', render: display((v) => dateCell(v, true)) },
  { data: null, title: 'Actions', orderable: false, className: 'text-end no-export', responsivePriority: 2, render: (v, type, s) => action('delete', '', 'btn-white', 'bi-trash3').replace('aria-label="delete"', `aria-label="Remove ${esc(s.email)}"`) },
];

export default function AdminNewsletter() {
  useDocumentTitle('Newsletter');
  const { toast } = useToast();
  const [filters, setFilters] = useState({ status: '', source: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);

  async function onAction(name, s) {
    if (name !== 'delete') return;
    try {
      await api.del(`/admin/subscribers/${s._id}`);
      toast('Subscriber removed');
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <DashHeader title="Newsletter" subtitle="People who signed up for the weekly harvest e-mail. Export the list as CSV or Excel for your mailing tool." />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="subscribers" columns={COLUMNS} filters={filters} order={[[3, 'desc']]} exportName="MarketLink newsletter" reloadKey={reloadKey} onAction={onAction} searchPlaceholder="E-mail or name…" />
      </div>
    </>
  );
}
