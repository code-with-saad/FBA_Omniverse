import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useFetch from '../../hooks/useFetch';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import EmptyState from '../../components/common/EmptyState';
import { Bone } from '../../components/common/Skeletons';
import RefreshButton from '../../components/common/RefreshButton';
import { ISSUE_LABEL } from '../../components/orders/IssuePanel';
import { formatDate, formatDateKey, money, time12 } from '../../utils/format';

const TABS = [
  ['active', 'Needs attention'],
  ['open', 'Waiting for the farmer'],
  ['new_pickup', 'New pickup arranged'],
  ['disputed', 'Farmer says collected'],
  ['resolved', 'Sorted out'],
  ['all', 'All'],
];

const OUTCOME = {
  received: 'Customer received it',
  collected_after_new_pickup: 'Collected at the new pickup',
  cancelled: 'Order cancelled',
  farmer_right: 'Farmer was right (collected)',
};

/**
 * Pickup problems: every pre-order a customer said they did not receive, what the farmer answered,
 * new pickups and the outcome. Each card opens the order, where the admin arranges a new pickup or closes it.
 */
export default function PickupProblems() {
  useDocumentTitle('Pickup problems');
  const { refreshBadges } = useOutletContext() || {};
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const { data, loading, reload } = useFetch(`/admin/order-issues?status=${status}&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`);
  const counts = data?.counts || {};
  const orders = data?.orders || [];

  return (
    <>
      <DashHeader
        title="Pickup problems"
        subtitle="Pre-orders that customers say they did not receive. Check both sides, arrange a new pickup or close the problem."
        actions={
          <RefreshButton
            onRefresh={() => {
              reload();
              refreshBadges?.();
            }}
            loading={loading}
          />
        }
      />
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <KpiCard variant="warn" icon="bi-exclamation-octagon" label="Waiting for the farmer" value={counts.open || 0} sub="Reported, no answer yet" />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard variant="info" icon="bi-calendar-plus" label="New pickup arranged" value={counts.new_pickup || 0} sub="Closes when the customer confirms" />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard icon="bi-person-check" label="Farmer says collected" value={counts.disputed || 0} sub="An admin decides" />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard variant="accent" icon="bi-check2-circle" label="Sorted out" value={counts.resolved || 0} sub="All time" />
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div className="tabs-pill" role="tablist">
          {TABS.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={status === v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>
              {l} <span className="n">{v === 'all' ? Object.entries(counts).filter(([k]) => k !== 'active').reduce((n, [, c]) => n + c, 0) : counts[v] || 0}</span>
            </button>
          ))}
        </div>
        <div className="search-pill" style={{ maxWidth: 240 }}>
          <i className="bi bi-search" aria-hidden="true" />
          <input placeholder="Order number" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search order number" />
        </div>
      </div>

      {loading && !data ? (
        <div className="d-grid gap-3">
          {[0, 1, 2].map((i) => (
            <Bone key={i} h={130} r="1rem" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="panel">
          <EmptyState icon="bi-emoji-smile" title="No pickup problems here" message="When a customer says they did not receive a pre-order, it appears on this page." />
        </div>
      ) : (
        <div className="problem-list">
          {orders.map((o) => {
            const last = o.issue.history?.[o.issue.history.length - 1];
            return (
              <article key={o._id} className={`problem-card is-${o.issue.status}`}>
                <div className="problem-top">
                  <div className="min-w-0">
                    <Link to={`/admin/orders/${o._id}`} className="problem-number">
                      {o.orderNumber}
                    </Link>
                    <span className={`issue-chip is-${o.issue.status}`}>{ISSUE_LABEL[o.issue.status]}</span>
                    {o.issue.timesReported > 1 && <span className="chip chip-danger">Reported {o.issue.timesReported} times</span>}
                  </div>
                  <strong className="text-forest">{money(o.totalAmount)}</strong>
                </div>
                <div className="problem-grid">
                  <div>
                    <span className="problem-label">Customer</span>
                    <span>{o.customer?.name}</span>
                    {o.customer?.phone && (
                      <a href={`tel:${o.customer.phone}`} className="small d-block">
                        {o.customer.phone}
                      </a>
                    )}
                  </div>
                  <div>
                    <span className="problem-label">Farmer</span>
                    <span>{o.farmer?.stallName}</span>
                    {o.farmer?.phone && (
                      <a href={`tel:${o.farmer.phone}`} className="small d-block">
                        {o.farmer.phone}
                      </a>
                    )}
                  </div>
                  <div>
                    <span className="problem-label">{o.issue.status === 'new_pickup' ? 'New pickup' : 'Pickup'}</span>
                    <span>
                      {formatDateKey(o.pickupDate)}, {time12(o.pickupSlot.start)}
                    </span>
                    <span className="small text-muted-2 d-block">{o.market?.name}</span>
                  </div>
                  <div>
                    <span className="problem-label">Reported</span>
                    <span>{formatDate(o.issue.openedAt, { time: true })}</span>
                    <span className="small text-muted-2 d-block">{o.items.length} item(s)</span>
                  </div>
                </div>
                {o.issue.note && <p className="problem-quote">“{o.issue.note}”</p>}
                <div className="problem-foot">
                  <span className="small text-muted-2 min-w-0">
                    {o.issue.status === 'resolved' ? (
                      <>
                        <i className="bi bi-check2-circle" aria-hidden="true" /> {OUTCOME[o.issue.resolution] || 'Closed'} · {formatDate(o.issue.resolvedAt)}
                      </>
                    ) : last ? (
                      <>
                        Last: {last.action.replace(/_/g, ' ')} by {last.by} · {formatDate(last.at, { time: true })}
                        {last.note ? ` · ${last.note}` : ''}
                      </>
                    ) : null}
                  </span>
                  <Link to={`/admin/orders/${o._id}`} className="btn btn-sm btn-primary">
                    {o.issue.status === 'resolved' ? 'View' : 'Check and decide'} <i className="bi bi-arrow-right" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
