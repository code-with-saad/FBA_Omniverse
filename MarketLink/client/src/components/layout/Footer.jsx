import { Link, useLocation } from 'react-router-dom';
import Logo from '../common/Logo';
import SocialLinks from '../common/SocialLinks';
import NewsletterCta from '../home/NewsletterCta';
import { CONTACT, TEAM_NAME } from '../../config';
import { t } from '../../i18n';

export default function Footer() {
  // "Subscribe" sits just above the footer on every public page
  const { pathname } = useLocation();
  return (
    <>
      <NewsletterCta variant="strip" source={pathname === '/' ? 'home' : 'footer'} />
      <footer className="ml-footer">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-4">
              <Logo light />
              <p className="mt-3 small" style={{ maxWidth: 340 }}>
                {t('MarketLink brings local farmers markets online. See what\'s in stock before you go, pre-order for pickup and support the growers in your community.')}
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <span className="chip chip-lime">
                  <i className="bi bi-cash-coin" /> {t('Pay at pickup')}
                </span>
                <span className="chip">
                  <i className="bi bi-geo-alt" /> {t('Pickup only')}
                </span>
              </div>
              <SocialLinks className="mt-3" />
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <h6>{t('Shop')}</h6>
              <ul className="list-unstyled d-grid gap-2 small">
                <li><Link to="/">{t('Home')}</Link></li>
                <li><Link to="/products">{t('All products')}</Link></li>
                <li><Link to="/categories">{t('Categories')}</Link></li>
                <li><Link to="/best-sellers">{t('Best sellers')}</Link></li>
                <li><Link to="/markets">{t('Markets')}</Link></li>
                <li><Link to="/farmers">{t('Farmers')}</Link></li>
                <li><Link to="/map">{t('Market map')}</Link></li>
              </ul>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <h6>{t('For farmers')}</h6>
              <ul className="list-unstyled d-grid gap-2 small">
                <li><Link to="/register/farmer">{t('Register your stall')}</Link></li>
                <li><Link to="/login">{t('Log in')}</Link></li>
                <li><Link to="/about">{t('How it works')}</Link></li>
              </ul>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <h6>{t('Help & legal')}</h6>
              <ul className="list-unstyled d-grid gap-2 small">
                <li><Link to="/faq">{t('FAQs')}</Link></li>
                <li><Link to="/contact">{t('Contact us')}</Link></li>
                <li><Link to="/about">{t('About MarketLink')}</Link></li>
                <li><Link to="/terms">{t('Terms & Conditions')}</Link></li>
                <li><Link to="/terms#terms-privacy">{t('Privacy')}</Link></li>
              </ul>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <h6>{t('Contact')}</h6>
              <ul className="list-unstyled d-grid gap-2 small footer-contact">
                <li><i className="bi bi-envelope" aria-hidden="true" /> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
                <li><i className="bi bi-telephone" aria-hidden="true" /> <bdi dir="ltr">{CONTACT.phone}</bdi></li>
              </ul>
            </div>
          </div>
          <p className="footer-line">
            © {new Date().getFullYear()} MarketLink · {t('Built by')} <Link to="/about">{TEAM_NAME}</Link> · <Link to="/terms">{t('Terms & Conditions')}</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
