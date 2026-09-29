import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useViewMode from '../../hooks/useViewMode';
import { toQuery } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import OrderCard from '../../components/order/OrderCard';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import ViewToggle from '../../components/common/ViewToggle';
import DataGrid from '../../components/admin/DataGrid';
import { action, badge, dayCell, display, esc, link, linkButton, moneyCell, muted } from '../../utils/cells';
import { formatDateKey, time12, toDateKey } from '../../utils/format';
import FarmerOrderActions, { ACTION_DONE, DeclineModal, ORDER_ACTIONS, runOrderAction } from './FarmerOrderActions';
import { ApprovalBanner } from './Dashboard';
import { useAuth } from '../../context/AuthContext';
import { isUrdu, productName, t, unitName } from '../../i18n';

const TABS = [
  { value: 'active', label: 'Open' },
  { value: 'placed', label: 'New' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'ready', label: 'Ready' },
  { value: 'history', label: 'History' },
  { value: 'problems', label: 'Not received' },
];

const COLUMNS = [
  { data: 'orderNumber', title: 'Order', responsivePriority: 1, className: 'dt-nowrap', render: display((v, o) => `${link(`/farmer/orders/${o._id}`, v)}${o.issue?.status && o.issue.status !== 'resolved' ? ` <span class="chip chip-danger">${t('Not received')}</span>` : ''}<div>${muted(t('placed {date}', { date: isUrdu() ? formatDateKey(toDateKey(new Date(o.createdAt))) : new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }))}</div>`) },
  {
    data: 'customer.name',
    title: 'Customer',
    orderable: true,
    render: display((v, o) => `<strong class="small d-block">${esc(v || t('Customer'))}</strong>${o.customer?.phone ? `<a class="fs-7" href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a>` : ''}`),
  },
  {
    data: 'items',
    title: 'Items',
    orderable: false,
    className: 'dt-comment',
    render: display((v, o) => `<span class="small">${esc((v || []).map((i) => `${i.quantity} ${unitName(i.unit)} ${productName(i)}`).join(' · '))}</span>${o.customerNote ? `<div class="fs-7 mt-1"><i class="bi bi-chat-left-text"></i> “${esc(o.customerNote)}”</div>` : ''}`, (v) => (v || []).map((i) => `${i.quantity} ${unitName(i.unit)} ${productName(i)}`).join('; ')),
  },
  { data: 'pickupDate', title: 'Pickup', className: 'dt-nowrap', render: display((v, o) => `${dayCell(v)}<div>${muted(t('{from} to {to}', { from: time12(o.pickupSlot?.start), to: time12(o.pickupSlot?.end) }))}</div>`) },
  { data: 'totalAmount', title: 'Total', className: 'text-end', render: display((v) => moneyCell(v)) },
  { data: 'status', title: 'Status', responsivePriority: 3, render: display((v) => badge(v)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end no-export',
    responsivePriority: 2,
    render: (v, type, o) => `<div class="dt-actions">${(ORDER_ACTIONS[o.status] || []).map((a) => action(a.action, t(a.label), a.cls, a.icon)).join('')}${linkButton(`/farmer/orders/${o._id}`, t('Details'))}</div>`,
  },
];

export default function FarmerOrders() {
  useDocumentTitle(t('Pre-orders'));
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const [view, setView] = useViewMode('farmer-orders');
  const table = view === 'table' && !focus;
  const [tab, setTab] = useState(focus ? 'all' : 'active');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [declining, setDeclining] = useState(null);
  const { data, loading, reload } = useFetch(`/farmer/orders${toQuery({ status: tab === 'all' ? '' : tab, date, search, page, limit: table ? 100 : 15 })}`);

  const counts = data?.statusCounts || {};
  const tabCount = (v) => (v === 'active' ? (counts.placed || 0) + (counts.accepted || 0) + (counts.ready || 0) : v === 'history' ? (counts.completed || 0) + (counts.declined || 0) + (counts.cancelled || 0) : counts[v]);

  async function onAction(name, order) {
    if (name === 'decline') {
      setDeclining(order);
      return;
    }
    try {
      await runOrderAction(order, name);
      toast(t(ACTION_DONE[name]));
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <DashHeader title={t('Pre-orders')} subtitle={t('Accept or decline new pre-orders, mark them ready for pickup and complete them at the stall.')} actions={!focus && <ViewToggle value={view} onChange={setView} />} />
      <ApprovalBanner status={user.status} />
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div className="tabs-pill" role="tablist">
          {TABS.map((tx) => (
            <button
              key={tx.value}
              type="button"
              role="tab"
              aria-selected={tab === tx.value}
              className={tab === tx.value ? 'active' : ''}
              onClick={() => {
                setTab(tx.value);
                setPage(1);
              }}
            >
              {t(tx.label)}
              {data && <span className="n">{tabCount(tx.value) || 0}</span>}
            </button>
          ))}
        </div>
        <input type="date" className="form-control w-auto" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('Pickup date')} />
        {!table && (
          <div className="search-pill" style={{ maxWidth: 240 }}>
            <i className="bi bi-search" />
            <input placeholder={t('Order number')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('Search order number')} />
          </div>
        )}
        {(date || search) && (
          <button
            type="button"
            className="btn btn-link btn-sm"
            onClick={() => {
              setDate('');
              setSearch('');
            }}
          >
            {t('Clear')}
          </button>
        )}
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : data.orders.length === 0 ? (
        <EmptyState icon="bi-receipt" title={t('No pre-orders here')} message={t('New pre-orders from customers will appear in this list.')} />
      ) : table ? (
        <div className="table-card">
          <DataGrid key={`${tab}-${date}`} data={data.orders} columns={COLUMNS} order={[[3, 'asc']]} exportName="MarketLink pre-orders" searchPlaceholder={t('Order, customer or item…')} onAction={onAction} />
        </div>
      ) : (
        <div className="d-grid gap-2">
          {data.orders.map((o) => (
            <OrderCard
              key={o._id}
              order={o}
              highlight={o._id === focus}
              footer={
                <div className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-3 border-top">
                  <div className="small flex-grow-1">
                    <i className="bi bi-person" /> <strong>{o.customer?.name}</strong> · <a href={`tel:${o.customer?.phone}`}>{o.customer?.phone}</a>
                    <div className="fs-7 text-muted-2 mt-1">{o.items.map((i) => `${i.quantity} ${unitName(i.unit)} ${productName(i)}`).join(' · ')}</div>
                    {o.customerNote && (
                      <div className="fs-7 mt-1">
                        <i className="bi bi-chat-left-text" /> “{o.customerNote}”
                      </div>
                    )}
                  </div>
                  <FarmerOrderActions order={o} compact onChange={reload} />
                  <Link to={`/farmer/orders/${o._id}`} className="btn btn-sm btn-white">
                    {t('Details')}
                  </Link>
                </div>
              }
            />
          ))}
        </div>
      )}
      {!table && <Pagination page={page} pages={data?.pages} onChange={setPage} />}
      {table && data?.pages > 1 && <Pagination page={page} pages={data.pages} onChange={setPage} />}
      {declining && (
        <DeclineModal
          order={declining}
          onClose={() => setDeclining(null)}
          onDone={() => {
            setDeclining(null);
            reload();
          }}
        />
      )}
    </>
  );
}
