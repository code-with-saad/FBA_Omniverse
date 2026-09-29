import { Link } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import { formatDateKey, money, time12, timeUntil } from '../../utils/format';
import { productName, t } from '../../i18n';

/** Compact order summary used in lists. */
export default function OrderCard({ order, to, footer, highlight = false }) {
  const open = ['placed', 'accepted', 'ready'].includes(order.status);
  return (
    <div className={`order-card ${highlight ? 'focus' : ''}`}>
      <div className="order-card-row">
        <div className="thumbs">
          {order.items.slice(0, 3).map((i) => (
            <img key={i.product + i.name} src={i.image} alt="" title={productName(i)} />
          ))}
        </div>
        <div className="order-card-main">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <strong>{order.orderNumber}</strong>
            <StatusBadge status={order.status} />
            {order.canModify && <span className="chip chip-soft">{t('Editable')}</span>}
            {order.issue?.status && order.issue.status !== 'resolved' && (
              <span className="chip chip-danger">
                <i className="bi bi-exclamation-octagon" aria-hidden="true" /> {t('Not received')}
              </span>
            )}
          </div>
          <div className="small text-muted-2 mt-1">
            {order.farmer?.stallName && (
              <>
                <i className="bi bi-shop" /> {order.farmer.stallName} ·{' '}
              </>
            )}
            <i className="bi bi-calendar-event" /> {formatDateKey(order.pickupDate)}, {time12(order.pickupSlot.start)} {t('to')} {time12(order.pickupSlot.end)}
            {order.market?.name && (
              <>
                {' '}
                · <i className="bi bi-geo-alt" /> {order.market.name}
              </>
            )}
          </div>
        </div>
        <div className="order-card-total">
          <div className="fw-bold text-forest">{money(order.totalAmount)}</div>
          {open && order.pickupAt && <div className="fs-7 text-muted-2">{t('pickup {when}', { when: timeUntil(order.pickupAt) })}</div>}
        </div>
        {to && (
          <Link to={to} className="btn btn-soft btn-sm order-card-link">
            {t('Details')} <i className="bi bi-arrow-right" />
          </Link>
        )}
      </div>
      {footer}
    </div>
  );
}
