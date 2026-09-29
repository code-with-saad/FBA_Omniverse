import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { t } from '../../i18n';

const TABS = {
  guest: [
    { to: '/', icon: 'bi-house', label: 'Home', end: true },
    { to: '/products', icon: 'bi-shop', label: 'Shop' },
    { to: '/map', icon: 'bi-map', label: 'Map' },
    { to: '/cart', icon: 'bi-basket2', label: 'Basket', cart: true },
    { to: '/login', icon: 'bi-person-circle', label: 'Log in' },
  ],
  customer: [
    { to: '/', icon: 'bi-house', label: 'Home', end: true },
    { to: '/products', icon: 'bi-shop', label: 'Shop' },
    { to: '/map', icon: 'bi-map', label: 'Map' },
    { to: '/cart', icon: 'bi-basket2', label: 'Basket', cart: true },
    { to: '/account', icon: 'bi-person-circle', label: 'Account' },
  ],
  farmer: [
    { to: '/farmer', icon: 'bi-graph-up-arrow', label: 'Stall', end: true },
    { to: '/farmer/orders', icon: 'bi-receipt', label: 'Orders' },
    { to: '/farmer/products', icon: 'bi-basket', label: 'Products' },
    { to: '/farmer/pickup', icon: 'bi-geo-alt', label: 'Pickup' },
    { to: '/farmer/profile', icon: 'bi-shop-window', label: 'Profile' },
  ],
  // Waiting for approval: no selling features yet
  farmerPending: [
    { to: '/', icon: 'bi-house', label: 'Home', end: true },
    { to: '/farmer', icon: 'bi-hourglass-split', label: 'Status', end: true },
    { to: '/farmer/profile', icon: 'bi-shop-window', label: 'Profile' },
    { to: '/farmer/notifications', icon: 'bi-bell', label: 'Alerts' },
  ],
  admin: [
    { to: '/admin', icon: 'bi-speedometer2', label: 'Dashboard', end: true },
    { to: '/admin/farmers', icon: 'bi-shop', label: 'Farmers' },
    { to: '/admin/orders', icon: 'bi-receipt', label: 'Orders' },
    { to: '/admin/markets', icon: 'bi-geo-alt', label: 'Markets' },
    { to: '/admin/reports', icon: 'bi-file-earmark-bar-graph', label: 'Reports' },
  ],
};

/** App-style bottom navigation shown on phones and tablets (below the lg breakpoint). */
export default function MobileTabBar() {
  const { user } = useAuth();
  const { count } = useCart();
  const role = user?.role === 'farmer' && user.status !== 'active' ? 'farmerPending' : user?.role;
  const tabs = TABS[role] || TABS.guest;
  return (
    <nav className="mobile-tabbar d-lg-none" aria-label={t('Quick navigation')}>
      {tabs.map((tx) => (
        <NavLink key={tx.to} to={tx.to} end={tx.end} className="tab">
          <span className="tab-icon">
            <i className={`bi ${tx.icon}`} aria-hidden="true" />
            {tx.cart && count > 0 && (
              <span key={count} className="tab-count">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </span>
          <span className="tab-label">{t(tx.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
