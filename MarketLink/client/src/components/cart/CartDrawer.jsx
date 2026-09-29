import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ProduceImage from '../common/ProduceImage';
import QuantityStepper from '../common/QuantityStepper';
import { money } from '../../utils/format';
import { productPath } from '../../utils/links';
import { productName, t, unitName } from '../../i18n';
import { maxOf, minOf, stepOf } from '../../utils/quantity';

/** Basket in a sidebar on the right: lines per farmer, quantities, total, full basket and checkout. */
export default function CartDrawer() {
  const cart = useCart();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const panel = useRef(null);
  const { drawerOpen: open, closeDrawer } = cart;
  // "Empty basket" asks once before removing everything (per opening of the sidebar)
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmFor, setConfirmFor] = useState(open);
  if (confirmFor !== open) {
    setConfirmFor(open);
    setConfirmEmpty(false);
  }

  // Close when the page changes
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, closeDrawer]);

  const go = (to) => {
    closeDrawer();
    navigate(to);
  };
  const canOrder = !user || user.role === 'customer';

  function emptyBasket() {
    const lines = cart.items.length;
    cart.clear();
    setConfirmEmpty(false);
    toast(lines === 1 ? t('Basket emptied (1 product removed)') : t('Basket emptied ({n} products removed)', { n: lines }), 'info');
    panel.current?.focus({ preventScroll: true });
  }

  return createPortal(
    <div className={`cart-drawer-root ${open ? 'is-open' : ''}`} inert={!open}>
      <button type="button" className="cart-drawer-backdrop" aria-label={t('Close basket')} tabIndex={-1} onClick={closeDrawer} />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label={t('Your basket')} tabIndex={-1} ref={panel}>
        <header className="cart-drawer-head">
          <div>
            <h5 className="mb-0">{t('Your basket')}</h5>
            <span className="fs-7 text-muted-2">
              {cart.count === 1 ? t('1 item') : t('{n} items', { n: cart.count })}
              {cart.groups.length > 0 && ` ${cart.groups.length === 1 ? t('from 1 farmer') : t('from {n} farmers', { n: cart.groups.length })}`}
            </span>
          </div>
          <button type="button" className="btn-close" onClick={closeDrawer} aria-label={t('Close basket')} />
        </header>

        {cart.items.length === 0 ? (
          <div className="cart-drawer-empty">
            <span className="empty-icon" aria-hidden="true">
              <i className="bi bi-basket2" />
            </span>
            <strong>{t('Your basket is empty')}</strong>
            <span className="small text-muted-2">{t('Add fresh produce from local farmers, then pick a pickup slot.')}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go('/products')}>
              {t('Browse products')}
            </button>
          </div>
        ) : (
          <>
            <div className="cart-drawer-body">
              {cart.groups.map((g) => (
                <section key={g.farmer._id} className="cart-drawer-group">
                  <div className="cart-drawer-farmer">
                    {g.farmer.logo && <img src={g.farmer.logo} alt="" />}
                    <Link to={`/farmers/${g.farmer.slug}`} className="flex-grow-1 text-truncate">
                      {g.farmer.stallName}
                    </Link>
                    <strong className="small">{money(g.subtotal)}</strong>
                  </div>
                  {g.items.map((item) => (
                    <div key={item.productId} className="cart-drawer-line">
                      <ProduceImage src={item.image} color={item.categoryColor} className="cart-drawer-thumb" />
                      <div className="min-w-0 flex-grow-1">
                        <Link to={productPath(item)} className="d-block text-truncate fw-semi small text-reset">
                          {productName(item)}
                        </Link>
                        <span className="fs-7 text-muted-2">
                          {money(item.price)} / {unitName(item.unit)}
                        </span>
                        <div className="d-flex align-items-center justify-content-between mt-1">
                          <QuantityStepper value={item.quantity} min={minOf(item)} max={Math.max(minOf(item), maxOf(item, item.maxQty || 999))} step={stepOf(item)} unit={item.unit} onChange={(q) => cart.update(item.productId, q)} size="sm" />
                          <strong className="small">{money(item.price * item.quantity)}</strong>
                        </div>
                      </div>
                      <button type="button" className="cart-drawer-remove" onClick={() => cart.remove(item.productId)} aria-label={t('Remove {name}', { name: productName(item) })} title={t('Remove')}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <footer className="cart-drawer-foot">
              <div className="d-flex justify-content-between align-items-end mb-2">
                <span className="fw-semi small">{t('Total due at pickup')}</span>
                <span className="total">{money(cart.total)}</span>
              </div>
              <p className="fs-7 text-muted-2 mb-3">
                <i className="bi bi-cash-coin" /> {t('No online payment: you pay each farmer when you collect.')}
              </p>
              {canOrder ? (
                <button type="button" className="btn btn-primary w-100 mb-2" onClick={() => go('/checkout')}>
                  {t('Checkout')} <i className="bi bi-arrow-right" />
                </button>
              ) : (
                <div className="alert alert-warning small py-2 mb-2">{t('Only customer accounts can place pre-orders.')}</div>
              )}
              <div className="cart-drawer-actions">
                <button type="button" className="btn btn-white flex-grow-1" onClick={() => go('/cart')}>
                  <i className="bi bi-basket2" /> {t('View full basket')}
                </button>
                <button type="button" className="btn btn-outline-danger cart-empty-btn" onClick={() => setConfirmEmpty(true)} aria-expanded={confirmEmpty} aria-controls="cart-empty-confirm">
                  <i className="bi bi-trash3" /> {t('Empty basket')}
                </button>
              </div>
              {confirmEmpty && (
                <div id="cart-empty-confirm" className="cart-empty-confirm" role="alertdialog" aria-label={t('Empty the basket?')}>
                  <span className="small fw-semi">{t('Remove all {n} items from your basket?', { n: cart.count })}</span>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-white" onClick={() => setConfirmEmpty(false)}>
                      {t('Keep them')}
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={emptyBasket} autoFocus>
                      {t('Yes, empty it')}
                    </button>
                  </div>
                </div>
              )}
            </footer>
          </>
        )}
      </aside>
    </div>,
    document.body
  );
}
