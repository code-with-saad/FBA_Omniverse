import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Logo from '../common/Logo';
import GlobalSearch from './GlobalSearch';
import { useAuth } from '../../context/AuthContext';
import { LINKS, MENUS, visibleItems } from './navConfig';
import Avatar from '../common/Avatar';
import { t } from '../../i18n';
import { ROLE_LABEL } from './navConfig';
import { LanguageSwitch } from '../../i18n/LanguageProvider';

/**
 * Slide-in menu for phones and tablets. It is rendered into <body> (outside the sticky header)
 * so it scrolls on its own, covers the page with a backdrop and never pushes the header down.
 */
export default function MobileMenu({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden'; // keep the page behind the drawer still
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleLogout() {
    onClose();
    await logout();
    navigate('/');
  }

  return createPortal(
    <div className="mobile-menu-layer d-lg-none">
      <button type="button" className="mobile-menu-backdrop" aria-label={t('Close menu')} onClick={onClose} />
      <aside className="mobile-menu" role="dialog" aria-modal="true" aria-label={t('Menu')}>
        <div className="mobile-menu-head">
          <Logo />
          <button type="button" className="nav-icon-btn" onClick={onClose} aria-label={t('Close menu')} ref={closeRef}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="mobile-menu-body">
          <GlobalSearch className="mb-3" />
          <LanguageSwitch className="lang-switch-block mb-3" />

          {user && (
            <div className="mobile-menu-user">
              <Avatar name={user.name} src={user.avatar} />
              <div className="min-w-0">
                <strong className="d-block text-truncate">{user.name}</strong>
                <span className="fs-7 text-muted-2 text-truncate d-block">{user.email}</span>
              </div>
              <span className="chip chip-soft text-capitalize ms-auto">{t(ROLE_LABEL[user.role] || user.role)}</span>
            </div>
          )}

          <p className="mobile-menu-section">{t('Explore')}</p>
          <nav className="mobile-menu-links" aria-label={t('Main')}>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={onClose}>
                <i className={`bi ${l.icon}`} /> {t(l.label)}
              </NavLink>
            ))}
          </nav>

          {user ? (
            <>
              <p className="mobile-menu-section">{t('My account')}</p>
              <nav className="mobile-menu-links" aria-label={t('Account')}>
                {visibleItems(MENUS[user.role] || [], user).map((m) => (
                  <NavLink key={m.to} to={m.to} end onClick={onClose}>
                    <i className={`bi ${m.icon}`} /> {t(m.label)}
                  </NavLink>
                ))}
                <button type="button" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right" /> {t('Log out')}
                </button>
              </nav>
            </>
          ) : (
            <div className="d-grid gap-2 mt-4">
              <Link to="/login" className="btn btn-primary" onClick={onClose}>
                <i className="bi bi-person-circle" /> {t('Log in')}
              </Link>
              <Link to="/register" className="btn btn-white" onClick={onClose}>
                {t('Create a customer account')}
              </Link>
              <Link to="/register/farmer" className="btn btn-lime" onClick={onClose}>
                <i className="bi bi-shop" /> {t('Sell with us')}
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
