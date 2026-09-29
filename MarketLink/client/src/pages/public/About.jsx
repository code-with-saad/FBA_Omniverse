import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { PageHero } from '../../components/common/PageHeader';
import { TEAM, TEAM_NAME, TEAM_PLACE } from '../../config';
import { initials } from '../../utils/format';
import { LogoMark } from '../../components/common/Logo';
import CountUp from '../../components/common/CountUp';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd } from '../../utils/seo';
import { t } from '../../i18n';

const VALUES = [
  { icon: 'bi-signpost-split', color: '#e4f3d8', title: 'Fewer wasted trips', text: 'Customers see live stock and prices before leaving home, so nobody arrives to an empty stall.' },
  { icon: 'bi-calendar-check', color: '#f8e8cf', title: 'Better harvest planning', text: 'Pre-orders tell farmers exactly how much to pick and bring, reducing food waste.' },
  { icon: 'bi-people', color: '#fde7d6', title: 'Real relationships', text: 'Favourites, reviews and replies build a lasting connection between growers and families.' },
  { icon: 'bi-cash-coin', color: '#e3eefb', title: 'Simple & fair', text: 'No online payments, no delivery fees. Reserve online, collect and pay the farmer in person.' },
];

export default function About() {
  useSeo({ title: t('About MarketLink'), description: t('MarketLink brings local farmers markets online so families can reserve fresh food before market day and farmers waste less. Built by Team Omniverse.'), jsonLd: breadcrumbLd([{ name: 'About MarketLink', path: '/about' }]) });
  const { data } = useFetch('/stats');
  return (
    <>
      <PageHero crumbs={[{ label: t('About') }]} title={t('Bringing the farmers market online, without losing its soul')} subtitle={t('MarketLink (theme: eGreen Basket) is a platform that connects local farmers-market stalls with the families who shop there.')} />
      <div className="container pb-5">
        <div className="row g-4 align-items-stretch mb-5">
          <div className="col-lg-7">
            <div className="soft-panel h-100">
              <span className="eyebrow">{t('Why we built it')}</span>
              <h2 className="h3 mt-2">{t('The problem')}</h2>
              <p className="text-muted-2">
                {t('Local markets are growing, but availability is still shared on chalkboards, flyers and by word of mouth. Shoppers arrive to find popular items sold out or a stall closed for the week, and farmers have no easy way to publish weekly stock or take orders in advance.')}
              </p>
              <h2 className="h3 mt-4">{t('Our solution')}</h2>
              <p className="text-muted-2 mb-0">
                {t('Farmers publish their weekly stock, prices and pickup windows. Customers find nearby markets on the map, browse and filter products, pre-order for a pickup slot, and leave reviews after collecting. Admins keep the platform healthy by approving farmers, managing markets and moderating content. An AI assistant answers everyday questions like market timings and pickup windows.')}
              </p>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="cta-band about-stats h-100 d-flex flex-column justify-content-center">
              <img className="about-stats-photo" src="/images/hero/pickup.webp" alt={t('Crates of fresh fruit and vegetables at a farmers market')} loading="lazy" />
              <div className="row g-3 text-center position-relative">
                {[
                  [data?.markets, t('Markets')],
                  [data?.farmers, t('Farmers')],
                  [data?.products, t('Products')],
                  [data?.ordersCompleted, t('Pickups')],
                ].map(([n, label]) => (
                  <div key={label} className="col-6">
                    <div className="display-font text-lime" style={{ fontSize: '2.6rem' }}>
                      <CountUp value={n} />
                    </div>
                    <div className="small text-uppercase ls-wide" style={{ color: 'rgba(255,255,255,.7)' }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="section-head">
          <div>
            <span className="eyebrow">{t('What we care about')}</span>
            <h2 className="section-title">{t('Our values')}</h2>
          </div>
        </div>
        <div className="row g-3 mb-5">
          {VALUES.map((v) => (
            <div key={v.title} className="col-sm-6 col-lg-3">
              <div className="value-card" style={{ '--tile-bg': v.color }}>
                <span className="value-icon" aria-hidden="true">
                  <i className={`bi ${v.icon}`} />
                </span>
                <h5>{t(v.title)}</h5>
                <p className="small mb-0">{t(v.text)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="section-head">
          <div>
            <span className="eyebrow">{t('The team')}</span>
            <h2 className="section-title">{t('Who built MarketLink')}</h2>
            <p>{t('Created by {team} for the TechWiz 2026 “End-to-End Web Solutions” challenge.', { team: TEAM_NAME })}</p>
          </div>
        </div>
        <div className="team-banner mb-3">
          <span className="team-banner-mark">
            <LogoMark size={64} />
          </span>
          <div className="team-banner-text">
            <span className="team-banner-label">{t('Designed and developed by')}</span>
            <h3 className="team-banner-name">{TEAM_NAME}</h3>
            <p className="mb-0">
              <i className="bi bi-geo-alt me-1" aria-hidden="true" />
              {t(TEAM_PLACE)}
            </p>
          </div>
          <div className="team-banner-chips">
            <span className="chip hero-chip">
              <i className="bi bi-trophy" aria-hidden="true" /> {t('TechWiz 2026')}
            </span>
            <span className="chip hero-chip">
              <i className="bi bi-basket2" aria-hidden="true" /> {t('MarketLink')}
            </span>
          </div>
        </div>
        <div className="row g-3 mb-5">
          {TEAM.map((m) => (
            <div key={m.area} className="col-sm-6 col-lg-3">
              <div className="team-card">
                {m.github ? (
                  <a href={m.github} target="_blank" rel="noopener noreferrer" className="avatar text-decoration-none" title={t('View GitHub Profile')}>
                    {m.name ? initials(m.name) : <i className={`bi ${m.icon}`} aria-hidden="true" />}
                  </a>
                ) : (
                  <span className="avatar">{m.name ? initials(m.name) : <i className={`bi ${m.icon}`} aria-hidden="true" />}</span>
                )}
                <h5 className="mb-1">
                  {m.github ? (
                    <a
                      href={m.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-decoration-none text-dark hover-lime d-inline-flex align-items-center gap-1"
                      title={t('View GitHub Profile')}
                    >
                      {m.name || t(m.area)}
                      <i className="bi bi-github text-muted small ms-1" aria-hidden="true" />
                    </a>
                  ) : (
                    m.name || t(m.area)
                  )}
                </h5>
                {m.name && <p className="small fw-semi text-forest mb-1">{t(m.area)}</p>}
                <p className="small text-muted-2 mb-2">{t(m.role)}</p>
                <span className="team-tag">{TEAM_NAME}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="soft-panel d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h3 className="h4 mb-1">{t('Have questions?')}</h3>
            <p className="text-muted-2 mb-0">{t('Our team is happy to help farmers and shoppers get started.')}</p>
          </div>
          <div className="d-flex gap-2">
            <Link to="/contact" className="btn btn-primary">
              {t('Contact us')}
            </Link>
            <Link to="/register/farmer" className="btn btn-lime">
              {t('Become a seller')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
