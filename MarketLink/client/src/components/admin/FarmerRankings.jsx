import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { money } from '../../utils/format';

const BY = [
  { value: 'revenue', label: 'Highest revenue', icon: 'bi-cash-stack' },
  { value: 'rating', label: 'Top rated', icon: 'bi-star-fill' },
  { value: 'orders', label: 'Most orders', icon: 'bi-receipt' },
  { value: 'customers', label: 'Most customers', icon: 'bi-people' },
  { value: 'products', label: 'Most products', icon: 'bi-basket' },
];
const PERIODS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'All time' },
];

/** Admin: leaderboard of the stalls, chosen with chips (revenue, rating, orders, customers, products). */
export default function FarmerRankings() {
  const [by, setBy] = useState('revenue');
  const [days, setDays] = useState(30);
  const { data, loading } = useFetch(`/admin/farmer-rankings?by=${by}&days=${days}&limit=10`);
  const rows = data?.farmers || [];
  const top = rows[0];

  return (
    <section className="panel mb-4 rankings" aria-labelledby="rank-title">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <h2 id="rank-title" className="h6 mb-0">
          <i className="bi bi-trophy text-warning" aria-hidden="true" /> Farmer rankings
        </h2>
        <div className="view-toggle" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" className={days === p.value ? 'active' : ''} aria-pressed={days === p.value} onClick={() => setDays(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rank-chips" role="group" aria-label="Rank farmers by">
        {BY.map((b) => (
          <button key={b.value} type="button" className={`filter-chip ${by === b.value ? 'active' : ''}`} aria-pressed={by === b.value} onClick={() => setBy(b.value)}>
            <i className={`bi ${b.icon}`} aria-hidden="true" /> {b.label}
          </button>
        ))}
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0 rank-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Stall</th>
              <th className="text-end">Revenue</th>
              <th className="text-end">Orders</th>
              <th className="text-end">Customers</th>
              <th className="text-end">Rating</th>
              <th className="text-end">Products</th>
            </tr>
          </thead>
          <tbody className={loading ? 'is-loading' : ''}>
            {rows.map((f) => (
              <tr key={f._id} className={f === top ? 'is-first' : ''}>
                <td>
                  <span className={`rank-no ${f.rank <= 3 ? `is-top${f.rank}` : ''}`}>{f.rank}</span>
                </td>
                <td>
                  <Link to={`/farmers/${f.slug}`} className="d-flex align-items-center gap-2 text-decoration-none">
                    <span className="thumb-sm">
                      <img src={f.logo} alt="" />
                    </span>
                    <span className="min-w-0">
                      <strong className="d-block small text-truncate">{f.stallName}</strong>
                      <span className="fs-7 text-muted-2">{f.city || '-'}</span>
                    </span>
                  </Link>
                </td>
                <td className={`text-end small ${by === 'revenue' ? 'fw-bold' : ''}`}>{money(f.revenue)}</td>
                <td className={`text-end small ${by === 'orders' ? 'fw-bold' : ''}`}>{f.orders}</td>
                <td className={`text-end small ${by === 'customers' ? 'fw-bold' : ''}`}>{f.customers}</td>
                <td className={`text-end small ${by === 'rating' ? 'fw-bold' : ''}`}>
                  {f.ratingCount ? (
                    <>
                      {f.ratingAvg} <i className="bi bi-star-fill text-warning" aria-hidden="true" /> <span className="text-muted-2">({f.ratingCount})</span>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className={`text-end small ${by === 'products' ? 'fw-bold' : ''}`}>{f.products}</td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={7} className="text-center text-muted-2 small py-3">
                  No active farmers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
