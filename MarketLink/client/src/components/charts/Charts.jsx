import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactNumber, MONTHS, parseDateKey } from '../../utils/format';
import { t } from '../../i18n';

// Single-series charts in the brand green. Specs: 2px lines, ~10% area wash,
// bars <= 24px with 4px rounded ends, hairline solid grid, text in ink colours only.
const SERIES = '#2e7d4f';
const GRID = '#ece6d8';
const AXIS_TEXT = { fill: '#66756d', fontSize: 12 };

const shortDate = (key) => {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-3 shadow-sm px-3 py-2 small">
      <div className="text-muted-2 fs-7">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="d-flex align-items-center gap-2 fw-semi">
          <span style={{ width: 8, height: 8, borderRadius: 4, background: SERIES, display: 'inline-block' }} />
          {p.name}: {valueFormatter ? valueFormatter(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

/** Panel with a title and a "table" toggle so the numbers are always readable without the chart. */
export function ChartCard({ title, subtitle, table, children, actions, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h5>{title}</h5>
          {subtitle && <div className="fs-7 text-muted-2">{subtitle}</div>}
        </div>
        <div className="d-flex gap-2 align-items-center">
          {actions}
          {table && (
            <button type="button" className="btn btn-sm btn-white" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
              <i className={`bi ${asTable ? 'bi-bar-chart' : 'bi-table'}`} /> {asTable ? t('Chart') : t('Table')}
            </button>
          )}
        </div>
      </div>
      {asTable && table ? (
        <div className="table-responsive" style={{ maxHeight: 320 }}>
          <table className="table table-sm small mb-0">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{t(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Trend over time (e.g. daily revenue). data: [{ date: 'YYYY-MM-DD', [yKey]: number }] */
export function TrendChart({ data, yKey, name, valueFormatter = compactNumber, height = 260 }) {
  const gradientId = `grad-${yKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity={0.14} />
            <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TEXT} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={compactNumber} tick={AXIS_TEXT} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={shortDate} />} cursor={{ stroke: '#b9b2a2', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={yKey}
          name={t(name)}
          stroke={SERIES}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 5, fill: SERIES, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Vertical columns over time (e.g. orders per day). */
export function ColumnChart({ data, xKey = 'date', yKey, name, valueFormatter = (v) => v, height = 260, dateAxis = true }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tickFormatter={dateAxis ? shortDate : undefined} tick={AXIS_TEXT} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={dateAxis ? shortDate : undefined} />} cursor={{ fill: 'rgba(212,240,110,.25)' }} />
        <Bar dataKey={yKey} name={t(name)} fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars with the value at the tip (rankings such as best sellers). */
export function BarList({ data, labelKey, valueKey, name, valueFormatter = (v) => v, height }) {
  const h = height || Math.max(160, data.length * 40 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={labelKey} tick={{ ...AXIS_TEXT, fill: '#16211c' }} axisLine={false} tickLine={false} width={140} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ fill: 'rgba(212,240,110,.2)' }} />
        <Bar dataKey={valueKey} name={t(name)} fill={SERIES} barSize={18} radius={[0, 4, 4, 0]}>
          <LabelList dataKey={valueKey} position="right" formatter={valueFormatter} style={{ fill: '#16211c', fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
