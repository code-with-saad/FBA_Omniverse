import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import { PageLoader } from '../../components/common/Loader';
import { BarList, ChartCard, ColumnChart, TrendChart } from '../../components/charts/Charts';
import DataGrid from '../../components/admin/DataGrid';
import { display, esc, moneyCell } from '../../utils/cells';
import { formatDate, formatDateKey, money, moneyCompact, ORDER_STATUS_META, toDateKey } from '../../utils/format';
import SearchSelect from '../../components/common/SearchSelect';
import RefreshButton from '../../components/common/RefreshButton';

/** Turns the report into rows for the table view and CSV export. */
function reportTable(report) {
  const d = report.data;
  if (d.columns) return { columns: d.columns.map((c) => c.label), rows: d.rows.map((r) => d.columns.map((c) => r[c.key])) };
  switch (report.reportType) {
    case 'revenue_by_market':
      return { columns: ['Market', 'City', 'Orders', 'Completed', 'Revenue', 'Share %'], rows: d.rows.map((r) => [r.market, r.city, r.orders, r.completed, r.revenue, r.share]) };
    case 'top_farmers':
      return {
        columns: ['Farmer', 'Orders', 'Completed', 'Items sold', 'Revenue', 'Products', 'Rating'],
        rows: d.rows.map((r) => [r.farmer, r.orders, r.completed, r.itemsSold, r.revenue, r.products, r.rating]),
      };
    default:
      return { columns: ['Date', 'Orders', 'Revenue'], rows: d.series.map((p) => [p.date, p.orders, p.revenue]) };
  }
}

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvLines = (report) => {
  const { columns, rows } = reportTable(report);
  return [columns, ...rows].map((r) => r.map(csvEscape).join(','));
};

function saveCsv(lines, name) {
  const url = URL.createObjectURL(new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(report) {
  saveCsv(csvLines(report), `marketlink-${report.reportType}-${toDateKey(new Date(report.generatedAt))}.csv`);
}

function StatusTable({ byStatus }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h5>Orders by status</h5>
      </div>
      {Object.entries(byStatus).map(([s, n]) => (
        <div key={s} className="info-row">
          <span>{ORDER_STATUS_META[s].label}</span>
          <span>{n}</span>
        </div>
      ))}
    </div>
  );
}

// KPI cards of the table-based reports (sales by category, customers, inventory, cities, reviews)
const TOTAL_META = {
  revenue: ['Revenue (completed)', 'bi-cash-stack', 'money'],
  items: ['Items sold', 'bi-basket'],
  categories: ['Categories', 'bi-tags'],
  customers: ['Customers', 'bi-people'],
  active: ['Ordered in period', 'bi-bag-check'],
  newCustomers: ['New customers', 'bi-person-plus'],
  repeat: ['Repeat customers', 'bi-arrow-repeat'],
  orders: ['Orders', 'bi-receipt'],
  products: ['Products', 'bi-basket'],
  lowStock: ['Low stock', 'bi-exclamation-triangle'],
  soldOut: ['Sold out', 'bi-x-circle'],
  units: ['Units in stock', 'bi-box-seam'],
  stockValue: ['Stock value', 'bi-wallet2', 'money'],
  cities: ['Cities', 'bi-buildings'],
  activeCities: ['Cities with orders', 'bi-geo-alt'],
  reviews: ['Reviews', 'bi-chat-square-quote'],
  averageRating: ['Average rating', 'bi-star'],
  removedReviews: ['Removed reviews', 'bi-eye-slash'],
  reports: ['Content reports', 'bi-flag'],
  openReports: ['Open reports', 'bi-hourglass-split'],
  resolvedReports: ['Handled reports', 'bi-check2-circle'],
  productsSold: ['Products sold', 'bi-basket2'],
  notSold: ['Not sold in period', 'bi-dash-circle'],
  pickups: ['Pickups', 'bi-calendar-check'],
  busiestDay: ['Busiest day', 'bi-calendar-week'],
  busiestHour: ['Busiest hour', 'bi-clock'],
  cancelled: ['Cancelled', 'bi-x-circle'],
  declined: ['Declined', 'bi-slash-circle'],
  cancelRate: ['Cancel rate', 'bi-percent', 'pct'],
  lostValue: ['Order value lost', 'bi-cash', 'money'],
  problems: ['Problems reported', 'bi-exclamation-octagon'],
  openProblems: ['Still open', 'bi-hourglass-split'],
  newPickups: ['New pickups arranged', 'bi-calendar-plus'],
  solved: ['Sorted out', 'bi-check2-circle'],
  problemValue: ['Value of those orders', 'bi-cash', 'money'],
  marketDays: ['Market days', 'bi-calendar-week'],
  attended: ['Came (checked in)', 'bi-geo-alt-fill'],
  absent: ['Did not come', 'bi-x-circle'],
  noCheckIn: ['No check-in', 'bi-question-circle'],
  attendanceRate: ['Attendance', 'bi-graph-up', 'pct'],
  pickupsOnAbsentDays: ['Pickups on missed days', 'bi-bag-x'],
  onOffer: ['Products on offer', 'bi-tag'],
  averageOff: ['Average discount', 'bi-percent', 'pct'],
  biggestOff: ['Biggest discount', 'bi-tags', 'pct'],
  farmersWithOffers: ['Farmers with offers', 'bi-shop'],
  applications: ['Sign-ups in period', 'bi-person-plus'],
  approvedInPeriod: ['Approved', 'bi-patch-check'],
  waitingNow: ['Waiting for approval now', 'bi-hourglass-split'],
  farmersActive: ['Approved farmers (all)', 'bi-shop'],
  requests: ['People waiting (all)', 'bi-bell'],
  requestsInPeriod: ['Asked in period', 'bi-bell-fill'],
  productsWanted: ['Products wanted', 'bi-basket'],
  soldOutWanted: ['Wanted and sold out', 'bi-exclamation-triangle'],
  newFarmers: ['New farmers', 'bi-shop'],
  subscribers: ['Newsletter subscribers', 'bi-envelope-paper'],
  newSubscribers: ['New subscribers', 'bi-envelope-plus'],
  messages: ['Contact messages', 'bi-chat-dots'],
  unreadMessages: ['Unread messages', 'bi-envelope-exclamation'],
};
const kpiValue = (kind, v) => (kind === 'money' ? moneyCompact(v) : kind === 'pct' ? `${v}%` : v);
const VARIANTS = ['accent', '', 'info', 'warn', '', 'danger'];

function GenericReport({ report }) {
  const d = report.data;
  const chart = d.chart;
  const chartData = chart ? (chart.data ? d[chart.data] : d.rows).filter((r) => r[chart.value] > 0).slice(0, chart.top || 12) : [];
  const columns = d.columns.map((c) => ({
    data: c.key,
    title: c.label,
    className: c.num || c.money ? 'text-end' : '',
    render: c.money ? display(moneyCell) : c.key === d.columns[0].key ? display((v) => `<strong class="small">${esc(v)}</strong>`) : undefined,
  }));
  const totals = Object.entries(d.totals).filter(([k]) => TOTAL_META[k]);
  const col = totals.length > 4 ? 'col-6 col-md-4 col-xl-2' : totals.length === 4 ? 'col-6 col-lg-3' : 'col-6 col-md-4';
  return (
    <>
      <div className="row g-2 g-xl-3 mb-3 kpi-row">
        {totals.map(([k, v], i) => {
          const [label, icon, kind] = TOTAL_META[k];
          return (
            <div key={k} className={col}>
              <KpiCard variant={VARIANTS[i % VARIANTS.length] || undefined} icon={icon} label={label} value={kpiValue(kind, v)} />
            </div>
          );
        })}
      </div>
      <div className="row g-3">
        {chart && (
          <div className="col-xl-4">
            <ChartCard className="h-100" title={chart.title || (chart.data ? 'Reviews by rating' : `${chart.name} by ${chart.label}`)} subtitle={chart.top ? `Top ${chart.top}` : undefined}>
              {chartData.length ? <BarList data={chartData} labelKey={chart.label} valueKey={chart.value} name={chart.name} valueFormatter={chart.money ? moneyCompact : undefined} /> : <p className="small text-muted-2 mb-0">No data in this period.</p>}
            </ChartCard>
          </div>
        )}
        <div className={chart ? 'col-xl-8' : 'col-12'}>
          <div className="table-card h-100">
            <DataGrid key={report._id || report.generatedAt} data={d.rows} columns={columns} order={[]} exportName={report.title} pageLength={10} emptyText="Nothing in this period" />
          </div>
        </div>
      </div>
    </>
  );
}

function ReportView({ report }) {
  const d = report.data;
  const t = d.totals;
  const table = reportTable(report);

  if (d.columns) return <GenericReport report={report} />;

  if (report.reportType === 'revenue_by_market') {
    return (
      <>
        <div className="row g-3 mb-4">
          <div className="col-md-4"><KpiCard variant="accent" icon="bi-cash-stack" label="Revenue (completed)" value={moneyCompact(t.revenue)} /></div>
          <div className="col-md-4"><KpiCard icon="bi-receipt" label="Orders" value={t.orders} /></div>
          <div className="col-md-4"><KpiCard variant="info" icon="bi-geo-alt" label="Markets" value={t.markets} /></div>
        </div>
        <ChartCard title="Revenue by market" subtitle="Completed orders in the selected period" table={{ columns: table.columns, rows: table.rows.map((r) => [r[0], r[1], r[2], r[3], money(r[4]), `${r[5]}%`]) }}>
          <BarList data={d.rows} labelKey="market" valueKey="revenue" name="Revenue" valueFormatter={money} />
        </ChartCard>
      </>
    );
  }

  if (report.reportType === 'top_farmers') {
    return (
      <>
        <div className="row g-3 mb-4">
          <div className="col-md-6"><KpiCard variant="accent" icon="bi-shop" label="Farmers" value={t.farmers} /></div>
          <div className="col-md-6"><KpiCard icon="bi-activity" label="Farmers with orders" value={t.activeSellers} /></div>
        </div>
        <div className="row g-4">
          <div className="col-xl-5">
            <ChartCard title="Most active farmers" subtitle="Orders in the selected period">
              <BarList data={d.rows.slice(0, 10)} labelKey="farmer" valueKey="orders" name="Orders" />
            </ChartCard>
          </div>
          <div className="col-xl-7">
            <div className="table-card">
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th>Farmer</th>
                      <th className="text-end">Orders</th>
                      <th className="text-end">Completed</th>
                      <th className="text-end">Items</th>
                      <th className="text-end">Revenue</th>
                      <th className="text-end">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.farmerId}>
                        <td className="fw-semi small">{r.farmer}</td>
                        <td className="text-end">{r.orders}</td>
                        <td className="text-end">{r.completed}</td>
                        <td className="text-end">{r.itemsSold}</td>
                        <td className="text-end">{money(r.revenue)}</td>
                        <td className="text-end">{r.reviews ? r.rating : '-'}</td>
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

  // platform_overview and orders_summary
  return (
    <>
      <div className="row g-3 mb-4">
        {report.reportType === 'platform_overview' && (
          <>
            <div className="col-6 col-lg-3"><KpiCard variant="accent" icon="bi-people" label="Customers" value={t.customers} sub={`${t.newCustomers} new in period`} /></div>
            <div className="col-6 col-lg-3"><KpiCard icon="bi-shop" label="Approved farmers" value={t.farmersActive} sub={`${t.farmersPending} pending`} /></div>
            <div className="col-6 col-lg-3"><KpiCard variant="info" icon="bi-geo-alt" label="Markets" value={t.markets} /></div>
            <div className="col-6 col-lg-3"><KpiCard icon="bi-basket" label="Products" value={t.products} /></div>
          </>
        )}
        <div className="col-6 col-lg-3"><KpiCard icon="bi-receipt" label="Orders" value={t.orders} /></div>
        <div className="col-6 col-lg-3"><KpiCard icon="bi-check2-circle" label="Completed" value={t.completed} /></div>
        <div className="col-6 col-lg-3"><KpiCard variant="warn" icon="bi-cash-stack" label="Revenue" value={moneyCompact(t.revenue)} /></div>
        <div className="col-6 col-lg-3"><KpiCard variant="info" icon="bi-graph-up" label="Average order" value={money(Math.round(t.averageOrder))} /></div>
      </div>
      <div className="row g-4">
        <div className="col-xl-8 d-grid gap-4">
          <ChartCard title="Orders per day" table={{ columns: table.columns, rows: d.series.map((p) => [formatDateKey(p.date), p.orders, money(p.revenue)]) }}>
            <ColumnChart data={d.series} yKey="orders" name="Orders" />
          </ChartCard>
          <ChartCard title="Revenue per day" subtitle="Completed orders">
            <TrendChart data={d.series} yKey="revenue" name="Revenue" valueFormatter={money} />
          </ChartCard>
        </div>
        <div className="col-xl-4">
          <StatusTable byStatus={d.byStatus} />
        </div>
      </div>
    </>
  );
}

function SavedReports() {
  const { toast } = useToast();
  const { data, reload } = useFetch('/admin/reports');
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 29);
  const [form, setForm] = useState({ reportType: 'orders_summary', from: toDateKey(monthAgo), to: toDateKey(today) });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  // Show the latest saved report on first load
  useEffect(() => {
    if (!report && data?.reports?.[0]) api.get(`/admin/reports/${data.reports[0]._id}`).then((r) => setReport(r.report)).catch(() => {});
  }, [data, report]);

  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/admin/reports', form);
      setReport(res.report);
      toast('Report generated and saved');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function open(id) {
    const res = await api.get(`/admin/reports/${id}`);
    setReport(res.report);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id) {
    await api.del(`/admin/reports/${id}`);
    if (report?._id === id) setReport(null);
    reload();
  }

  if (!data) return <PageLoader />;
  return (
    <div className="report-print">
      <p className="small text-muted-2 no-print">Save one report for a period to keep it as it was on that day, then open or compare it later.</p>
      <form className="panel mb-4 no-print" onSubmit={generate}>
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label" htmlFor="rp-type">Report type</label>
            <SearchSelect
              id="rp-type"
              value={form.reportType}
              onChange={(v) => setForm({ ...form, reportType: v })}
              ariaLabel="Report type"
              options={data.types.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="rp-from">From</label>
            <input id="rp-from" type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="rp-to">To</label>
            <input id="rp-to" type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary w-100" disabled={busy}>
              {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-lightning-charge" />} Generate
            </button>
          </div>
        </div>
      </form>

      {report && (
        <section className="mb-5">
          <div className="d-flex align-items-end justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <span className="eyebrow">Report</span>
              <h2 className="h3 mb-0">{report.title}</h2>
              <div className="small text-muted-2">
                {formatDate(report.from)} to {formatDate(report.to)} · generated {formatDate(report.generatedAt, { time: true })}
                {report.generatedBy?.name && ` by ${report.generatedBy.name}`}
              </div>
            </div>
            <div className="d-flex gap-2 no-print">
              <button type="button" className="btn btn-white btn-sm" onClick={() => downloadCsv(report)}>
                <i className="bi bi-filetype-csv" /> Export CSV
              </button>
              <button type="button" className="btn btn-white btn-sm" onClick={() => window.print()}>
                <i className="bi bi-printer" /> Print / PDF
              </button>
            </div>
          </div>
          <ReportView report={report} />
        </section>
      )}

      <div className="table-card no-print">
        <div className="table-toolbar">
          <strong>Saved reports</strong>
        </div>
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Report</th>
                <th>Period</th>
                <th>Generated</th>
                <th>By</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => (
                <tr key={r._id} className={report?._id === r._id ? 'table-active' : ''}>
                  <td className="fw-semi small">{r.title}</td>
                  <td className="small">
                    {formatDate(r.from)} to {formatDate(r.to)}
                  </td>
                  <td className="small">{formatDate(r.generatedAt, { time: true })}</td>
                  <td className="small">{r.generatedBy?.name}</td>
                  <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-sm btn-soft" onClick={() => open(r._id)}>
                      Open
                    </button>{' '}
                    <button type="button" className="btn btn-sm btn-white btn-icon" onClick={() => remove(r._id)} aria-label="Delete report">
                      <i className="bi bi-trash3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- every report on one page

const SECTIONS = [
  ['platform_overview', 'bi-speedometer2', 'Customers, farmers, markets and products, with orders and revenue per day and orders by status.'],
  ['revenue_by_market', 'bi-geo-alt', 'Orders and completed revenue for every market.'],
  ['sales_by_category', 'bi-tags', 'What sells: completed revenue and items per category.'],
  ['product_performance', 'bi-basket2', 'Every product that sold in the period, best first.'],
  ['top_farmers', 'bi-shop', 'Orders, items and revenue per farmer, with their rating.'],
  ['customer_activity', 'bi-people', 'Who orders, how often and how much they spend.'],
  ['city_overview', 'bi-buildings', 'Markets, farmers, customers, orders and revenue per city.'],
  ['pickup_times', 'bi-clock-history', 'When customers collect: pickups per weekday and per hour.'],
  ['cancellations', 'bi-x-octagon', 'Orders declined by farmers or cancelled, per farmer, with the reasons given.'],
  ['pickup_problems', 'bi-exclamation-octagon', 'Pre-orders customers said they did not receive and how each ended.'],
  ['market_attendance', 'bi-calendar2-check', 'Did farmers come to their market days? Absences with reasons.'],
  ['inventory_status', 'bi-box-seam', 'Stock of every product right now: low, sold out and stock value.'],
  ['offers', 'bi-percent', 'Products on offer right now and their discounts.'],
  ['reviews_moderation', 'bi-chat-square-quote', 'Reviews and ratings per farmer, removed reviews and content reports.'],
  ['farmer_signups', 'bi-person-plus', 'Farmers who signed up in the period and whether they are approved.'],
  ['demand', 'bi-bell', '"Remind me when available" requests: what customers are waiting for.'],
  ['engagement', 'bi-envelope-paper', 'New customers, farmers, newsletter sign-ups, messages and reviews per week.'],
];

const daysBack = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
};

/** Renders its children once they come near the screen (the page has many charts and tables). */
function WhenVisible({ children, force, minHeight = 320 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || force) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, force]);
  return <div ref={ref}>{seen || force ? children : <div style={{ minHeight }} className="report-placeholder" aria-hidden="true" />}</div>;
}

function AllReports() {
  const { toast } = useToast();
  const [range, setRange] = useState({ from: daysBack(29), to: toDateKey() });
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState('');
  const [shownUpTo, setShownUpTo] = useState(-1); // sections above the one picked in the list are drawn first

  // Jump to a report: draw the reports above it first (so nothing moves), then scroll, and once more after the tables settle
  function jumpTo(index) {
    setShownUpTo((n) => Math.max(n, index));
    const go = (behavior) => document.getElementById(`rep-${SECTIONS[index][0]}`)?.scrollIntoView({ behavior, block: 'start' });
    setTimeout(() => go('smooth'), 60);
    setTimeout(() => {
      const top = document.getElementById(`rep-${SECTIONS[index][0]}`)?.getBoundingClientRect().top ?? 0;
      if (Math.abs(top - 125) > 40) go('auto');
    }, 900);
  }
  const { data, loading, reload, error } = useFetch(`/admin/reports/all?from=${range.from}&to=${range.to}`);

  const reportOf = (type) => ({ _id: `${type}-${range.from}-${range.to}-${data.generatedAt}`, reportType: type, title: data.titles[type], data: data.sections[type], generatedAt: data.generatedAt });

  function downloadAll() {
    const lines = [`"MarketLink platform reports, ${range.from} to ${range.to}"`];
    for (const [type] of SECTIONS) lines.push('', csvEscape(data.titles[type]), ...csvLines(reportOf(type)));
    saveCsv(lines, `marketlink-all-reports-${range.from}-to-${range.to}.csv`);
  }

  function printAll() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 700);
  }

  async function save(type) {
    setSaving(type);
    try {
      await api.post('/admin/reports', { reportType: type, ...range });
      toast(`${data.titles[type]} saved. Find it under Saved reports.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving('');
    }
  }

  const quick = [
    [6, 'Last 7 days'],
    [29, 'Last 30 days'],
    [89, 'Last 90 days'],
    [364, 'Last 12 months'],
  ];

  return (
    <div className="report-print">
      <div className="panel mb-3 report-range no-print">
        <label>
          <span className="small fw-semi d-block">From</span>
          <input type="date" className="form-control" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
        </label>
        <label>
          <span className="small fw-semi d-block">To</span>
          <input type="date" className="form-control" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
        </label>
        <div className="att-quick">
          {quick.map(([n, l]) => (
            <button key={n} type="button" className={`btn btn-sm ${range.from === daysBack(n) && range.to === toDateKey() ? 'btn-primary' : 'btn-white'}`} onClick={() => setRange({ from: daysBack(n), to: toDateKey() })}>
              {l}
            </button>
          ))}
        </div>
        <div className="report-range-actions">
          <RefreshButton onRefresh={reload} loading={loading} />
          <button type="button" className="btn btn-white btn-sm" onClick={downloadAll} disabled={!data}>
            <i className="bi bi-filetype-csv" /> Download all (CSV)
          </button>
          <button type="button" className="btn btn-white btn-sm" onClick={printAll} disabled={!data}>
            <i className="bi bi-printer" /> Print / PDF
          </button>
        </div>
      </div>

      <nav className="report-nav no-print" aria-label="Reports on this page">
        {SECTIONS.map(([type, icon], index) => (
          <a
            key={type}
            href={`#rep-${type}`}
            onClick={(e) => {
              e.preventDefault();
              jumpTo(index);
            }}
          >
            <i className={`bi ${icon}`} aria-hidden="true" /> {data?.titles?.[type] || type.replace(/_/g, ' ')}
          </a>
        ))}
      </nav>

      {error && <div className="alert alert-danger">{error.message}</div>}
      {!data ? (
        <PageLoader />
      ) : (
        <>
          <p className="small text-muted-2 print-only-block">
            MarketLink platform reports · {formatDateKey(range.from, { withYear: true })} to {formatDateKey(range.to, { withYear: true })} · generated {formatDate(data.generatedAt, { time: true })}
          </p>
          {SECTIONS.map(([type, icon, text], index) => (
            <section key={type} id={`rep-${type}`} className="report-section">
              <div className="report-section-head">
                <span className="report-section-icon" aria-hidden="true">
                  <i className={`bi ${icon}`} />
                </span>
                <div className="min-w-0 flex-grow-1">
                  <h2>{data.titles[type]}</h2>
                  <p>{text}</p>
                </div>
                <div className="d-flex gap-2 no-print">
                  <button type="button" className="btn btn-white btn-sm" onClick={() => downloadCsv(reportOf(type))} title="Download this report as CSV">
                    <i className="bi bi-filetype-csv" /> CSV
                  </button>
                  <button type="button" className="btn btn-white btn-sm" onClick={() => save(type)} disabled={saving === type} title="Keep a copy of this report">
                    {saving === type ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-bookmark-plus" />} Save
                  </button>
                </div>
              </div>
              <WhenVisible force={printing || index <= shownUpTo}>
                <ReportView report={reportOf(type)} />
              </WhenVisible>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

export default function AdminReports() {
  useDocumentTitle('Reports');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'saved' ? 'saved' : 'all';
  return (
    <>
      <DashHeader title="Reports & analytics" subtitle="Every platform report for the period you choose: orders, revenue, markets, categories, products, farmers, customers, cities, pickups, cancellations, pickup problems, attendance, stock, offers, reviews, sign-ups and demand." />
      <div className="tabs-pill mb-3 no-print" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setParams({})}>
          <i className="bi bi-grid-1x2" aria-hidden="true" /> All reports
        </button>
        <button type="button" role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'active' : ''} onClick={() => setParams({ tab: 'saved' })}>
          <i className="bi bi-bookmark" aria-hidden="true" /> Saved reports
        </button>
      </div>
      {tab === 'all' ? <AllReports /> : <SavedReports />}
    </>
  );
}
