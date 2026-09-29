import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import AnnouncementBar from './AnnouncementBar';
import ChatWidget from '../chat/ChatWidget';
import MobileTabBar from './MobileTabBar';
import CartDrawer from '../cart/CartDrawer';
import { useAuth } from '../../context/AuthContext';
import useScrollReveal from '../../hooks/useScrollReveal';
import { RouteSkeleton } from '../common/Skeletons';
import { t } from '../../i18n';

export default function PublicLayout({ footer = true }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const { user } = useAuth();
  useScrollReveal('main', pathname);
  return (
    <>
      <a href="#main" className="skip-link">
        {t('Skip to content')}
      </a>
      {!isAdmin && <AnnouncementBar />}
      <Navbar />
      <main id="main" className="page-enter" key={pathname.split('/')[1]}>
        {/* While a page's code downloads (slow connection) its shape is shown instead of a blank page */}
        <Suspense fallback={<RouteSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      {footer && !isAdmin && <Footer />}
      {!isAdmin && <ChatWidget key={user?._id || 'guest'} />}
      <MobileTabBar />
      <CartDrawer />
    </>
  );
}
