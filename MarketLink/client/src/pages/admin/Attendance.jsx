import { useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useFetch from '../../hooks/useFetch';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import DataGrid from '../../components/admin/DataGrid';
import { BarList, ChartCard } from '../../components/charts/Charts';
import { PageLoader } from '../../components/common/Loader';
import RefreshButton from '../../components/common/RefreshButton';
import { display, esc, link, muted } from '../../utils/cells';
import { formatDate, formatDateKey, time12, toDateKey } from '../../utils/format';

const STATUS = {
  attended: ['Came', 'is-here', 'bi-geo-alt-fill'],
  absent: ['Did not come', 'is-away', 'bi-x-circle'],
  no_check_in: ['No check-in', 'is-unknown', 'bi-question-circle'],
  today: ['Today, not yet', 'is-later', 'bi-clock'],
};
const TABS = [
  ['', 'All market days'],
  ['absent', 'Did not come'],
  ['no_check_in', 'No check-in'],
  ['attended', 'Came'],
];

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
};

const statusCell = (s) => {
  const [label, cls, icon] = STATUS[s] || [s, '', 'bi-dot'];
  return `<span class="today-badge ${cls}"><i class="bi ${icon}"></i> ${esc(label)}</span>`;
};

/**
 * Market attendance: every market day of every farmer (from their pickup times), whether they checked in,
 * said they could not come (and why) or never said anything. Also who misses the most and the reasons.
 */
export default function Attendance() {
  useDocumentTitle('Market attendance');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(toDateKey());
  const [farmer, setFarmer] = useState('');
  const [status, setStatus] = useState('');
  const { data, loading, reload, error } = useFetch(`/admin/attendance?from=${from}&to=${to}${farmer ? `&farmer=${farmer}` : ''}`);
  const farmers = useFetch('/farmers?limit=100');

  if (loading && !data) return <PageLoader />;
  const s = data?.summary || {};
  const rows = (data?.rows || []).filter((r) => !status || r.status === status);

  const columns = [
    { data: 'date', title: 'Date', className: 'dt-nowrap', render: display((v) => `<span class="text-nowrap">${esc(formatDateKey(v, { withYear: true }))}</span>`, (v) => v) },
    { data: 'farmer', title: 'Farmer', responsivePriority: 1, render: display((f) => `${link(`/farmers/${f.slug}`, f.stallName)}${f.phone ? `<div>${muted(f.phone)}</div>` : ''}`, (f) => f.stallName) },
    { data: 'markets', title: 'Market', render: display((m, r) => `${esc(m.join(', '))}<div>${muted(`${time12(r.start)} to ${time12(r.end)}`)}</div>`, (m) => m.join(', ')) },
    { data: 'status', title: 'Attendance', responsivePriority: 2, render: display((v) => statusCell(v), (v) => STATUS[v]?.[0] || v) },
    { data: 'reason', title: 'Reason', render: display((v, r) => (r.status === 'absent' ? `<strong class="small">${esc(data.reasons[v] || v || 'Not given')}</strong>${r.note ? `<div class="small text-muted-2">“${esc(r.note)}”</div>` : ''}` : '<span class="text-muted-2">-</span>'), (v) => (v ? data.reasons[v] || v : '')) },
    { data: 'markedAt', title: 'Said at', className: 'dt-nowrap', render: display((v, r) => (v ? `<span class="small">${esc(formatDate(v, { time: true }))}</span>${r.status === 'absent' && v && new Date(v) > new Date(`${r.date}T${r.start}`) ? `<div>${muted('after the market opened')}</div>` : ''}` : '<span class="text-muted-2">-</span>'), (v) => v || '') },
    { data: 'pickups', title: 'Pickups that day', className: 'text-end', render: display((v, r) => (r.status === 'absent' && v ? `<span class="chip chip-danger">${v}</span>` : String(v))) },
  ];

  return (
    <>
      <DashHeader
        title="Market attendance"
        subtitle="Which farmers came to their market days, who could not come and why, and market days without a check-in."
        actions={<RefreshButton onRefresh={reload} loading={loading} />}
      />
      <div className="panel mb-4 att-filters">
        <label>
          <span className="small fw-semi d-block">From</span>
          <input type="date" className="form-control" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span className="small fw-semi d-block">To</span>
          <input type="date" className="form-control" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          <span className="small fw-semi d-block">Farmer</span>
          <select className="form-select" value={farmer} onChange={(e) => setFarmer(e.target.value)}>
            <option value="">All farmers</option>
            {(farmers.data?.farmers || []).map((f) => (
              <option key={f._id} value={f._id}>
                {f.stallName}
              </option>
            ))}
          </select>
        </label>
        <div className="att-quick">
          {[
            [6, 'Last 7 days'],
            [29, 'Last 30 days'],
            [89, 'Last 90 days'],
          ].map(([n, l]) => (
            <button
              key={n}
              type="button"
              className={`btn btn-sm ${from === daysAgo(n) && to === toDateKey() ? 'btn-primary' : 'btn-white'}`}
              onClick={() => {
                setFrom(daysAgo(n));
                setTo(toDateKey());
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="alert alert-danger">{error.message}</div>}

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl">
          <KpiCard icon="bi-calendar-week" label="Market days" value={s.marketDays || 0} sub={`${formatDateKey(data?.from)} to ${formatDateKey(data?.to)}`} />
        </div>
        <div className="col-6 col-xl">
          <KpiCard variant="accent" icon="bi-geo-alt-fill" label="Came (checked in)" value={s.attended || 0} sub={s.rate == null ? '-' : `${s.rate}% attendance`} />
        </div>
        <div className="col-6 col-xl">
          <KpiCard variant="warn" icon="bi-x-circle" label="Did not come" value={s.absent || 0} sub="With a reason" />
        </div>
        <div className="col-6 col-xl">
          <KpiCard icon="bi-question-circle" label="No check-in" value={s.noCheckIn || 0} sub="Did not say anything" />
        </div>
        <div className="col-12 col-xl">
          <KpiCard variant="info" icon="bi-bag-x" label="Pickups on missed days" value={s.pickupsOnAbsentDays || 0} sub="Customers who were told" />
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-7">
          <div className="table-card h-100">
            <div className="panel-head px-3 pt-3">
              <h5>Attendance by farmer</h5>
              <span className="small text-muted-2">Lowest attendance first</span>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th className="text-end">Market days</th>
                    <th className="text-end">Came</th>
                    <th className="text-end">Did not come</th>
                    <th className="text-end">No check-in</th>
                    <th style={{ width: '28%' }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byFarmer || []).map((f) => (
                    <tr key={f.farmer._id}>
                      <td>
                        <button type="button" className="btn btn-link p-0 fw-semi text-start text-nowrap" onClick={() => setFarmer(String(f.farmer._id))}>
                          {f.farmer.stallName}
                        </button>
                      </td>
                      <td className="text-end">{f.marketDays}</td>
                      <td className="text-end">{f.attended}</td>
                      <td className="text-end">{f.absent}</td>
                      <td className="text-end">{f.noCheckIn}</td>
                      <td>
                        <div className="att-bar" title={f.rate == null ? '' : `${f.rate}%`}>
                          <span style={{ width: `${f.rate || 0}%` }} className={f.rate != null && f.rate < 60 ? 'is-low' : ''} />
                          <b>{f.rate == null ? '-' : `${f.rate}%`}</b>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-xl-5 d-flex flex-column gap-4">
          <ChartCard title="Why farmers could not come" subtitle="Market days missed, by reason">
            {data?.byReason?.length ? <BarList data={data.byReason} labelKey="label" valueKey="n" name="Market days" /> : <p className="small text-muted-2 mb-0">Nobody missed a market day in this period.</p>}
          </ChartCard>
          <div className="panel">
            <div className="panel-head">
              <h5>Planned absences (next 30 days)</h5>
            </div>
            {data?.upcoming?.length ? (
              <ul className="att-upcoming">
                {data.upcoming.map((u) => (
                  <li key={`${u.farmer?._id}${u.date}`}>
                    <strong>{formatDateKey(u.date)}</strong>
                    <span>
                      {u.farmer?.stallName} · {u.label}
                      {u.note ? ` · “${u.note}”` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small text-muted-2 mb-0">No farmer has said they will miss a coming market day.</p>
            )}
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="tabs-pill">
            {TABS.map(([v, l]) => (
              <button key={v} type="button" className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <DataGrid key={`${status}${from}${to}${farmer}`} data={rows} columns={columns} order={[]} exportName="MarketLink market attendance" searchPlaceholder="Search farmer, market or reason…" emptyText="No market days in this period" />
      </div>
    </>
  );
}
