import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DashHeader } from '../../components/common/PageHeader';
import OrderCard from '../../components/order/OrderCard';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import useViewMode from '../../hooks/useViewMode';
import ViewToggle from '../../components/common/ViewToggle';
import DataGrid from '../../components/admin/DataGrid';
import { badge, dayCell, display, esc, link, linkButton, moneyCell, muted } from '../../utils/cells';
import { time12 } from '../../utils/format';
import { productName, t, unitName } from '../../i18n';

const COLUMNS = [
  { data: 'orderNumber', title: 'Order', responsivePriority: 1, className: 'dt-nowrap', render: display((v, o) => `${link(`/account/orders/${o._id}`, v)}${o.canModify ? `<div><span class="chip chip-soft">${t('Editable')}</span></div>` : ''}`) },
  { data: 'farmer.stallName', title: 'Farmer', render: display((v, o) => `<span class="small">${esc(v || '')}</span><div>${muted(o.market?.name || '')}</div>`) },
  { data: 'pickupDate', title: 'Pickup', className: 'dt-nowrap', render: display((v, o) => `${dayCell(v)}<div>${muted(t('{from} to {to}', { from: time12(o.pickupSlot?.start), to: time12(o.pickupSlot?.end) }))}</div>`) },
  { data: 'items', title: 'Items', orderable: false, className: 'dt-comment', render: display((v) => `<span class="small">${esc((v || []).map((i) => `${i.quantity} ${unitName(i.unit)} ${productName(i)}`).join(' · '))}</span>`, (v) => (v || []).map((i) => `${i.quantity} ${unitName(i.unit)} ${productName(i)}`).join('; ')) },
  { data: 'totalAmount', title: 'Total', className: 'text-end', render: display((v) => moneyCell(v)) },
  { data: 'status', title: 'Status', responsivePriority: 3, render: display((v) => badge(v)) },
  { data: null, title: '', orderable: false, className: 'text-end no-export', responsivePriority: 2, render: (v, type, o) => linkButton(`/account/orders/${o._id}`, t('View'), 'btn-white') },
];

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'past', label: 'History' },
  { value: 'all', label: 'All' },
];

export default function CustomerOrders() {
  useDocumentTitle(t('My orders'));
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const [page, setPage] = useState(1);
  const [view, setView] = useViewMode('customer-orders');
  const table = view === 'table';
  const { data, loading } = useFetch(`/orders/my?status=${tab}&page=${page}&limit=${table ? 50 : 10}`);
  const family = useFetch(user.household ? '/orders/family' : null);

  return (
    <>
      <DashHeader title={t('My orders')} subtitle={t('Track, modify or cancel pre-orders before the farmer\'s cut-off time, and reorder past favourites.')} actions={<ViewToggle value={view} onChange={setView} />} />
      <div className="tabs-pill mb-3" role="tablist">
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
          </button>
        ))}
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : data.orders.length === 0 ? (
        <EmptyState title={tab === 'active' ? t('No active pre-orders') : t('No orders yet')} message={t('Browse this week\'s harvest and place your first pre-order.')} action={<Link to="/products" className="btn btn-primary">{t('Start shopping')}</Link>} />
      ) : table ? (
        <div className="table-card">
          <DataGrid key={tab} data={data.orders} columns={COLUMNS} order={[[2, 'desc']]} exportName="My MarketLink orders" searchPlaceholder={t('Order, farmer or item…')} />
        </div>
      ) : (
        <div className="d-grid gap-2">
          {data.orders.map((o) => (
            <OrderCard key={o._id} order={o} to={`/account/orders/${o._id}`} />
          ))}
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />

      {family.data?.orders?.length > 0 && (
        <div className="mt-5">
          <h2 className="h4">
            <i className="bi bi-people" /> {t('Family orders')}
          </h2>
          <p className="small text-muted-2">{t('Pre-orders placed by members of your household.')}</p>
          <div className="d-grid gap-2">
            {family.data.orders.slice(0, 6).map((o) => (
              <OrderCard
                key={o._id}
                order={o}
                to={`/account/orders/${o._id}`}
                footer={<div className="fs-7 text-muted-2 mt-2">{t('Ordered by')} {o.customer?.name}</div>}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
