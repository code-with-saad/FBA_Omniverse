import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import OrderCard from '../../components/order/OrderCard';
import ProductCard from '../../components/cards/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import { moneyCompact, timeAgo } from '../../utils/format';
import { NOTIF_ICONS } from '../../components/layout/NotificationBell';
import RatingStars from '../../components/common/RatingStars';
import { t, tServer } from '../../i18n';
import RefreshButton from '../../components/common/RefreshButton';
import ReceiptCheck from '../../components/orders/ReceiptCheck';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return t('Good morning');
  if (h < 17) return t('Good afternoon');
  return t('Good evening');
}

export default function CustomerDashboard() {
  useDocumentTitle(t('My dashboard'));
  const { user } = useAuth();
  const { data, loading, reload } = useFetch('/customer/dashboard');
  // Pre-orders the farmer marked as picked up: "Did you receive it?" pops up (once per visit)
  const toConfirm = useFetch('/orders/to-confirm');
  const [skipped, setSkipped] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('ml_receipt_skipped') || '[]');
    } catch {
      return [];
    }
  });
  const skip = (id) => {
    const next = [...skipped, id];
    setSkipped(next);
    try {
      sessionStorage.setItem('ml_receipt_skipped', JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const asking = (toConfirm.data?.orders || []).find((o) => !skipped.includes(o._id));
  if (loading && !data) return <PageLoader />;
  const { stats, upcoming, notifications, suggestions, farmers = [] } = data;
  const ready = upcoming.filter((o) => o.status === 'ready');

  return (
    <>
      {asking && (
        <ReceiptCheck
          key={asking._id}
          order={asking}
          onClose={() => skip(asking._id)}
          onDone={() => {
            skip(asking._id);
            toConfirm.reload();
            reload();
          }}
        />
      )}
      <DashHeader
        title={t('{greeting}, {name}', { greeting: greeting(), name: user.name.split(' ')[0] })}
        subtitle={t('Here\'s what\'s happening with your market orders.')}
        actions={
          <>
            <RefreshButton onRefresh={reload} loading={loading} />
            <Link to="/products" className="btn btn-primary">
              <i className="bi bi-basket" /> {t('Shop this week\'s harvest')}
            </Link>
          </>
        }
      />

      {ready.length > 0 && (
        <div className="approval-banner" style={{ background: 'linear-gradient(120deg,#e9f7d4,#f7fbe9)', borderColor: '#cfe9a8' }}>
          <span className="banner-icon" aria-hidden="true">
            <i className="bi bi-bag-check-fill" />
          </span>
          <div className="flex-grow-1">
            <strong>{ready.length === 1 ? t('An order is ready for pickup!') : t('{n} orders are ready for pickup!', { n: ready.length })}</strong>
            <div className="small text-muted-2">
              {ready.map((o) => t('{stall} at {market}', { stall: o.farmer?.stallName, market: o.market?.name })).join(' · ')}
                {t('. Remember to pay at the stall.')}
            </div>
          </div>
          <Link to={`/account/orders/${ready[0]._id}`} className="btn btn-forest btn-sm">
            {t('View pickup details')}
          </Link>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <KpiCard variant="accent" icon="bi-bag" label={t('Active pre-orders')} value={stats.activeOrders} sub={t('placed, accepted or ready')} />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard icon="bi-check2-circle" label={t('Completed pickups')} value={stats.completedOrders} />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard variant="info" icon="bi-wallet2" label={t('Spent at markets')} value={moneyCompact(stats.totalSpent)} sub={t('paid at pickup')} />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard variant="warn" icon="bi-heart" label={t('Favourites')} value={stats.favorites} sub={t('{farmers} farmers · {markets} saved markets', { farmers: stats.favoriteFarmers ?? 0, markets: stats.savedMarkets })} />
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <div className="panel">
            <div className="panel-head">
              <h5>{t('Upcoming pickups')}</h5>
              <Link to="/account/orders" className="link-arrow small">
                {t('All orders')} <i className="bi bi-arrow-right" />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState title={t('No upcoming pickups')} message={t('Your next pre-order will show up here.')} action={<Link to="/products" className="btn btn-primary btn-sm">{t('Browse products')}</Link>} />
            ) : (
              <div className="d-grid gap-2">
                {upcoming.map((o) => (
                  <OrderCard key={o._id} order={o} to={`/account/orders/${o._id}`} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col-xl-4">
          <div className="panel">
            <div className="panel-head">
              <h5>{t('Latest updates')}</h5>
              <Link to="/account/notifications" className="link-arrow small">
                {t('All')} <i className="bi bi-arrow-right" />
              </Link>
            </div>
            {notifications.length === 0 && <p className="small text-muted-2">{t('No notifications yet.')}</p>}
            <div className="d-grid gap-1">
              {notifications.map((n) => (
                <Link key={n._id} to={n.link || '/account/notifications'} className={`notif-item ${n.read ? '' : 'unread'}`}>
                  <span className="notif-icon">
                    <i className={`bi ${NOTIF_ICONS[n.type] || 'bi-bell'}`} />
                  </span>
                  <span className="min-w-0">
                    <strong className="d-block small text-truncate">{tServer(n.title)}</strong>
                    <span className="fs-7 text-muted-2">{timeAgo(n.createdAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-head">
          <h5>
            <i className="bi bi-heart" /> {t('Your favourite farmers')}
          </h5>
          <Link to={farmers.length ? '/account/favorites' : '/farmers'} className="link-arrow small">
            {farmers.length ? t('All favourites') : t('Find farmers')} <i className="bi bi-arrow-right" />
          </Link>
        </div>
        {farmers.length === 0 ? (
          <p className="small text-muted-2 mb-0">{t('Tap the heart on a farmer\'s stall page to follow them here and reorder quickly.')}</p>
        ) : (
          <div className="fav-farmers">
            {farmers.map((f) => (
              <Link key={f._id} to={`/farmers/${f.slug}`} className="farmer-mini">
                <span className="logo">
                  <img src={f.logo} alt="" />
                </span>
                <span className="flex-grow-1 min-w-0">
                  <strong className="d-block small text-truncate">{f.stallName}</strong>
                  <span className="fs-7 text-muted-2 d-block text-truncate">
                    <i className="bi bi-geo-alt" /> {t(f.city)} · {t('{n} in stock', { n: f.inStock })}
                  </span>
                  <RatingStars value={f.ratingAvg} count={f.ratingCount} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h5>{t('Picked for you')}</h5>
          <Link to="/account/favorites" className="link-arrow small">
            {t('Favourites')} <i className="bi bi-arrow-right" />
          </Link>
        </div>
        <div className="row g-3">
          {suggestions.map((p) => (
            <div key={p._id} className="col-6 col-lg-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
