import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DashHeader } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import KpiCard from '../../components/common/KpiCard';
import { BarList, ChartCard, ColumnChart } from '../../components/charts/Charts';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { badge, dateCell, dayCell, display, esc, link, moneyCell } from '../../utils/cells';
import { formatDate, money, moneyCompact, MONTHS, ORDER_STATUS_META } from '../../utils/format';
import RefreshButton from '../../components/common/RefreshButton';

const ORDER_COLUMNS = [
  { data: 'orderNumber', title: 'Order', responsivePriority: 1, render: display((v, o) => link(`/admin/orders/${o._id}`, v, 'fw-semi text-nowrap')) },
  { data: 'farmer.stallName', title: 'Farmer', orderable: false, render: display((v) => `<span class="small">${esc(v)}</span>`) },
  { data: 'market.name', title: 'Market', orderable: false, render: display((v) => `<span class="small">${esc(v)}</span>`) },
  {
    data: 'items',
    title: 'What was bought',
    orderable: false,
    className: 'dt-comment',
    render: display(
      (v) => `<span class="small">${esc(v.map((i) => `${i.name} × ${i.quantity} ${i.unit}`).join(', '))}</span>`,
      (v) => v.map((i) => `${i.name} x ${i.quantity} ${i.unit}`).join(', ')
    ),
  },
  { data: 'pickupDate', title: 'Pickup', render: display((v) => dayCell(v)) },
  { data: 'totalAmount', title: 'Total', className: 'text-end', render: display(moneyCell) },
  { data: 'status', title: 'Status', render: display((v) => badge(v)) },
  { data: 'createdAt', title: 'Placed', render: display((v) => dateCell(v)) },
];

const FILTERS = [
  { name: 'status', label: 'Status', options: Object.entries(ORDER_STATUS_META).map(([value, m]) => ({ value, label: m.label })) },
  { name: 'farmer', label: 'Farmer', options: 'farmers' },
  { name: 'from', label: 'Placed from', type: 'date' },
  { name: 'to', label: 'Placed to', type: 'date' },
];

const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};

/** One customer: profile, totals, purchases per farmer and the full order history. */
export default function AdminCustomerDetail() {
  const { id } = useParams();
  const { changed } = useOutletContext();
  const { data, loading, error, reload } = useFetch(`/admin/customers/${id}/overview`);
  const [filters, setFilters] = useState({ status: '', farmer: '', from: '', to: '' });
  const [openFarmer, setOpenFarmer] = useState(null);
  useDocumentTitle(data?.customer?.name || 'Customer');

  if (error) return <div className="alert alert-danger">{error.message}</div>;
  if (loading && !data) return <PageLoader />;
  const { customer, stats, byFarmer, byMonth, household } = data;

  return (
    <>
      <DashHeader
        title={customer.name}
        subtitle="Order history and purchases from each farmer."
        actions={
          <>
            <RefreshButton onRefresh={reload} loading={loading} className="btn-sm" />
            <Link to="/admin/customers" className="btn btn-white btn-sm">
              <i className="bi bi-arrow-left" /> All customers
            </Link>
          </>
        }
      />
      <div className="row g-3 mb-3">
        <div className="col-xl-4">
          <div className="panel customer-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <Avatar name={customer.name} src={customer.avatar} className="avatar-xl" />
              <div className="min-w-0">
                <strong className="d-block text-truncate">{customer.name}</strong>
                <span className="small text-muted-2 d-block text-truncate">{customer.email}</span>
                <StatusBadge status={customer.status} label={customer.status === 'inactive' ? 'Deactivated' : 'Active'} />
              </div>
            </div>
            <div className="info-row"><span>Phone</span><span>{customer.phone || '-'}</span></div>
            <div className="info-row"><span>Address</span><span>{customer.address || '-'}{customer.city ? `, ${customer.city}` : ''}</span></div>
            <div className="info-row"><span>Joined</span><span>{formatDate(customer.createdAt)}</span></div>
            <div className="info-row"><span>Last login</span><span>{customer.lastLoginAt ? formatDate(customer.lastLoginAt, { time: true }) : '-'}</span></div>
            <div className="info-row"><span>Favourites</span><span>{customer.favorites.farmers} farmers · {customer.favorites.products} products</span></div>
            <div className="info-row"><span>Household</span><span>{household.length ? household.map((h) => h.name).join(', ') : '-'}</span></div>
          </div>
        </div>
        <div className="col-xl-8">
          <div className="row g-3 kpi-row">
            <div className="col-6 col-md-4">
              <KpiCard variant="accent" icon="bi-cash-stack" label="Spent (completed)" value={moneyCompact(stats.spent)} sub={`avg ${money(stats.average)} per order`} />
            </div>
            <div className="col-6 col-md-4">
              <KpiCard icon="bi-receipt" label="Orders" value={stats.orders} sub={`${stats.completed} completed · ${stats.open} open`} />
            </div>
            <div className="col-6 col-md-4">
              <KpiCard variant="info" icon="bi-shop" label="Farmers bought from" value={stats.farmers} sub={stats.cancelled ? `${stats.cancelled} cancelled/declined` : 'no cancellations'} />
            </div>
            <div className="col-6 col-md-6">
              <KpiCard icon="bi-calendar-check" label="First order" value={stats.firstOrder ? formatDate(stats.firstOrder) : '-'} />
            </div>
            <div className="col-12 col-md-6">
              <KpiCard icon="bi-clock-history" label="Last order" value={stats.lastOrder ? formatDate(stats.lastOrder) : '-'} />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-xl-5">
          <ChartCard title="Spent per farmer" subtitle="Orders not cancelled or declined" table={{ columns: ['Farmer', 'Orders', 'Amount'], rows: byFarmer.map((f) => [f.farmer, f.orders, money(f.amount)]) }}>
            {byFarmer.length ? <BarList data={byFarmer.slice(0, 8)} labelKey="farmer" valueKey="amount" name="Amount" valueFormatter={moneyCompact} /> : <p className="small text-muted-2 mb-0">No purchases yet.</p>}
          </ChartCard>
        </div>
        <div className="col-xl-7">
          <ChartCard title="Orders per month" subtitle="All statuses" table={{ columns: ['Month', 'Orders', 'Completed amount'], rows: byMonth.map((m) => [monthLabel(m.month), m.orders, money(m.amount)]) }}>
            <ColumnChart data={byMonth.map((m) => ({ ...m, label: monthLabel(m.month) }))} xKey="label" yKey="orders" name="Orders" dateAxis={false} height={220} />
          </ChartCard>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-head">
          <h5>
            <i className="bi bi-diagram-3" /> Bought from each farmer
          </h5>
          <span className="fs-7 text-muted-2">click a farmer to see the products</span>
        </div>
        <div className="farmer-purchases">
          {byFarmer.map((f) => (
            <div key={f.farmerId} className={`farmer-purchase ${openFarmer === f.farmerId ? 'is-open' : ''}`}>
              <button type="button" className="farmer-purchase-head" onClick={() => setOpenFarmer(openFarmer === f.farmerId ? null : f.farmerId)} aria-expanded={openFarmer === f.farmerId}>
                <strong>{f.farmer}</strong>
                <span className="text-muted-2 small">
                  {f.orders} order{f.orders > 1 ? 's' : ''} · {f.items} items · last {formatDate(f.lastOrder)}
                </span>
                <span className="ms-auto fw-bold">{money(f.amount)}</span>
                <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
              {openFarmer === f.farmerId && (
                <table className="table table-sm small mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Quantity</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.products.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td className="text-end">
                          {p.quantity} {p.unit}
                        </td>
                        <td className="text-end">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {byFarmer.length === 0 && <p className="small text-muted-2 mb-0">This customer has not bought anything yet.</p>}
        </div>
      </div>

      <div className="table-card">
        <div className="panel-head px-1">
          <h5>
            <i className="bi bi-clock-history" /> Order history
          </h5>
        </div>
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="orders" columns={ORDER_COLUMNS} filters={{ ...filters, customer: id }} order={[[7, 'desc']]} exportName={`Orders of ${customer.name}`} reloadKey={changed} searchPlaceholder="Order number or farmer…" />
      </div>
    </>
  );
}
