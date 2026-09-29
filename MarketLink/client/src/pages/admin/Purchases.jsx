import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { toQuery } from '../../api/client';
import { DashHeader } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import KpiCard from '../../components/common/KpiCard';
import { BarList, ChartCard, TrendChart } from '../../components/charts/Charts';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { dateCell, display, esc, link, moneyCell, muted } from '../../utils/cells';
import { formatDateKey, money, moneyCompact, ORDER_STATUS_META } from '../../utils/format';
import RefreshButton from '../../components/common/RefreshButton';

const FILTERS = [
  {
    name: 'status',
    label: 'Orders counted',
    wide: true,
    all: 'Completed (bought)',
    options: [{ value: 'all', label: 'All except cancelled' }, ...Object.entries(ORDER_STATUS_META).filter(([v]) => v !== 'completed').map(([value, m]) => ({ value, label: `Only ${m.label.toLowerCase()}` }))],
  },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
  { name: 'city', label: 'City', options: 'cities' },
  { name: 'market', label: 'Market', options: 'markets' },
  { name: 'farmer', label: 'Farmer', options: 'farmers' },
  { name: 'category', label: 'Category', options: 'categories' },
];

const PAIR_COLUMNS = [
  { data: 'customer', title: 'Customer', responsivePriority: 1, render: display((v, r) => `${link(`/admin/customers/${r.customerId}`, v, 'fw-semi small')}<div>${muted(r.city || r.email || '')}</div>`) },
  { data: 'farmer', title: 'Farmer', responsivePriority: 2, render: display((v) => `<span class="small fw-semi">${esc(v)}</span>`) },
  { data: 'orders', title: 'Orders', className: 'text-end' },
  { data: 'items', title: 'Items', className: 'text-end' },
  { data: 'amount', title: 'Amount', className: 'text-end', render: display(moneyCell) },
  { data: 'productSummary', title: 'What was bought', orderable: false, className: 'dt-comment', render: display((v) => `<span class="small">${esc(v)}</span>`) },
  { data: 'lastOrder', title: 'Last order', render: display((v) => dateCell(v)) },
];

const PRODUCT_COLUMNS = [
  { data: 'product', title: 'Product', render: display((v) => `<strong class="small">${esc(v)}</strong>`) },
  { data: 'farmer', title: 'Farmer', render: display((v) => `<span class="small">${esc(v)}</span>`) },
  { data: 'quantity', title: 'Quantity', className: 'text-end', render: display((v, r) => `${esc(v)} ${esc(r.unit)}`) },
  { data: 'customers', title: 'Customers', className: 'text-end' },
  { data: 'amount', title: 'Amount', className: 'text-end', render: display(moneyCell) },
];

/** Heat map of spend: top customers (rows) x top farmers (columns). */
function Matrix({ matrix }) {
  const max = Math.max(1, ...matrix.rows.flatMap((r) => r.cells));
  if (!matrix.rows.length) return <p className="small text-muted-2 mb-0">No purchases for these filters.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm heat-table mb-0">
        <thead>
          <tr>
            <th>Customer \ Farmer</th>
            {matrix.farmers.map((f) => (
              <th key={f} className="text-end" title={f}>
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.customerId}>
              <th scope="row">{r.customer}</th>
              {r.cells.map((v, i) => (
                <td key={matrix.farmers[i]} className="text-end" style={{ '--heat': v ? 0.12 + (v / max) * 0.7 : 0 }} title={`${r.customer} → ${matrix.farmers[i]}: ${money(v)}`}>
                  {v ? moneyCompact(v) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Which customer bought what, how much and from which farmer, with charts and exportable tables. */
export default function AdminPurchases() {
  useDocumentTitle('Customer purchases');
  const [filters, setFilters] = useState({ status: '', from: '', to: '', city: '', market: '', farmer: '', category: '' });
  const { data, loading, reload } = useFetch(`/admin/analytics/purchases${toQuery(filters)}`);

  return (
    <>
      <DashHeader title="Customer purchases" subtitle="Which customer bought what from which farmer, how often and for how much." actions={<RefreshButton onRefresh={reload} loading={loading} className="btn-sm" />} />
      <div className="table-card mb-3">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="row g-3 mb-3 kpi-row">
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard variant="accent" icon="bi-cash-stack" label="Amount" value={moneyCompact(data.totals.amount)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard icon="bi-receipt" label="Orders" value={data.totals.orders} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard icon="bi-basket" label="Items" value={data.totals.items} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard variant="info" icon="bi-people" label="Customers" value={data.totals.customers} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard variant="warn" icon="bi-shop" label="Farmers" value={data.totals.farmers} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard icon="bi-diagram-3" label="Buyer and farmer pairs" value={data.totals.pairs} />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-xl-4">
              <ChartCard title="Top customers" subtitle="by amount" table={{ columns: ['Customer', 'Farmers', 'Orders', 'Amount'], rows: data.byCustomer.map((c) => [c.customer, c.farmers, c.orders, money(c.amount)]) }}>
                <BarList data={data.byCustomer.slice(0, 7)} labelKey="customer" valueKey="amount" name="Amount" valueFormatter={moneyCompact} />
              </ChartCard>
            </div>
            <div className="col-xl-4">
              <ChartCard title="Top farmers" subtitle="by amount" table={{ columns: ['Farmer', 'Customers', 'Orders', 'Amount'], rows: data.byFarmer.map((f) => [f.farmer, f.customers, f.orders, money(f.amount)]) }}>
                <BarList data={data.byFarmer.slice(0, 7)} labelKey="farmer" valueKey="amount" name="Amount" valueFormatter={moneyCompact} />
              </ChartCard>
            </div>
            <div className="col-xl-4">
              <ChartCard title="Amount per day" subtitle={`${data.series.length} days with orders`} table={{ columns: ['Date', 'Orders', 'Amount'], rows: data.series.map((d) => [formatDateKey(d.date), d.orders, money(d.amount)]) }}>
                <TrendChart data={data.series} yKey="amount" name="Amount" valueFormatter={money} height={Math.max(200, Math.min(7, data.byCustomer.length) * 40 + 20)} />
              </ChartCard>
            </div>
          </div>

          <div className="panel mb-3">
            <div className="panel-head">
              <h5>
                <i className="bi bi-grid-3x3" /> Who buys from whom
              </h5>
              <span className="fs-7 text-muted-2">amount spent · top 8 customers × top 8 farmers</span>
            </div>
            <Matrix matrix={data.matrix} />
          </div>

          <div className="table-card mb-3">
            <div className="panel-head px-1">
              <h5>
                <i className="bi bi-people" /> Customer × farmer purchases
              </h5>
            </div>
            <DataGrid data={data.pairs} columns={PAIR_COLUMNS} order={[[4, 'desc']]} exportName="MarketLink customer purchases" searchPlaceholder="Customer, farmer or product…" />
          </div>

          <div className="table-card">
            <div className="panel-head px-1">
              <h5>
                <i className="bi bi-basket" /> Most bought products
              </h5>
            </div>
            <DataGrid data={data.topProducts} columns={PRODUCT_COLUMNS} order={[[4, 'desc']]} exportName="MarketLink top products" />
          </div>
        </>
      )}
    </>
  );
}
