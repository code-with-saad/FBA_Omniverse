import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { money, offerPercent } from '../../utils/format';
import ProduceImage from '../common/ProduceImage';
import RatingStars from '../common/RatingStars';
import FavButton from '../common/FavButton';
import RemindMeButton from '../product/RemindMeButton';
import { productPath } from '../../utils/links';
import { categoryName, productName, t, unitName } from '../../i18n';
import { qtyLabel } from '../../utils/quantity';

const QuickViewModal = lazy(() => import('../product/QuickViewModal'));

/**
 * A product in the shop. `layout="list"` lays it out as a wide row (photo on the side) for the list view.
 * `compareWith`: the price of the product being viewed, to say "Rs 30 less per kg" (same unit only).
 */
export default function ProductCard({ product, layout = 'grid', compareWith }) {
  const cart = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const soldOut = product.status !== 'available' || product.quantityAvailable <= 0;
  const low = !soldOut && product.quantityAvailable <= 5;
  const off = offerPercent(product);
  // null (closed), 'view' (Quick view) or 'add' (the Add button: choose how many, then add)
  const [quick, setQuick] = useState(null);
  const inCart = cart.items.find((i) => i.productId === product._id);

  function openAdd() {
    if (user && user.role !== 'customer') {
      toast(t('Only customer accounts can place pre-orders'), 'warning');
      return;
    }
    setQuick('add');
  }

  return (
    <article className={`product-card ${soldOut ? 'is-soldout' : ''} ${layout === 'list' ? 'is-list' : ''}`}>
      <div className="card-top-badges">
        {off > 0 && !soldOut && <span className="chip chip-deal">{t('{n}% off', { n: off })}</span>}
        {soldOut && <span className="chip chip-dark">{t('Sold out')}</span>}
        {low && (
          <span className="chip chip-warn">
            {t('Only')} {qtyLabel(product.quantityAvailable, product.unit)} {t('left')}
          </span>
        )}
        {compareWith > 0 && !soldOut && product.price !== compareWith && (
          <span className={`chip ${product.price < compareWith ? 'chip-cheaper' : 'chip-dearer'}`}>
            {product.price < compareWith ? t('{amount} less per {unit}', { amount: money(compareWith - product.price), unit: unitName(product.unit) }) : t('{amount} more per {unit}', { amount: money(product.price - compareWith), unit: unitName(product.unit) })}
          </span>
        )}
        {compareWith > 0 && !soldOut && product.price === compareWith && <span className="chip chip-dearer">{t('Same price')}</span>}
      </div>
      <FavButton type="products" id={product._id} className="fav-btn" />
      <div className="product-media">
        <ProduceImage src={product.image} alt={productName(product)} color={product.category?.color} />
        <button type="button" className="quickview-btn" onClick={() => setQuick('view')} aria-label={t('Quick view: {name}', { name: productName(product) })}>
          <i className="bi bi-eye" aria-hidden="true" /> {t('Quick view')}
        </button>
      </div>
      <div className="product-body">
        <span className="product-cat">{categoryName(product.category)}</span>
        <h3 className="product-name">
          <Link to={productPath(product)}>{productName(product)}</Link>
        </h3>
        {product.farmer?.stallName && (
          <div className="product-farmer">
            {t('by')} <Link to={`/farmers/${product.farmer.slug}`}>{product.farmer.stallName}</Link>
          </div>
        )}
        {product.ratingCount > 0 && (
          <div className="mt-1">
            <RatingStars value={product.ratingAvg} count={product.ratingCount} />
          </div>
        )}
        <div className="product-footer">
          <div className="price">
            {money(product.price)}
            <span className="unit">/ {unitName(product.unit)}</span>
            {off > 0 && (
              <del className="price-was">
                <span className="visually-hidden">{t('Usual price')} </span>
                {money(product.compareAtPrice)}
              </del>
            )}
          </div>
          {soldOut ? (
            <RemindMeButton product={product} compact className="add-btn" />
          ) : (
            <button
              type="button"
              className="add-btn"
              onClick={openAdd}
              aria-haspopup="dialog"
              aria-label={
                inCart
                  ? t('Add {name} to basket ({n} already in it)', {
                      name: productName(product),
                      n: inCart.sellByWeight ? qtyLabel(inCart.quantity, product.unit) : inCart.quantity,
                    })
                  : t('Add {name} to basket', { name: productName(product) })
              }
              title={t('Choose how many and add to basket')}
            >
              <i className="bi bi-basket2" aria-hidden="true" />
              <span className="add-label">{t('Add')}</span>
              {inCart && (
                <span className="add-count" aria-hidden="true">
                  {inCart.sellByWeight ? qtyLabel(inCart.quantity, product.unit) : inCart.quantity}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      {quick && (
        <Suspense fallback={null}>
          <QuickViewModal product={product} focusAdd={quick === 'add'} onClose={() => setQuick(null)} />
        </Suspense>
      )}
    </article>
  );
}
