import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import AppShell, { titleFromNav } from './AppShell';
import AnnouncementBar from './AnnouncementBar';
import MobileTabBar from './MobileTabBar';
import ChatWidget from '../chat/ChatWidget';
import CartDrawer from '../cart/CartDrawer';
import { visibleItems } from './navConfig';
import { t } from '../../i18n';

// Sidebars of the customer and farmer areas (same look as the admin area).
// Items marked `approved` are hidden until an admin approves the farmer.
export const NAVS = {
  customer: [
    { section: 'My account' },
    { to: '/account', icon: 'bi-grid-1x2', label: 'Dashboard', end: true },
    { to: '/account/orders', icon: 'bi-bag', label: 'My orders', badge: 'ready' },
    { to: '/account/favorites', icon: 'bi-heart', label: 'Favourites' },
    { to: '/account/reviews', icon: 'bi-star', label: 'My reviews', badge: 'toReview', badgeTone: 'warn' },
    { to: '/account/notifications', icon: 'bi-bell', label: 'Notifications' },
    { to: '/account/profile', icon: 'bi-person-gear', label: 'Profile & family' },
    { section: 'Shop' },
    { to: '/products', icon: 'bi-basket', label: 'Browse products' },
    { to: '/farmers', icon: 'bi-people', label: 'Farmers' },
    { to: '/map', icon: 'bi-map', label: 'Market map' },
  ],
  farmer: [
    { section: 'My stall' },
    { to: '/farmer', icon: 'bi-graph-up-arrow', label: 'Dashboard', end: true },
    { to: '/farmer/orders', icon: 'bi-receipt', label: 'Pre-orders', approved: true, badge: 'newOrders' },
    { to: '/farmer/products', icon: 'bi-basket', label: 'Products & Pricing', approved: true },
    { to: '/farmer/inventory', icon: 'bi-box-seam', label: 'Inventory', approved: true, badge: 'lowStock', badgeTone: 'warn' },
    { to: '/farmer/pickup', icon: 'bi-geo-alt', label: 'Markets & pickup', approved: true },
    { to: '/farmer/reviews', icon: 'bi-star', label: 'Reviews', approved: true },
    { section: 'Account' },
    { to: '/farmer/profile', icon: 'bi-shop-window', label: 'Stall profile' },
    { to: '/farmer/notifications', icon: 'bi-bell', label: 'Notifications' },
    { section: 'Insights', approved: true },
    { to: '/farmer/sales', icon: 'bi-file-earmark-bar-graph', label: 'Sales report', approved: true },
  ],
};

const MENUS = {
  customer: [
    { to: '/account', icon: 'bi-grid', label: 'My dashboard' },
    { to: '/account/orders', icon: 'bi-bag', label: 'My orders' },
    { to: '/account/profile', icon: 'bi-person', label: 'Profile & family' },
    { to: '/', icon: 'bi-globe2', label: 'Back to the shop' },
  ],
  farmer: [
    { to: '/farmer', icon: 'bi-graph-up', label: 'Dashboard' },
    { to: '/farmer/profile', icon: 'bi-shop-window', label: 'Stall profile' },
    { to: '/', icon: 'bi-globe2', label: 'View website' },
  ],
};

/** Customer and farmer areas: the shared back-office shell with role counters, quick actions and the chat. */
export default function DashboardLayout({ role }) {
  const { user, farmer } = useAuth();
  const { count, openDrawer } = useCart();
  const { pathname } = useLocation();
  const nav = visibleItems(NAVS[role], user).filter((item, i, list) => !item.section || (list[i + 1] && !list[i + 1].section));
  const [badges, setBadges] = useState({});
  const approved = role !== 'farmer' || user?.status === 'active';

  const refreshBadges = useCallback(() => {
    if (!approved) return;
    api.get(`/${role}/badges`).then(setBadges).catch(() => {});
  }, [role, approved]);

  useEffect(() => {
    refreshBadges();
  }, [pathname, refreshBadges]);

  const actions =
    role === 'customer' ? (
      <>
        <Link to="/products" className="btn btn-sm btn-primary">
          <i className="bi bi-shop" aria-hidden="true" /> <span className="d-none d-lg-inline">{t('Shop')}</span>
        </Link>
        <button type="button" className="nav-icon-btn" onClick={openDrawer} aria-label={t('Basket, {count} items', { count })} title={t('Basket')} aria-haspopup="dialog">
          <i className="bi bi-basket2" />
          {count > 0 && <span key={count} className="count">{count > 99 ? '99+' : count}</span>}
        </button>
      </>
    ) : approved ? (
      <>
        <Link to="/farmer/products?new=1" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg" aria-hidden="true" /> <span className="d-none d-lg-inline">{t('Add product')}</span>
        </Link>
        {farmer?.slug && (
          <Link to={`/farmers/${farmer.slug}`} className="btn btn-sm btn-lime d-none d-md-inline-flex">
            <i className="bi bi-shop-window" aria-hidden="true" /> <span className="d-none d-lg-inline">{t('My stall page')}</span>
          </Link>
        )}
      </>
    ) : null;

  return (
    <AppShell
      role={role}
      nav={nav}
      homeTo={role === 'customer' ? '/account' : '/farmer'}
      areaLabel={role === 'customer' ? t('My account') : farmer?.stallName || t('My stall')}
      roleLabel={role === 'customer' ? t('Customer') : user?.status === 'active' ? t('Farmer') : t('Farmer · {status}', { status: t(user?.status) })}
      title={titleFromNav(nav, pathname, { '/account/orders/': t('Order details'), '/farmer/orders/': t('Order details') })}
      badges={badges}
      actions={actions}
      menuLinks={MENUS[role]}
      logoutTo="/"
      siteNav={role === 'customer'}
      outletContext={{ refreshBadges }}
      before={<AnnouncementBar />}
      after={
        <>
          <ChatWidget key={user?._id || 'guest'} />
          <MobileTabBar />
          {role === 'customer' && <CartDrawer />}
        </>
      }
    />
  );
}
