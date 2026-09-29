import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import StatusBadge from '../../components/common/StatusBadge';
import { PageLoader } from '../../components/common/Loader';
import { BarList, ChartCard, TrendChart } from '../../components/charts/Charts';
import { formatDateKey, money, moneyCompact, ORDER_STATUS_META, time12 } from '../../utils/format';
import { productName, t, unitName } from '../../i18n';
import RefreshButton from '../../components/common/RefreshButton';
import MarketDay from '../../components/farmer/MarketDay';

export function ApprovalBanner({ status }) {
  if (status === 'active') return null;
  const pending = status === 'pending';
  return (
    <div className="approval-banner" style={pending ? undefined : { background: '#fdecea', borderColor: '#f6c9c3' }}>
      <span className="banner-icon" aria-hidden="true">
        <i className={`bi ${pending ? 'bi-hourglass-split' : 'bi-slash-circle'}`} />
      </span>
      <div>
        <strong>{pending ? t('Your stall is waiting for admin approval') : t('Your stall is suspended')}</strong>
        <div className="small text-muted-2">
          {pending
            ? t('Meanwhile, complete your stall profile (logo, bio, markets and map pin). Weekly stock, pre-orders and pickup times open as soon as an admin approves you.')
            : t('Your products are hidden from customers. Please contact the MarketLink team for details.')}
        </div>
      </div>
    </div>
  );
}

/** Farmers see their approval status until an admin approves them, then their insights. */
export default function FarmerDashboard() {
  const { user } = useAuth();
  return user?.status === 'active' ? <FarmerInsights /> : <FarmerWaiting status={user?.status} />;
}

function FarmerWaiting({ status }) {
  useDocumentTitle(t('Approval status'));
  const { data } = useFetch('/farmer/me');
  const f = data?.farmer;
  const checks = f
    ? [
        { done: Boolean(f.bio), label: t('Tell customers about your farm'), hint: t('About your farm') },
        { done: Boolean(f.logo), label: t('Upload your stall logo'), hint: t('Logo') },
        { done: f.categories?.length > 0, label: t('Choose what you grow or sell'), hint: t('Categories') },
        { done: f.markets?.length > 0, label: t('Pick the markets where you sell'), hint: t('Markets') },
        { done: f.latitude != null, label: t('Drop a map pin for your farm or stall'), hint: t('Map pin') },
      ]
    : [];
  const done = checks.filter((c) => c.done).length;
  const suspended = status === 'suspended';

  return (
    <>
      <DashHeader title={f?.stallName || t('My stall')} subtitle={suspended ? t('Your stall is suspended.') : t('Your registration is being reviewed by the MarketLink team.')} />
      <ApprovalBanner status={status} />
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="panel">
            <div className="panel-head">
              <h5>
                <i className="bi bi-signpost-split" /> {t('What happens next')}
              </h5>
            </div>
            <ol className="approval-steps">
              <li className="done">
                <strong>{t('Registration received')}</strong>
                <span>{t('Your account and stall were created.')}</span>
              </li>
              <li className={suspended ? 'blocked' : 'current'}>
                <strong>{suspended ? t('Suspended by the admin') : t('Admin review')}</strong>
                <span>{suspended ? t('Contact the MarketLink team to re-activate your stall.') : t('An admin checks your details. You get an e-mail when you are approved.')}</span>
              </li>
              <li>
                <strong>{t('Start selling')}</strong>
                <span>{t('Add your weekly stock, pickup windows and accept pre-orders.')}</span>
              </li>
            </ol>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="panel">
            <div className="panel-head">
              <h5>
                <i className="bi bi-list-check" /> {t('Stall profile')}
              </h5>
              {checks.length > 0 && (
                <span className="chip chip-soft">
                  <bdi dir="ltr">{done}/{checks.length}</bdi> {t('done')}
                </span>
              )}
            </div>
            <ul className="profile-checks">
              {checks.map((c) => (
                <li key={c.label} className={c.done ? 'done' : ''}>
                  <i className={`bi ${c.done ? 'bi-check-circle-fill' : 'bi-circle'}`} aria-hidden="true" /> {t(c.label)}
                </li>
              ))}
            </ul>
            <Link to="/farmer/profile" className="btn btn-primary btn-sm">
              <i className="bi bi-pencil" /> {t('Complete stall profile')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function FarmerInsights() {
  useDocumentTitle(t('Farmer dashboard'));
  const { farmer } = useAuth();
  const [days, setDays] = useState(30);
  const { data, loading, reload } = useFetch(`/farmer/insights?days=${days}`);
  if (loading && !data) return <PageLoader />;
  const { kpis, series, bestSellers, statusCounts, upcoming, status } = data;
  const statusRows = Object.entries(statusCounts).map(([s, n]) => ({ label: ORDER_STATUS_META[s].label, value: n }));

  return (
    <>
      <DashHeader
        title={farmer?.stallName || t('My stall')}
        subtitle={t('Sales, orders and insights for your stall.')}
        actions={
          <>
            <RefreshButton onRefresh={reload} loading={loading} />
            <Link to="/farmer/orders" className="btn btn-white">
              <i className="bi bi-receipt" /> {t('Pre-orders')} {kpis.pendingOrders > 0 && <span className="badge bg-carrot">{kpis.pendingOrders}</span>}
            </Link>
            <Link to="/farmer/products" className="btn btn-primary">
              <i className="bi bi-plus-lg" /> {t('Update weekly stock')}
            </Link>
          </>
        }
      />
      <ApprovalBanner status={status} />
      <MarketDay />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl">
          <KpiCard variant="accent" icon="bi-cash-stack" label={t('Revenue (30 days)')} value={moneyCompact(kpis.revenueMonth)} sub={t('{v1} this week', { v1: money(kpis.revenueWeek) })} />
        </div>
        <div className="col-6 col-xl">
          <KpiCard icon="bi-receipt" label={t('Total orders')} value={kpis.totalOrders} sub={t('{n} completed', { n: kpis.completedOrders })} />
        </div>
        <div className="col-6 col-xl">
          <KpiCard variant="warn" icon="bi-hourglass-split" label={t('Pending orders')} value={kpis.pendingOrders} sub={t('{activeOrders} open in total', { activeOrders: kpis.activeOrders })} />
        </div>
        <div className="col-6 col-xl">
          <KpiCard variant="info" icon="bi-graph-up" label={t('Average order')} value={money(Math.round(kpis.averageOrder))} sub={t('{v1} in total', { v1: money(kpis.revenueTotal) })} />
        </div>
        <div className="col-12 col-xl">
          <KpiCard icon="bi-star" label={t('Rating')} value={kpis.ratingCount ? <bdi dir="ltr">{kpis.rating} / 5</bdi> : '-'} sub={t('{n} reviews', { n: kpis.ratingCount })} />
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <ChartCard
            title={t('Revenue from completed orders')}
            subtitle={t('Daily, last {days} days · paid at pickup', { days })}
            actions={
              <select className="form-select form-select-sm w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('Range')}>
                <option value={7}>{t('7 days')}</option>
                <option value={30}>{t('30 days')}</option>
                <option value={90}>{t('90 days')}</option>
              </select>
            }
            table={{ columns: ['Date', 'Orders', 'Revenue'], rows: series.filter((p) => p.orders).map((p) => [formatDateKey(p.date), p.orders, money(p.revenue)]) }}
          >
            <TrendChart data={series} yKey="revenue" name="Revenue" valueFormatter={money} />
          </ChartCard>
        </div>
        <div className="col-xl-4">
          <div className="panel">
            <div className="panel-head">
              <h5>{t('Revenue summary')}</h5>
            </div>
            <div className="info-row">
              <span>{t('Last 7 days')}</span>
              <span>{money(kpis.revenueWeek)}</span>
            </div>
            <div className="info-row">
              <span>{t('Last 30 days')}</span>
              <span>{money(kpis.revenueMonth)}</span>
            </div>
            <div className="info-row">
              <span>{t('All time')}</span>
              <span>{money(kpis.revenueTotal)}</span>
            </div>
            <div className="info-row">
              <span>{t('Products listed')}</span>
              <span>{kpis.productsListed}</span>
            </div>
            <div className="info-row">
              <span>{t('Sold out now')}</span>
              <span className={kpis.productsSoldOut ? 'text-danger' : ''}>{kpis.productsSoldOut}</span>
            </div>
            <Link to="/farmer/products?status=sold_out" className="btn btn-soft btn-sm w-100 mt-3">
              {t('Restock sold-out items')}
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-6">
          <ChartCard title={t('Best-selling products')} subtitle={t('Units sold in completed orders')} table={{ columns: ['Product', 'Units', 'Revenue'], rows: bestSellers.map((b) => [productName(b), `${b.quantity} ${unitName(b.unit)}`, money(b.revenue)]) }}>
            {bestSellers.length ? <BarList data={bestSellers.map((b) => ({ ...b, name: productName(b) }))} labelKey="name" valueKey="quantity" name="Units sold" /> : <p className="small text-muted-2">{t('No completed sales yet.')}</p>}
          </ChartCard>
        </div>
        <div className="col-xl-6">
          <ChartCard title={t('Orders by status')} subtitle={t('All-time')} table={{ columns: ['Status', 'Orders'], rows: statusRows.map((r) => [r.label, r.value]) }}>
            <BarList data={statusRows} labelKey="label" valueKey="value" name="Orders" />
          </ChartCard>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h5>{t('Upcoming pickups')}</h5>
          <Link to="/farmer/orders" className="link-arrow small">
            {t('Manage pre-orders')} <i className="bi bi-arrow-right" />
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="small text-muted-2 mb-0">{t('No upcoming pickups.')}</p>
        ) : (
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>{t('Order')}</th>
                  <th>{t('Customer')}</th>
                  <th>{t('Pickup')}</th>
                  <th>{t('Status')}</th>
                  <th className="text-end">{t('Total')}</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <Link to={`/farmer/orders?focus=${o._id}`} className="fw-semi text-nowrap">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td>{o.customer?.name}</td>
                    <td className="small">
                      {formatDateKey(o.pickupDate)} · {time12(o.pickupSlot.start)}
                      <div className="fs-7 text-muted-2">{o.market?.name}</div>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="text-end fw-semi">{money(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
