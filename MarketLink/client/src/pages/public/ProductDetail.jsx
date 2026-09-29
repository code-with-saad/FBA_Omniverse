import { useState } from 'react';
import RemindMeButton from '../../components/product/RemindMeButton';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import ProductGallery from '../../components/common/ProductGallery';
import RatingStars from '../../components/common/RatingStars';
import QuantityStepper, { WeightChips } from '../../components/common/QuantityStepper';
import CardCarousel from '../../components/common/CardCarousel';
import { buyingRules, itemLabel, maxOf, minOf, qtyLabel, stepOf, weightChoices } from '../../utils/quantity';
import FavButton from '../../components/common/FavButton';
import ReviewItem from '../../components/cards/ReviewItem';
import WriteReviewButton from '../../components/reviews/WriteReviewButton';
import ReportButton from '../../components/reviews/ReportButton';
import ProductCard from '../../components/cards/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import StatusBadge from '../../components/common/StatusBadge';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DAY_SHORT, formatDateKey, money, offerPercent, time12, toDateKey } from '../../utils/format';
import OfferTag from '../../components/common/OfferTag';
import { productPath } from '../../utils/links';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd, clip, ldGraph, productDescription, productLd } from '../../utils/seo';
import { categoryName, isUrdu, listText, localText, productName, t, tServer, unitName } from '../../i18n';

export default function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { data, loading, error, reload } = useFetch(`/products/${id}`);
  const [qtyFor, setQtyFor] = useState({ id: null, qty: 1 });
  const cart = useCart();
  const { user, farmer: myStall } = useAuth();
  const { toast } = useToast();
  const p = data?.product;
  useSeo(
    p
      ? {
          title: (!isUrdu() && p.metaTitle) || t('{name}, Rs {price} per {unit} from {stallName}', { name: productName(p), price: p.price, unit: unitName(p.unit), stallName: p.farmer?.stallName }),
          description: (!isUrdu() && productDescription(p)) || clip(t('{name} ({name2}) from {stallName}. Pre-order on MarketLink and pay at the stall when you pick it up.', { name: productName(p), name2: categoryName(p.category), stallName: p.farmer?.stallName })),
          keywords: [...(p.keywords || []), p.name, p.nameUr, p.category?.name, categoryName(p.category), p.farmer?.stallName],
          image: p.image,
          type: 'product',
          jsonLd: ldGraph(productLd(p), breadcrumbLd([{ name: 'Shop', path: '/products' }, { name: (p.category && categoryName(p.category)) || t('Products'), path: `/products?category=${p.category?.slug || ''}` }, { name: p.name, path: `/products/${p.slug}` }])),
          canonicalPath: `/products/${p.slug}`,
        }
      : { title: t('Product') }
  );

  const shown = data?.product;
  const isCurrent = shown && (shown.slug === String(id).toLowerCase() || shown._id === id);
  if ((loading && !isCurrent) || (!data && !error)) return <PageLoader />;
  if (error)
    return (
      <div className="container py-5">
        <EmptyState title={t('Product not found')} message={t('It may have been removed or is no longer listed.')} action={<Link to="/products" className="btn btn-primary">{t('Back to the shop')}</Link>} />
      </div>
    );

  const { product, reviews, related } = data;
  if (product.slug && id !== product.slug && isCurrent) {
    return <Navigate to={productPath(product) + location.search + location.hash} replace />;
  }
  const farmer = product.farmer;
  const soldOut = product.status !== 'available' || product.quantityAvailable <= 0;
  const stockPct = Math.min(100, Math.round((product.quantityAvailable / Math.max(product.templateQuantity || product.quantityAvailable, 1)) * 100));
  const inCart = cart.items.find((i) => i.productId === product._id);
  const qty = qtyFor.id === product._id ? qtyFor.qty : minOf(product);
  const setQty = (n) => setQtyFor({ id: product._id, qty: n });

  function addToCart() {
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
    else toast(t('{item} added to your basket', { item: itemLabel(added, product.unit, productName(product)) }), 'success', { action: { label: 'View basket', onClick: cart.openDrawer } });
  }

  const windowsByMarket = {};
  for (const w of farmer.pickupWindows || []) {
    const name = farmer.markets?.find((m) => m._id === w.market)?.name || t('Market');
    (windowsByMarket[name] ||= []).push(w);
  }

  const ai = product.aiSchema || {};
  const facts = [
    ['bi-tag', t('Price'), t('{price} per {unit}', { price: money(product.price), unit: unitName(product.unit) })],
    ['bi-calendar2-week', t('Season'), ai.season && tServer(ai.season)],
    ['bi-egg-fried', t('Best for'), localText(ai, 'uses')],
    ['bi-snow2', t('How to keep it'), localText(ai, 'storage')],
    ['bi-shop', t('Grown by'), farmer.stallName],
    ['bi-geo-alt', t('Grown in'), farmer.city && t(farmer.city)],
    ['bi-flower1', t('Farming practice'), farmer.tags && listText(farmer.tags.map((tag) => t(tag)))],
    ['bi-cash-coin', t('Payment'), t('Cash to the farmer at pickup')],
    ['bi-hourglass-split', t('Orders close'), t('{orderCutoffHours} hours before your pickup slot', { orderCutoffHours: farmer.orderCutoffHours })],
  ].filter(([, , value]) => value);

  return (
    <article className="container py-4 pd-page" aria-labelledby="pd-name">
      <nav aria-label={t('breadcrumb')}>
        <ol className="breadcrumb small">
          <li className="breadcrumb-item"><Link to="/">{t('Home')}</Link></li>
          <li className="breadcrumb-item"><Link to="/products">{t('Shop')}</Link></li>
          <li className="breadcrumb-item"><Link to={`/products?category=${product.category?.slug}`}>{categoryName(product.category)}</Link></li>
          <li className="breadcrumb-item active">{productName(product)}</li>
        </ol>
      </nav>

      <div className="row g-4 g-lg-5">
        <div className="col-lg-5">
          <ProductGallery key={product._id} product={product}>
            <div className="position-absolute pd-fav">
              <FavButton type="products" id={product._id} />
            </div>
          </ProductGallery>
        </div>

        <div className="col-lg-7">
          <span className="chip chip-soft mb-2">{categoryName(product.category)}</span>
          <h1 id="pd-name" className="display-font mb-2 pd-title">
            {productName(product)}
          </h1>
          <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
            <RatingStars value={product.ratingAvg} count={product.ratingCount} />
            <StatusBadge status={soldOut ? 'sold_out' : 'available'} label={soldOut ? t('Sold out') : t('In stock')} />
          </div>
          <div className="price mb-2" style={{ fontSize: '1.9rem' }}>
            {money(product.price)} <span className="unit">{t('per')} {unitName(product.unit)}</span> <OfferTag product={product} />
          </div>
          {offerPercent(product) > 0 && product.offerEndsAt && (
            <span className="offer-ends">
              <i className="bi bi-hourglass-split" aria-hidden="true" /> {t('Offer ends {date}', { date: formatDateKey(toDateKey(new Date(product.offerEndsAt))) })}
            </span>
          )}
          {localText(product, 'description') && <p className="text-muted-2">{localText(product, 'description')}</p>}

          <div className="soft-panel my-4 pd-buy">
            <div className="d-flex justify-content-between small fw-semi mb-2">
              <span>{t('Available this week')}</span>
              <span>{qtyLabel(product.quantityAvailable, product.unit)}</span>
            </div>
            <div className={`stock-meter ${stockPct < 25 ? 'low' : ''}`}>
              <span style={{ width: `${soldOut ? 0 : Math.max(stockPct, 6)}%` }} />
            </div>
            <div className="d-flex align-items-center gap-3 mt-4 flex-wrap">
              {soldOut ? (
                <RemindMeButton product={product} initial={Boolean(data.reminding)} className="btn btn-primary btn-lg flex-grow-1" />
              ) : (
                <>
                  <QuantityStepper value={qty} onChange={setQty} min={minOf(product)} max={Math.max(minOf(product), maxOf(product))} step={stepOf(product)} unit={product.unit} size="lg" />
                  <button type="button" className="btn btn-primary btn-lg flex-grow-1" onClick={addToCart}>
                    <i className="bi bi-basket2" /> {t('Add to basket · {v1}', { v1: money(product.price * qty) })}
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
              <div className="small mt-2 text-success fw-semi">
                <i className="bi bi-check-circle" /> {t('{n} in your basket', { n: qtyLabel(inCart.quantity, product.unit) })} · <Link to="/cart">{t('View basket')}</Link>
              </div>
            )}
            {soldOut && <div className="small mt-2 text-muted-2">{t('Sold out this week. Press "Remind me" and we send a notification and an e-mail when the farmer has it again.')}</div>}
          </div>

          <div className="farmer-mini-wrap mb-3">
            <Link to={`/farmers/${farmer.slug}`} className="farmer-mini">
              <span className="logo">
                <img src={farmer.logo} alt="" />
              </span>
              <span className="flex-grow-1 min-w-0">
                <span className="fs-7 text-muted-2 d-block">{t('Grown & sold by')}</span>
                <strong className="d-block text-truncate">{farmer.stallName}</strong>
                <RatingStars value={farmer.ratingAvg} count={farmer.ratingCount} />
              </span>
              <i className="bi bi-chevron-right" />
            </Link>
            <FavButton type="farmers" id={farmer._id} className="farmer-mini-fav" />
          </div>

          <div className="soft-panel">
            <h6 className="mb-2">
              <i className="bi bi-clock-history text-success" /> {t('Pickup windows')}
            </h6>
            {Object.keys(windowsByMarket).length === 0 && <p className="small text-muted-2 mb-0">{t('This farmer hasn\'t published pickup windows yet.')}</p>}
            {Object.entries(windowsByMarket).map(([market, windows]) => (
              <div key={market} className="mb-2">
                <div className="small fw-semi">{market}</div>
                <ul className="window-list">
                  {windows.map((w) => (
                    <li key={w._id}>
                      <span className="day">{DAY_SHORT[w.day]}</span>
                      {time12(w.start)} {t('to')} {time12(w.end)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="pay-note mt-2">
              <i className="bi bi-info-circle" />
              <span>
                {t('Orders close {h} hours before your pickup slot. You pay the farmer at pickup, so there is no online payment.', { h: farmer.orderCutoffHours })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="pd-facts" aria-labelledby="pd-facts-title">
        <div className="pd-facts-head">
          <h2 id="pd-facts-title" className="h4 mb-1">
            {t('Quick facts')}
          </h2>
          {ai.summary && (
            <p className="pd-facts-summary mb-0">
              {isUrdu()
                ? t('{name} from {stall} in {city}, {price} per {unit}. Pre-order on MarketLink and collect it at the market.', { name: productName(product), stall: farmer.stallName, city: t(farmer.city), price: money(product.price), unit: unitName(product.unit) })
                : ai.summary}
            </p>
          )}
        </div>
        <dl className="pd-facts-grid">
          {facts.map(([icon, label, value]) => (
            <div key={label} className="pd-fact">
              <dt>
                <i className={`bi ${icon}`} aria-hidden="true" /> {label}
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section pb-0">
        <div className="row g-4">
          <div className="col-12">
            <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
              <h2 className="h3 mb-0">{t('Customer reviews')}</h2>
              <WriteReviewButton type="product" id={product._id} name={productName(product)} onDone={reload} />
            </div>
            <div className="soft-panel">
              {reviews.length === 0 ? <p className="text-muted-2 mb-0">{t('No reviews yet. Bought it? Share how it was.')}</p> : reviews.map((r) => <ReviewItem key={r._id} review={r} farmerName={farmer.stallName} canReply={String(myStall?._id) === String(farmer._id)} onReplied={reload} />)}
            </div>
            <div className="text-end mt-2">
              <ReportButton targetType="product" targetId={product._id} label={t('Report this listing')} />
            </div>
          </div>
        </div>
      </section>

      <section className="section pb-0" aria-labelledby="same-stall-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">{farmer.stallName}</span>
            <h2 id="same-stall-title" className="section-title">
              {t('From the same stall')}
            </h2>
          </div>
          <Link to={`/farmers/${farmer.slug}`} className="link-arrow">
            {t('Visit {name}', { name: farmer.stallName })} <i className="bi bi-arrow-right" />
          </Link>
        </div>
        {(data.fromFarmer || []).length ? (
          <CardCarousel ariaLabel={t('From the same stall')}>
            {data.fromFarmer.map((p) => (
              <div key={p._id} role="listitem">
                <ProductCard product={{ ...p, farmer: p.farmer || farmer }} />
              </div>
            ))}
          </CardCarousel>
        ) : (
          <p className="small text-muted-2 mb-0">{t('This is the only product of this stall right now.')}</p>
        )}
      </section>

      {related.length > 0 && (
        <section className="section pb-0" aria-labelledby="also-like-title">
          <div className="section-head">
            <div>
              <span className="eyebrow">{data.sameProduce ? t('The same produce at other stalls') : categoryName(product.category)}</span>
              <h2 id="also-like-title" className="section-title">
                {t('You may also like')}
              </h2>
              {data.sameProduce > 0 && <p className="small text-muted-2 mb-0">{t('Other farmers sell this too: compare their prices.')}</p>}
            </div>
            <Link to={`/products?category=${product.category?.slug}`} className="link-arrow">
              {t('More {category}', { category: isUrdu() ? categoryName(product.category) : product.category?.name?.toLowerCase() })} <i className="bi bi-arrow-right" />
            </Link>
          </div>
          <CardCarousel ariaLabel={t('You may also like')}>
            {related.map((p) => (
              <div key={p._id} role="listitem">
                <ProductCard product={p} compareWith={String(p.farmer?._id) !== String(farmer._id) && p.unit === product.unit ? product.price : undefined} />
              </div>
            ))}
          </CardCarousel>
        </section>
      )}
    </article>
  );
}
