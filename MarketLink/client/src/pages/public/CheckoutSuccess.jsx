import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useFetch from '../../hooks/useFetch';
import { PageLoader } from '../../components/common/Loader';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateKey, money, time12 } from '../../utils/format';
import { isUrdu, rich, t } from '../../i18n';


export default function CheckoutSuccess() {
  useDocumentTitle(t('Pre-order placed'));
  const { state } = useLocation();
  const { numbers } = useParams();
  const wanted = numbers && numbers !== 'success' ? numbers.split('+').filter(Boolean) : [];
  const fetched = useFetch(!state?.orders && wanted.length ? `/orders/my?limit=10&numbers=${encodeURIComponent(wanted.join(','))}` : null);
  if (!state?.orders && !wanted.length) return <Navigate to="/account/orders" replace />;
  if (!state?.orders && fetched.loading) return <PageLoader />;
  const orders = state?.orders || fetched.data?.orders || [];
  if (!orders.length) return <Navigate to="/account/orders" replace />;
  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <div className="text-center mb-4">
        <span className="success-icon mb-3" aria-hidden="true">
          <i className="bi bi-check-lg" />
        </span>
        <h1 className="display-font">{t('Your pre-order is in!')}</h1>
        <p className="text-muted-2">{t('We\'ve told the farmer and sent a confirmation to your e-mail. You\'ll get an alert when it\'s ready for pickup.')}</p>
      </div>
      {state?.newAccount && (
        <div className="account-created mb-4">
          <i className="bi bi-envelope-check-fill" aria-hidden="true" />
          <div>
            <strong className="d-block">{t('Check your inbox')}</strong>
            <span className="small">
              {rich('Your MarketLink password was sent to <b>{email}</b>. Use it to log in next time and change it in', { email: state.newAccount.email })}{' '}
              <Link to="/account/profile">{t('Profile & family')}</Link>
              {isUrdu() ? '' : '.'}
            </span>
          </div>
        </div>
      )}
      <div className="d-grid gap-3 mb-4">
        {orders.map((o) => (
          <div key={o._id} className="order-card d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1">
              <strong className="d-block">{o.orderNumber}</strong>
              <span className="small text-muted-2">
                {t('Pickup')} {formatDateKey(o.pickupDate)} · {time12(o.pickupSlot.start)} {t('to')} {time12(o.pickupSlot.end)}
              </span>
            </div>
            {o.status && o.status !== 'placed' && <StatusBadge status={o.status} />}
            <strong>{money(o.totalAmount)}</strong>
            <Link to={`/account/orders/${o._id}`} className="btn btn-soft btn-sm">
              {t('View order')}
            </Link>
          </div>
        ))}
      </div>
      <div className="d-flex gap-2 justify-content-center">
        <Link to="/account/orders" className="btn btn-primary">
          {t('My orders')}
        </Link>
        <Link to="/products" className="btn btn-white">
          {t('Keep shopping')}
        </Link>
      </div>
    </div>
  );
}
