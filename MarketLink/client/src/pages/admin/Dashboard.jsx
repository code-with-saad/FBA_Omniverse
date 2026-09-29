import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import KpiCard from '../../components/common/KpiCard';
import StatusBadge from '../../components/common/StatusBadge';
import { PageLoader } from '../../components/common/Loader';
import { BarList, ChartCard, ColumnChart, TrendChart } from '../../components/charts/Charts';
import { formatDate, formatDateKey, money, moneyCompact, ORDER_STATUS_META, timeAgo } from '../../utils/format';
import RefreshButton from '../../components/common/RefreshButton';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Admin overview: compact so the key numbers, charts and to-dos fit on one laptop screen. */
export default function AdminDashboard() {
  useDocumentTitle('Admin dashboard');
  const { user } = useAuth();
  const { openModal, changed } = useOutletContext();
  const [metric, setMetric] = useState('orders');
  const { data, loading, reload } = useFetch(`/admin/dashboard?v=${changed}`);
  if (loading && !data) return <PageLoader />;
  const { totals, last30, topFarmers, recentOrders, pendingFarmers } = data;
  const statusRows = Object.entries(last30.byStatus).map(([s, n]) => ({ label: ORDER_STATUS_META[s].label, value: n }));
  const todos = [
    totals.pendingFarmers > 0 && { to: '/admin/farmers?status=pending', icon: 'bi-person-check', tone: 'warn', text: `${totals.pendingFarmers} farmer${totals.pendingFarmers > 1 ? 's' : ''} waiting for approval`, sub: pendingFarmers.map((f) => f.stallName).join(', ') },
    totals.newMessages > 0 && { to: '/admin/messages', icon: 'bi-envelope', tone: 'info', text: `${totals.newMessages} new contact message${totals.newMessages > 1 ? 's' : ''}`, sub: 'From the Contact Us page' },
    totals.openOrders > 0 && { to: '/admin/orders?status=open', icon: 'bi-receipt', tone: '', text: `${totals.openOrders} open pre-orders`, sub: 'Placed, accepted or ready for pickup' },
  ].filter(Boolean);

  return (
    <>
      <div className="admin-hello">
        <div>
          <h1>
            {greeting()}, {user.name}
          </h1>
          <p>{formatDate(new Date())} · here is what is happening on MarketLink</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <RefreshButton onRefresh={reload} loading={loading} className="btn-sm" />
          <button type="button" className="btn btn-sm btn-white" onClick={() => openModal('customer')}>
            <i className="bi bi-person-add" /> Add customer
          </button>
          <Link to="/admin/reports" className="btn btn-sm btn-white">
            <i className="bi bi-file-earmark-bar-graph" /> Reports
          </Link>
        </div>
      </div>

      <div className="row g-2 g-xl-3 mb-3 kpi-row">
        <div className="col-6 col-md-4 col-xxl-2">
          <KpiCard variant="accent" icon="bi-cash-stack" label="Revenue" value={moneyCompact(totals.revenue)} sub="completed, paid at pickup" />
        </div>
        <div className="col-6 col-md-4 col-xxl-2">
          <KpiCard icon="bi-receipt" label="Orders" value={totals.orders} sub={`${totals.openOrders} open now`} />
        </div>
        <div className="col-6 col-md-4 col-xxl-2">
          <KpiCard variant="warn" icon="bi-shop" label="Farmers" value={totals.farmers} sub={`${totals.pendingFarmers} pending`} />
        </div>
        <div className="col-6 col-md-4 col-xxl-2">
          <KpiCard icon="bi-people" label="Customers" value={totals.customers} />
        </div>
        <div className="col-6 col-md-4 col-xxl-2">
          <KpiCard variant="info" icon="bi-geo-alt" label="Markets" value={totals.markets} sub={`${totals.products} products`} />
        </div>
        <div className="col-6 col-md-4 col-xxl-2">
          <KpiCard variant="danger" icon="bi-envelope" label="New messages" value={totals.newMessages} />
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-xl-8">
          <ChartCard
            title={metric === 'orders' ? 'Orders per day' : 'Revenue per day'}
            subtitle={`Last 30 days · ${last30.totals.orders} orders · ${money(last30.totals.revenue)}`}
            actions={
              <div className="tabs-pill tabs-pill-sm">
                {[
                  ['orders', 'Orders'],
                  ['revenue', 'Revenue'],
                ].map(([v, l]) => (
                  <button key={v} type="button" className={metric === v ? 'active' : ''} onClick={() => setMetric(v)}>
                    {l}
                  </button>
                ))}
              </div>
            }
            table={{ columns: ['Date', 'Orders', 'Revenue'], rows: last30.series.map((p) => [formatDateKey(p.date), p.orders, money(p.revenue)]) }}
          >
            {metric === 'orders' ? <ColumnChart data={last30.series} yKey="orders" name="Orders" height={290} /> : <TrendChart data={last30.series} yKey="revenue" name="Revenue" valueFormatter={money} height={290} />}
          </ChartCard>
        </div>
        <div className="col-xl-4">
          <div className="panel">
            <div className="panel-head">
              <h5>
                <i className="bi bi-list-check" /> Needs attention
              </h5>
            </div>
            {todos.length === 0 ? (
              <p className="small text-muted-2 mb-0">
                <i className="bi bi-check-circle text-success" /> All caught up.
              </p>
            ) : (
              <div className="todo-list">
                {todos.map((t) => (
                  <Link key={t.to} to={t.to} className={`todo ${t.tone}`}>
                    <span className="todo-icon">
                      <i className={`bi ${t.icon}`} />
                    </span>
                    <span className="min-w-0">
                      <strong>{t.text}</strong>
                      <span className="text-truncate">{t.sub}</span>
                    </span>
                    <i className="bi bi-chevron-right ms-auto" />
                  </Link>
                ))}
              </div>
            )}
            <div className="small fw-bold mt-3 mb-1">Orders by status · 30 days</div>
            <BarList data={statusRows} labelKey="label" valueKey="value" name="Orders" height={Math.max(120, statusRows.length * 26)} />
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-7">
          <div className="panel">
            <div className="panel-head">
              <h5>Recent orders</h5>
              <Link to="/admin/orders" className="link-arrow small">
                All orders <i className="bi bi-arrow-right" />
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Farmer</th>
                    <th>Status</th>
                    <th className="text-end">Total</th>
                    <th className="text-end">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o._id}>
                      <td>
                        <Link to={`/admin/orders/${o._id}`} className="fw-semi text-nowrap small">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="small text-nowrap">{o.customer?.name}</td>
                      <td className="small">{o.farmer?.stallName}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="text-end fw-semi small text-nowrap">{money(o.totalAmount)}</td>
                      <td className="text-end fs-7 text-muted-2 text-nowrap">{timeAgo(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="panel">
            <div className="panel-head">
              <h5>Most active farmers</h5>
              <Link to="/admin/purchases" className="link-arrow small">
                Customer purchases <i className="bi bi-arrow-right" />
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th className="text-end">Orders</th>
                    <th className="text-end">Revenue</th>
                    <th className="text-end">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topFarmers.map((f, i) => (
                    <tr key={f.farmerId}>
                      <td className="small">
                        <span className="text-muted-2 me-2">{i + 1}</span>
                        <Link to={`/farmers/${f.slug}`} className="fw-semi">
                          {f.farmer}
                        </Link>
                      </td>
                      <td className="text-end small">{f.orders}</td>
                      <td className="text-end fw-semi small text-nowrap">{money(f.revenue)}</td>
                      <td className="text-end small text-nowrap">
                        {f.reviews ? (
                          <>
                            {f.rating} <i className="bi bi-star-fill text-warning" />
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
