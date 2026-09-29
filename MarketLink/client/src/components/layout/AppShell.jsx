import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useClickOutside from '../../hooks/useClickOutside';
import Avatar from '../common/Avatar';
import Logo, { LogoMark } from '../common/Logo';
import NotificationBell from './NotificationBell';
import { LINKS } from './navConfig';
import { t } from '../../i18n';
import { LanguageSwitch } from '../../i18n/LanguageProvider';

const COLLAPSE_KEY = 'ml_sidebar';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Title for the top bar: the most specific sidebar item that matches the address. */
export function titleFromNav(nav, pathname, extra = {}) {
  for (const [prefix, title] of Object.entries(extra)) if (pathname.startsWith(prefix)) return title;
  const match = nav.filter((i) => i.to && (i.end ? pathname === i.to : pathname.startsWith(i.to))).sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label || '';
}

function UserMenu({ roleLabel, links, logoutTo }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="ml-dropdown" ref={ref}>
      <button type="button" className="btn p-0 border-0 d-flex align-items-center gap-2" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('Account menu')}>
        <Avatar name={user.name} src={user.avatar} />
        <span className="d-none d-md-inline text-start lh-sm">
          <strong className="d-block small">{user.name}</strong>
          <span className="fs-7 text-muted-2">{roleLabel}</span>
        </span>
        <i className="bi bi-chevron-down small d-none d-md-inline" />
      </button>
      {open && (
        <div className="ml-dropdown-menu">
          <div className="px-3 py-2">
            <strong className="d-block">{user.name}</strong>
            <span className="fs-7 text-muted-2">{user.email}</span>
          </div>
          <hr className="my-1" />
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="ml-dropdown-item" onClick={() => setOpen(false)}>
              <i className={`bi ${l.icon}`} /> {t(l.label)}
            </Link>
          ))}
          <hr className="my-1" />
          <button
            type="button"
            className="ml-dropdown-item"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate(logoutTo);
            }}
          >
            <i className="bi bi-box-arrow-right" /> {t('Log out')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Back-office layout shared by the admin, farmer and customer areas: a dark sidebar that
 * collapses to icons on laptops (remembered in the browser) and slides in as a drawer on
 * phones, plus a top bar with the page title, quick actions, notifications and the account menu.
 */
export default function AppShell({
  role,
  nav,
  homeTo,
  areaLabel,
  roleLabel,
  title,
  badges = {},
  actions,
  menuLinks = [],
  logoutTo = '/',
  outletContext,
  before,
  after,
  sidebarFooter,
  siteNav = false, // the website's main links (Home, Shop, Markets…) in the top bar, for customers
}) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // The drawer remembers the page it was opened on and closes itself after navigation
  const [drawerPath, setDrawerPath] = useState(null);
  const drawerOpen = drawerPath === pathname;

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawerPath(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? 'collapsed' : 'open');
    } catch {
      /* private mode: the choice is simply not remembered */
    }
  }

  return (
    <div className={`app-shell shell-${role} ${collapsed ? 'is-collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      <a href="#app-main" className="skip-link">
        {t('Skip to content')}
      </a>
      <aside className="app-side" aria-label={t('{name} navigation', { name: areaLabel })}>
        <div className="app-brand">
          <span className="brand-full">
            <Logo light to={homeTo} />
          </span>
          <Link to={homeTo} className="brand-mini" aria-label={t('{name} home', { name: areaLabel })}>
            <LogoMark size={36} />
          </Link>
          <button type="button" className="app-drawer-close" onClick={() => setDrawerPath(null)} aria-label={t('Close menu')}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <nav className="app-nav">
          {nav.map((item, i) =>
            item.section ? (
              <div key={`s${i}`} className="app-section">
                <span>{t(item.section)}</span>
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className="app-link" title={collapsed ? t(item.label) : undefined}>
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span className="app-link-label">{t(item.label)}</span>
                {item.badge && badges[item.badge] > 0 && <span className={`app-badge ${item.badgeTone || ''}`}>{badges[item.badge]}</span>}
              </NavLink>
            )
          )}
        </nav>
        {sidebarFooter}
        {!pathname.startsWith('/admin') && <LanguageSwitch className="lang-switch-block app-lang d-sm-none" />}
        <button type="button" className="app-collapse" onClick={toggleCollapsed} aria-pressed={collapsed} aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}>
          <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} aria-hidden="true" />
          <span className="app-link-label">{t('Collapse sidebar')}</span>
        </button>
      </aside>
      <button type="button" className="app-backdrop" aria-label={t('Close menu')} tabIndex={-1} onClick={() => setDrawerPath(null)} />

      <div className="app-body">
        {before}
        <header className="app-top">
          <button type="button" className="nav-icon-btn app-menu-btn" onClick={() => setDrawerPath(pathname)} aria-label={t('Open menu')} aria-expanded={drawerOpen}>
            <i className="bi bi-list" />
          </button>
          <button type="button" className="nav-icon-btn app-collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}>
            <i className={`bi ${collapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}`} />
          </button>
          <div className="app-title">
            <span className="fs-7 text-muted-2 d-none d-sm-block">{areaLabel}</span>
            <strong>{t(title)}</strong>
          </div>
          {siteNav && (
            <nav className="app-site-nav" aria-label={t('Website')}>
              {LINKS.filter((l) => !l.menuOnly && !['/about', '/contact'].includes(l.to)).map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end}>
                  {t(l.label)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="app-top-actions">
            {actions}
            {!pathname.startsWith('/admin') && <LanguageSwitch className="nav-lang d-none d-sm-inline-flex" />}
            <Link to="/" className="nav-icon-btn d-none d-sm-inline-flex" title={t('View website')} aria-label={t('View website')}>
              <i className="bi bi-globe2" />
            </Link>
            <NotificationBell allLink={`${homeTo}/notifications`} />
            <UserMenu roleLabel={roleLabel} links={menuLinks} logoutTo={logoutTo} />
          </div>
        </header>
        <main id="app-main" className="app-content page-enter" key={pathname}>
          <Outlet context={outletContext} />
        </main>
      </div>
      {after}
    </div>
  );
}
