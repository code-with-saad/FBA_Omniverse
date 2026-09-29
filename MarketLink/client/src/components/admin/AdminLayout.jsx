import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import AppShell, { titleFromNav } from '../layout/AppShell';
import AdminOrderModal from './AdminOrderModal';
import AdminAccountModal from './AdminAccountModal';
import MobileTabBar from '../layout/MobileTabBar';

// Sidebar of the admin area. Reports is intentionally the last item.
export const ADMIN_NAV = [
  { section: 'Overview' },
  { to: '/admin', icon: 'bi-speedometer2', label: 'Dashboard', end: true },
  { to: '/admin/orders', icon: 'bi-receipt', label: 'Orders', badge: 'openOrders' },
  { to: '/admin/pickup-problems', icon: 'bi-exclamation-octagon', label: 'Pickup problems', badge: 'pickupProblems', badgeTone: 'warn' },
  { section: 'People' },
  { to: '/admin/farmers', icon: 'bi-shop', label: 'Farmers', badge: 'pendingFarmers', badgeTone: 'warn' },
  { to: '/admin/customers', icon: 'bi-people', label: 'Customers' },
  { section: 'Catalogue' },
  { to: '/admin/markets', icon: 'bi-geo-alt', label: 'Markets' },
  { to: '/admin/cities', icon: 'bi-buildings', label: 'Cities' },
  { to: '/admin/categories', icon: 'bi-tags', label: 'Categories' },
  { to: '/admin/products', icon: 'bi-basket', label: 'Product listings' },
  { to: '/admin/reviews', icon: 'bi-chat-square-quote', label: 'Reviews' },
  { to: '/admin/moderation', icon: 'bi-shield-check', label: 'Moderation', badge: 'openFlags', badgeTone: 'warn' },
  { section: 'Communication' },
  { to: '/admin/announcements', icon: 'bi-megaphone', label: 'Announcements' },
  { to: '/admin/offer-banner', icon: 'bi-percent', label: 'Offer banner' },
  { to: '/admin/messages', icon: 'bi-envelope', label: 'Contact messages', badge: 'newMessages', badgeTone: 'warn' },
  { to: '/admin/newsletter', icon: 'bi-envelope-paper-heart', label: 'Newsletter' },
  { to: '/admin/faqs', icon: 'bi-question-circle', label: 'FAQs' },
  { to: '/admin/notifications', icon: 'bi-bell', label: 'Notifications' },
  { section: 'Insights' },
  { to: '/admin/purchases', icon: 'bi-diagram-3', label: 'Customer purchases' },
  { to: '/admin/attendance', icon: 'bi-calendar-check', label: 'Market attendance' },
  { to: '/admin/reports', icon: 'bi-file-earmark-bar-graph', label: 'Reports' },
];

const MENU = [
  { to: '/', icon: 'bi-globe2', label: 'View website' },
  { to: '/admin/notifications', icon: 'bi-bell', label: 'Notifications' },
];

/** Admin area: the shared back-office shell with admin counters and the order / account dialogs. */
export default function AdminLayout() {
  const { pathname } = useLocation();
  const [badges, setBadges] = useState({});
  const [modal, setModal] = useState(null); // 'order' | 'farmer' | 'customer'
  const [changed, setChanged] = useState(0); // bumps after a dialog creates something, so pages reload

  const refreshBadges = useCallback(() => {
    api.get('/admin/badges').then(setBadges).catch(() => {});
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [pathname, changed, refreshBadges]);

  const done = () => {
    setModal(null);
    setChanged((n) => n + 1);
  };

  return (
    <AppShell
      role="admin"
      nav={ADMIN_NAV}
      homeTo="/admin"
      areaLabel="Admin"
      roleLabel="Administrator"
      title={titleFromNav(ADMIN_NAV, pathname, { '/admin/orders/': 'Order details', '/admin/customers/': 'Customer details' })}
      badges={badges}
      menuLinks={MENU}
      logoutTo="/login"
      outletContext={{ openModal: setModal, changed, refreshBadges }}
      actions={
        <>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal('order')}>
            <i className="bi bi-bag-plus" aria-hidden="true" /> <span className="d-none d-lg-inline">Place order</span>
          </button>
          <button type="button" className="btn btn-sm btn-lime" onClick={() => setModal('farmer')}>
            <i className="bi bi-person-plus" aria-hidden="true" /> <span className="d-none d-lg-inline">Add farmer</span>
          </button>
        </>
      }
      after={
        <>
          {modal === 'order' && <AdminOrderModal onClose={() => setModal(null)} onPlaced={done} />}
          {(modal === 'farmer' || modal === 'customer') && <AdminAccountModal type={modal} onClose={() => setModal(null)} onCreated={done} />}
          {/* the same bottom bar as the customer and farmer areas on phones and tablets */}
          <MobileTabBar />
        </>
      }
    />
  );
}
