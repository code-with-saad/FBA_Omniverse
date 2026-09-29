import { Link, useNavigate } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import ProduceImage from '../../components/common/ProduceImage';
import QuantityStepper from '../../components/common/QuantityStepper';
import EmptyState from '../../components/common/EmptyState';
import { PageHero } from '../../components/common/PageHeader';
import { money } from '../../utils/format';
import { productPath } from '../../utils/links';
import { productName, t, unitName } from '../../i18n';
import { maxOf, minOf, stepOf } from '../../utils/quantity';

export default function Cart() {
  useDocumentTitle(t('Your basket'));
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!cart.items.length)
    return (
      <div className="container py-5">
        <EmptyState
          title={t('Your basket is empty')}
          message={t('Browse this week\'s harvest and add a few things. You\'ll choose a pickup slot at checkout.')}
          action={<Link to="/products" className="btn btn-primary">{t('Start shopping')}</Link>}
        />
      </div>
    );


  return (
    <>
      <PageHero crumbs={[{ label: t('Basket') }]} title={t('Your basket')} subtitle={t('{items} from {farmers}. Each farmer gets its own pickup slot.', { items: cart.count === 1 ? t('1 item') : t('{n} items', { n: cart.count }), farmers: cart.groups.length === 1 ? t('1 farmer') : t('{n} farmers', { n: cart.groups.length }) })} />
      <div className="container pb-5">
        <div className="row g-4">
          <div className="col-lg-8 d-grid gap-3">
            {cart.groups.map((g) => (
              <div key={g.farmer._id} className="cart-group">
                <div className="cart-group-head">
                  {g.farmer.logo && <img src={g.farmer.logo} alt="" />}
                  <div className="flex-grow-1">
                    <span className="fs-7 text-muted-2 d-block">{t('Pickup from')}</span>
                    <Link to={`/farmers/${g.farmer.slug}`} className="fw-bold">
                      {g.farmer.stallName}
                    </Link>
                  </div>
                  <strong>{money(g.subtotal)}</strong>
                </div>
                {g.items.map((item) => (
                  <div key={item.productId} className="cart-line">
                    <div className="thumb">
                      <ProduceImage src={item.image} color={item.categoryColor} />
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <Link to={productPath(item)} className="name d-block text-truncate text-reset">
                        {productName(item)}
                      </Link>
                      <span className="small text-muted-2">
                        {money(item.price)} / {unitName(item.unit)}
                      </span>
                    </div>
                    <QuantityStepper value={item.quantity} min={minOf(item)} max={Math.max(minOf(item), maxOf(item, item.maxQty || 999))} step={stepOf(item)} unit={item.unit} onChange={(q) => cart.update(item.productId, q)} />
                    <strong className="d-none d-sm-block text-end" style={{ minWidth: 90 }}>
                      {money(item.price * item.quantity)}
                    </strong>
                    <button type="button" className="btn btn-sm btn-icon btn-white" onClick={() => cart.remove(item.productId)} aria-label={t('Remove {name}', { name: productName(item) })}>
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-link text-danger p-0" onClick={cart.clear}>
                <i className="bi bi-x-circle" /> {t('Empty basket')}
              </button>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="summary-card">
              <h5 className="mb-3">{t('Order summary')}</h5>
              {cart.groups.map((g) => (
                <div key={g.farmer._id} className="info-row">
                  <span>{g.farmer.stallName}</span>
                  <span>{money(g.subtotal)}</span>
                </div>
              ))}
              <div className="d-flex justify-content-between align-items-end mt-3 mb-3">
                <span className="fw-semi">{t('Total due at pickup')}</span>
                <span className="total">{money(cart.total)}</span>
              </div>
              <div className="pay-note mb-3">
                <i className="bi bi-cash-coin" />
                <span>{t('No online payment. You pay each farmer when you collect your order.')}</span>
              </div>
              {user && user.role !== 'customer' ? (
                <div className="alert alert-warning small mb-0">{t('Only customer accounts can place pre-orders.')}</div>
              ) : (
                <>
                  <button type="button" className="btn btn-primary btn-lg w-100" onClick={() => navigate('/checkout')}>
                    {user ? t('Choose pickup & checkout') : t('Checkout')} <i className="bi bi-arrow-right" />
                  </button>
                  {!user && (
                    <p className="small text-muted-2 text-center mt-2 mb-0">
                      {t('No account needed ·')} <Link to="/login" state={{ from: '/checkout' }}>{t('Log in')}</Link> {t('if you have one')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
