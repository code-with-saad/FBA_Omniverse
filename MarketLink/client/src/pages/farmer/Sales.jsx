import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { toQuery } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import { PageLoader } from '../../components/common/Loader';
import { BarList, ChartCard, ColumnChart, TrendChart } from '../../components/charts/Charts';
import DataGrid from '../../components/admin/DataGrid';
import { dateCell, display, esc, moneyCell, muted } from '../../utils/cells';
import { DAY_NAMES, DAY_SHORT, formatDateKey, money, moneyCompact } from '../../utils/format';
import { categoryName, productName, t, unitName } from '../../i18n';
import RefreshButton from '../../components/common/RefreshButton';

const PRESETS = [
  [7, 'Last 7 days'],
  [30, 'Last 30 days'],
  [90, 'Last 90 days'],
  [365, 'Last 12 months'],
];

const PRODUCT_COLUMNS = [
  { data: 'product', title: 'Product', render: display((v) => `<strong class="small">${esc(v)}</strong>`) },
  { data: 'quantity', title: 'Sold', className: 'text-end', render: display((v, r) => `${esc(v)} <span class="fs-7 text-muted-2">${esc(unitName(r.unit))}</span>`) },
  { data: 'orders', title: 'Orders', className: 'text-end' },
  { data: 'revenue', title: 'Revenue', className: 'text-end', render: display(moneyCell) },
  { data: 'share', title: 'Share', className: 'text-end', render: display((v) => `<span class="share-bar" style="--w:${Math.min(100, v)}%">${esc(v)}%</span>`) },
];

const CUSTOMER_COLUMNS = [
  { data: 'customer', title: 'Customer', render: display((v, r) => `<strong class="small d-block">${esc(v)}</strong>${muted(r.city ? t(r.city) : '')}`) },
  { data: 'orders', title: 'Orders', className: 'text-end' },
  { data: 'revenue', title: 'Spent', className: 'text-end', render: display(moneyCell) },
  { data: 'last', title: 'Last order', render: display((v) => dateCell(v)) },
];

const change = (v) => (v === null || v === undefined ? t('no earlier data') : t('{v}% vs previous period', { v: `${v > 0 ? '+' : ''}${v}` }));

// An insight line from the server in the language in use (names, units and days translated too)
const insightText = (i) =>
  i.tpl ? t(i.tpl, { ...i.vars, product: productName({ name: i.vars.product, nameUr: i.vars.productUr }), unit: unitName(i.vars.unit), day: i.vars.dayIndex >= 0 ? DAY_NAMES[i.vars.dayIndex] : i.vars.day }) : i.text;

/** Sales insights for the farmer: what sells, where, when and to whom; printable and exportable. */
export default function FarmerSales() {
  useDocumentTitle(t('Sales report'));
  const { farmer } = useAuth();
  const [range, setRange] = useState({ days: 30, from: '', to: '' });
  const query = range.from && range.to ? { from: range.from, to: range.to } : { days: range.days };
  const { data, loading, reload } = useFetch(`/farmer/reports/sales${toQuery(query)}`);

  return (
    <div className="sales-report">
      <DashHeader
        title={t('Sales report')}
        subtitle={data ? `${farmer?.stallName || t('My stall')} · ${t('{from} to {to}', { from: formatDateKey(data.period.from, { withYear: true }), to: formatDateKey(data.period.to, { withYear: true }) })}` : t('Sales insights for your stall')}
        actions={
          <>
            <RefreshButton onRefresh={reload} loading={loading} className="btn-sm d-print-none" />
            <button type="button" className="btn btn-white btn-sm d-print-none" onClick={() => window.print()}>
              <i className="bi bi-printer" /> {t('Print report')}
            </button>
          </>
        }
      />
      <div className="panel mb-3 d-print-none">
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div className="tabs-pill">
            {PRESETS.map(([d, l]) => (
              <button key={d} type="button" className={!range.from && range.days === d ? 'active' : ''} onClick={() => setRange({ days: d, from: '', to: '' })}>
                {t(l)}
              </button>
            ))}
          </div>
          <label className="filter-field is-date">
            <span>{t('From')}</span>
            <input type="date" className="form-control form-control-sm" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="filter-field is-date">
            <span>{t('To')}</span>
            <input type="date" className="form-control form-control-sm" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
        </div>
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="row g-2 g-xl-3 mb-3 kpi-row">
            <div className="col-6 col-md-4 col-xxl-2">
              <KpiCard variant="accent" icon="bi-cash-stack" label={t('Revenue')} value={moneyCompact(data.kpis.revenue)} sub={change(data.kpis.revenueChange)} />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <KpiCard icon="bi-receipt" label={t('Completed orders')} value={data.kpis.orders} sub={change(data.kpis.ordersChange)} />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <KpiCard icon="bi-basket" label={t('Items sold')} value={data.kpis.items} sub={t('avg order {v1}', { v1: money(data.kpis.averageOrder) })} />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <KpiCard variant="info" icon="bi-people" label={t('Customers')} value={data.kpis.customers} sub={t('{repeatCustomers} returning · {newCustomers} new', { repeatCustomers: data.kpis.repeatCustomers, newCustomers: data.kpis.newCustomers })} />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <KpiCard variant="warn" icon="bi-hourglass-split" label={t('Open pre-orders')} value={data.kpis.openOrders} sub={t('{v1} to collect', { v1: money(data.kpis.openValue) })} />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <KpiCard variant="danger" icon="bi-x-circle" label={t('Cancelled / declined')} value={data.kpis.cancelled} sub={t('{cancellationRate}% of pre-orders', { cancellationRate: data.kpis.cancellationRate })} />
            </div>
          </div>

          {data.insights.length > 0 && (
            <div className="panel mb-3">
              <div className="panel-head">
                <h5>
                  <i className="bi bi-lightbulb" /> {t('Insights')}
                </h5>
              </div>
              <ul className="insight-list">
                {data.insights.map((i) => (
                  <li key={i.text}>
                    <i className={`bi ${i.icon}`} aria-hidden="true" /> {insightText(i)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="row g-3 mb-3">
            <div className="col-xl-8">
              <ChartCard title={t('Revenue per day')} subtitle={t('completed orders, paid at pickup')} table={{ columns: ['Date', 'Orders', 'Revenue'], rows: data.series.map((d) => [formatDateKey(d.date), d.orders, money(d.revenue)]) }}>
                <TrendChart data={data.series} yKey="revenue" name="Revenue" valueFormatter={money} height={240} />
              </ChartCard>
            </div>
            <div className="col-xl-4">
              <ChartCard title={t('Sales by category')} table={{ columns: ['Category', 'Items', 'Revenue'], rows: data.categories.map((c) => [categoryName({ name: c.category, nameUr: c.categoryUr, slug: c.slug }), c.quantity, money(c.revenue)]) }}>
                {data.categories.length ? <BarList data={data.categories.map((c) => ({ ...c, category: categoryName({ name: c.category, nameUr: c.categoryUr, slug: c.slug }) }))} labelKey="category" valueKey="revenue" name="Revenue" valueFormatter={moneyCompact} /> : <p className="small text-muted-2 mb-0">{t('No sales in this period.')}</p>}
              </ChartCard>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6 col-xl-4">
              <ChartCard title={t('Pickup days')} subtitle={t('completed orders by weekday')} table={{ columns: ['Day', 'Orders', 'Revenue'], rows: data.weekdays.map((d, i) => [DAY_NAMES[i], d.orders, money(d.revenue)]) }}>
                <ColumnChart data={data.weekdays.map((d, i) => ({ ...d, label: DAY_SHORT[i] }))} xKey="label" yKey="orders" name="Orders" dateAxis={false} height={200} />
              </ChartCard>
            </div>
            <div className="col-lg-6 col-xl-4">
              <ChartCard title={t('Pickup times')} subtitle={t('orders by slot hour')} table={{ columns: ['Hour', 'Orders'], rows: data.slots.map((s) => [`${s.hour}:00`, s.orders]) }}>
                <ColumnChart data={data.slots.map((s) => ({ ...s, label: `${s.hour}:00` }))} xKey="label" yKey="orders" name="Orders" dateAxis={false} height={200} />
              </ChartCard>
            </div>
            <div className="col-xl-4">
              <ChartCard title={t('Markets')} subtitle={t('revenue by pickup market')} table={{ columns: ['Market', 'Orders', 'Revenue'], rows: data.markets.map((m) => [m.market, m.orders, money(m.revenue)]) }}>
                {data.markets.length ? <BarList data={data.markets} labelKey="market" valueKey="revenue" name="Revenue" valueFormatter={moneyCompact} /> : <p className="small text-muted-2 mb-0">{t('No sales in this period.')}</p>}
              </ChartCard>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-xl-7">
              <div className="table-card">
                <div className="panel-head px-3 pt-3">
                  <h5>
                    <i className="bi bi-basket" /> {t('Products')}
                  </h5>
                </div>
                <DataGrid data={data.products} columns={PRODUCT_COLUMNS} order={[[3, 'desc']]} exportName="Sales by product" />
              </div>
            </div>
            <div className="col-xl-5">
              <div className="table-card">
                <div className="panel-head px-3 pt-3">
                  <h5>
                    <i className="bi bi-people" /> {t('Customers')}
                  </h5>
                </div>
                <DataGrid data={data.customers} columns={CUSTOMER_COLUMNS} order={[[2, 'desc']]} exportName="Sales by customer" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
