import { ORDER_STATUS_META, formatDate, formatTime } from '../../utils/format';
import { isUrdu, t } from '../../i18n';

const FLOW = [
  { status: 'placed', label: 'Placed', icon: 'bi-receipt' },
  { status: 'accepted', label: 'Accepted', icon: 'bi-hand-thumbs-up' },
  { status: 'ready', label: 'Ready', icon: 'bi-bag-check' },
  { status: 'completed', label: 'Picked up', icon: 'bi-check2-all' },
];

/** Visual progress of an order: placed -> accepted -> ready -> completed */
export default function OrderTimeline({ order }) {
  if (['cancelled', 'declined'].includes(order.status)) {
    const last = order.statusHistory[order.statusHistory.length - 1];
    return (
      <div className="alert alert-danger d-flex gap-3 align-items-center mb-0 rounded-4">
        <i className="bi bi-x-octagon fs-4" />
        <div>
          <strong className="text-capitalize">{t('Order {status}', { status: isUrdu() ? ORDER_STATUS_META[order.status]?.label : order.status })}</strong>
          <div className="small">
            {formatDate(last?.at, { time: true })} {last?.note && `· ${last.note}`}
          </div>
        </div>
      </div>
    );
  }
  const current = FLOW.findIndex((s) => s.status === order.status);
  // The last time each status was reached (a modified order goes back to "placed")
  const when = {};
  for (const h of order.statusHistory) when[h.status] = h.at;
  return (
    <div className="timeline" role="list" aria-label={t('Order progress')}>
      {FLOW.map((step, i) => (
        <div key={step.status} role="listitem" className={`step ${i < current || order.status === 'completed' ? 'done' : ''} ${i === current && order.status !== 'completed' ? 'current' : ''}`}>
          <div className="circle">
            <i className={`bi ${i < current || order.status === 'completed' ? 'bi-check-lg' : step.icon}`} />
          </div>
          <div className="label">{t(step.label)}</div>
          {i <= current && when[step.status] && (
            <div className="when">
              {formatDate(when[step.status])} {formatTime(when[step.status])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
