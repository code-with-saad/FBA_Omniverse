import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DashHeader } from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import ProduceImage from '../../components/common/ProduceImage';
import RatingStars from '../../components/common/RatingStars';
import ReviewModal from '../../components/reviews/ReviewModal';
import VerifiedBadge from '../../components/reviews/VerifiedBadge';
import { formatDate, timeAgo } from '../../utils/format';
import { productPath } from '../../utils/links';
import { productName, t } from '../../i18n';

/** A completed pickup with what is still to review: the stall and each product in it. */
function PickupGroup({ items, onWrite }) {
  const first = items[0];
  const farmer = first.farmer || {};
  const stall = items.find((i) => i.type === 'farmer');
  const products = items.filter((i) => i.type === 'product');
  return (
    <div className="review-order">
      <div className="review-order-head">
        <span className="review-todo-img logo">
          <img src={farmer.logo} alt="" />
        </span>
        <div className="min-w-0 flex-grow-1">
          <strong className="d-block text-truncate">{farmer.slug ? <Link to={`/farmers/${farmer.slug}`}>{farmer.stallName}</Link> : farmer.stallName}</strong>
          <span className="fs-7 text-muted-2">
            {t('Order {number} · picked up {date}', { number: first.orderNumber, date: formatDate(first.completedAt) })}
          </span>
        </div>
        {stall ? (
          <button type="button" className="btn btn-lime btn-sm flex-shrink-0 review-stall-btn" onClick={() => onWrite(stall)}>
            <i className="bi bi-shop-window" /> {t('Rate the stall')}
          </button>
        ) : (
          <span className="fs-7 text-success fw-semi flex-shrink-0">
            <i className="bi bi-check2-circle" /> {t('Stall rated')}
          </span>
        )}
      </div>
      {products.map((item) => (
        <div key={item.product._id} className="review-todo">
          <ProduceImage src={item.product.image} alt="" className="review-todo-img" />
          <strong className="min-w-0 flex-grow-1 text-truncate small">{item.product.slug ? <Link to={productPath(item.product)}>{productName(item.product)}</Link> : productName(item.product)}</strong>
          <button type="button" className="btn btn-soft btn-sm flex-shrink-0" onClick={() => onWrite(item)}>
            <i className="bi bi-star" /> <span className="d-none d-sm-inline">{t('Review product')}</span>
            <span className="d-sm-none">{t('Review')}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Customer: reviews still to write (after a completed pickup) and the reviews already posted. */
export default function MyReviews() {
  useDocumentTitle(t('My reviews'));
  const { refreshBadges } = useOutletContext() || {};
  const [tab, setTab] = useState('pending');
  const [writing, setWriting] = useState(null);
  const { data, loading, reload } = useFetch('/reviews/mine');
  if (loading && !data) return <PageLoader />;
  const { pending, written } = data;
  // Group by pickup (order), newest first, as returned by the API
  const byOrder = new Map();
  for (const item of pending) {
    const key = String(item.orderId);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push(item);
  }
  const groups = [...byOrder.values()];

  const tabs = [
    { value: 'pending', label: t('To review'), n: groups.length },
    { value: 'written', label: t('My reviews'), n: written.length },
  ];

  return (
    <>
      <DashHeader title={t('My reviews')} subtitle={t('Rate the farmers and products you picked up. Honest reviews help other families and the farmers.')} />
      <div className="tabs-pill mb-3" role="tablist">
        {tabs.map((tx) => (
          <button key={tx.value} type="button" role="tab" aria-selected={tab === tx.value} className={tab === tx.value ? 'active' : ''} onClick={() => setTab(tx.value)}>
            {t(tx.label)}
            <span className="n">{tx.n}</span>
          </button>
        ))}
      </div>

      {tab === 'pending' &&
        (pending.length ? (
          <div className="d-flex flex-column gap-3">
            {groups.map((items) => (
              <PickupGroup key={items[0].orderId} items={items} onWrite={setWriting} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('Nothing to review right now')}
            message={t('After you pick up an order you can rate the stall and every product in it.')}
            action={
              <Link to="/products" className="btn btn-primary">
                {t('Browse products')}
              </Link>
            }
          />
        ))}

      {tab === 'written' &&
        (written.length ? (
          <div className="row g-3">
            {written.map((r) => {
              const isProduct = r.type === 'product';
              return (
                <div key={r._id} className="col-lg-6">
                  <div className="panel h-100 my-review">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className={`chip ${isProduct ? 'chip-soft' : 'chip-lime'}`}>{isProduct ? t('Product') : t('Farmer stall')}</span>
                      <strong className="small text-truncate flex-grow-1">
                        {isProduct ? (
                          r.product ? <Link to={productPath(r.product)}>{productName(r.product)}</Link> : t('Product')
                        ) : r.farmer ? (
                          <Link to={`/farmers/${r.farmer.slug}`}>{r.farmer.stallName}</Link>
                        ) : (
                          t('Farmer')
                        )}
                      </strong>
                      <span className="fs-7 text-muted-2 flex-shrink-0">{timeAgo(r.createdAt)}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <RatingStars value={r.rating} />
                      <VerifiedBadge verified={r.verified} />
                    </div>
                    {r.comment && <p className="small mb-0 mt-2">{r.comment}</p>}
                    {r.isRemoved && (
                      <p className="fs-7 text-warning-emphasis mb-0 mt-2">
                        <i className="bi bi-hourglass-split" /> {r.removedReason === 'Held for moderation' ? t('Waiting for a check by the MarketLink team before it is shown.') : t('Hidden by the MarketLink team.')}
                      </p>
                    )}
                    {r.response?.text && (
                      <div className="farmer-reply">
                        <strong className="d-block fs-7 text-success mb-1">
                          <i className="bi bi-reply-fill" /> {t('Reply from {name}', { name: r.farmer?.stallName || t('the farmer') })}
                        </strong>
                        {r.response.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t('No reviews yet')} message={t('Your reviews will show up here.')} />
        ))}

      {writing && (
        <ReviewModal
          target={{
            type: writing.type,
            orderId: writing.orderId,
            orderNumber: writing.orderNumber,
            productId: writing.product?._id,
            name: writing.type === 'product' ? productName(writing.product) : writing.farmer?.stallName,
          }}
          onClose={() => setWriting(null)}
          onDone={() => {
            setWriting(null);
            reload();
            refreshBadges?.();
          }}
        />
      )}
    </>
  );
}
