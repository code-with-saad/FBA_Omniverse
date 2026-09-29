import { useEffect, useRef, useState } from 'react';
import RemindMeButton from './RemindMeButton';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import ProductGallery from '../common/ProductGallery';
import RatingStars from '../common/RatingStars';
import StatusBadge from '../common/StatusBadge';
import QuantityStepper, { WeightChips } from '../common/QuantityStepper';
import { buyingRules, itemLabel, maxOf, minOf, qtyLabel, stepOf, weightChoices } from '../../utils/quantity';
import FavButton from '../common/FavButton';
import { DAY_SHORT, money } from '../../utils/format';
import OfferTag from '../common/OfferTag';
import { productPath } from '../../utils/links';
import { categoryName, listText, localText, productName, t, unitName } from '../../i18n';

/**
 * Product details in a dialog, opened by a product card's "Quick view" or "Add" button: photos,
 * price, stock, farmer and a quantity picker, so the shopper chooses how many before adding.
 * The card's own data shows at once; the full product (gallery, pickup days) loads behind it.
 */
export default function QuickViewModal({ product: summary, onClose, focusAdd = false }) {
  const { data, error } = useFetch(`/products/${summary.slug || summary._id}`);
  const cart = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [qty, setQty] = useState(() => minOf(summary));
  const addRef = useRef(null);
  const product = data?.product || summary;
  const soldOut = product.status !== 'available' || product.quantityAvailable <= 0;
  const days = [...new Set((product.farmer?.pickupWindows || []).map((w) => w.day))].sort();
  const inCart = cart.items.find((i) => i.productId === product._id);

  // Opened from "Add": the add button gets the focus, so Enter adds straight away
  useEffect(() => {
    if (focusAdd) addRef.current?.focus({ preventScroll: true });
  }, [focusAdd]);

  function add() {
    if (user && user.role !== 'customer') {
      toast(t('Only customer accounts can place pre-orders'), 'warning');
      return;
    }
    const added = Math.min(qty, cart.roomFor(product));
    if (!added) {
      toast(t('You already have all of the {name} in stock in your basket', { name: productName(product) }), 'warning');
      return;
    }
    cart.add(product, added);
    if (added < qty) toast(t('Only {n} more could be added: that is all the stock left', { n: qtyLabel(added, product.unit) }), 'warning');
    // The basket stays closed; the message offers to open it
    else toast(t('{item} added to your basket', { item: itemLabel(added, product.unit, productName(product)) }), 'success', { action: { label: 'View basket', onClick: cart.openDrawer } });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={focusAdd ? t('Add to basket') : productName(summary)} size="modal-lg quickview-modal" guardChanges={false}>
      {error && <p className="text-danger small">{error.message}</p>}
      <div className="row g-4">
        <div className="col-md-6">
          <ProductGallery key={data ? 'full' : 'summary'} product={product} zoom={false}>
            <div className="position-absolute pd-fav">
              <FavButton type="products" id={product._id} />
            </div>
          </ProductGallery>
        </div>
        <div className="col-md-6 d-flex flex-column">
          <span className="chip chip-soft align-self-start mb-2">{categoryName(product.category)}</span>
          <h3 className="display-font mb-1">{productName(product)}</h3>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            <RatingStars value={product.ratingAvg} count={product.ratingCount} />
            <StatusBadge status={soldOut ? 'sold_out' : 'available'} label={soldOut ? t('Sold out') : t('{n} available', { n: qtyLabel(product.quantityAvailable, product.unit) })} />
          </div>
          <div className="price mb-2" style={{ fontSize: '1.6rem' }}>
            {money(product.price)} <span className="unit">{t('per')} {unitName(product.unit)}</span> <OfferTag product={product} />
          </div>
          {localText(product, 'description') && <p className="small text-muted-2 quickview-desc">{localText(product, 'description')}</p>}
          {product.farmer?.slug && (
            <Link to={`/farmers/${product.farmer.slug}`} className="farmer-mini mb-3" onClick={onClose}>
              <span className="logo">{product.farmer.logo ? <img src={product.farmer.logo} alt="" /> : <i className="bi bi-shop" aria-hidden="true" />}</span>
              <span className="flex-grow-1 min-w-0">
                <span className="fs-7 text-muted-2 d-block">{t('Grown & sold by')}</span>
                <strong className="d-block text-truncate small">{product.farmer.stallName}</strong>
                {days.length > 0 && <span className="fs-7 text-muted-2">{t('Pickup:')} {listText(days.map((d) => DAY_SHORT[d]))}</span>}
              </span>
            </Link>
          )}
          <div className={`qv-buy mt-auto ${focusAdd ? 'is-highlighted' : ''}`}>
            <div className="qv-buy-label">
              <span>{product.sellByWeight ? t('How much?') : product.unit ? t('How many ({unit})?', { unit: unitName(product.unit) }) : t('How many?')}</span>
              {!soldOut && <strong>{money(product.price * qty)}</strong>}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {soldOut ? (
                <RemindMeButton product={product} initial={Boolean(data?.reminding)} className="btn btn-primary flex-grow-1" />
              ) : (
                <>
                  <QuantityStepper value={qty} onChange={setQty} min={minOf(product)} max={Math.max(minOf(product), maxOf(product))} step={stepOf(product)} unit={product.unit} label={t('How many?')} />
                  <button type="button" ref={addRef} className="btn btn-primary flex-grow-1 qv-add" onClick={add}>
                    <i className="bi bi-basket2" /> {t('Add to basket')}
                  </button>
                </>
              )}
            </div>
            {!soldOut && product.sellByWeight && <WeightChips choices={weightChoices(product)} value={qty} unit={product.unit} onChange={setQty} />}
            {!soldOut && buyingRules(product) && (
              <div className="buying-rules">
                <i className="bi bi-info-circle" aria-hidden="true" /> {buyingRules(product)}
              </div>
            )}
            {inCart && (
              <div className="fs-7 mt-2 text-success fw-semi">
                <i className="bi bi-check-circle" /> {t('{n} already in your basket', { n: qtyLabel(inCart.quantity, product.unit) })}
              </div>
            )}
          </div>
          <Link to={productPath(product)} className="link-arrow small mt-3" onClick={onClose}>
            {t('View full details and reviews')} <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
