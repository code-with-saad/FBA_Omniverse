import { Link } from 'react-router-dom';
import { Bone } from '../common/Skeletons';
import { isUrdu, t } from '../../i18n';
import { srcSetFor } from '../../utils/hires';

/** A banner field in the site language ("{percent}" becomes the number); empty Urdu falls back to English. */
export function bannerText(banner, field) {
  const text = (isUrdu() && banner?.[`${field}Ur`]) || banner?.[field] || '';
  return text.replace(/\{percent\}/g, banner?.shownPercent ?? banner?.percent ?? 0);
}

/**
 * "Up to 30% off" offer banner on the home page. The MarketLink team edits the words, the percent,
 * the photo and the link in Admin → Offer banner. `preview` shows it without the page section around it.
 */
export default function OfferBanner({ banner, loading = false, preview = false }) {
  if (!loading && (!banner || (!banner.isActive && !preview))) return null;
  const percent = banner?.shownPercent ?? banner?.percent;
  const card = (
    <div className={`offer-banner ${banner && !banner.isActive ? 'is-hidden' : ''}`}>
      <div className="offer-copy">
        {loading ? (
          <>
            <Bone w="30%" h={22} r="99px" />
            <Bone w="80%" h={40} className="mt-3" />
            <Bone w="90%" h={16} className="mt-3" />
          </>
        ) : (
          <>
            <span className="offer-banner-tag">
              <i className="bi bi-lightning-charge-fill" aria-hidden="true" /> {bannerText(banner, 'tag')}
            </span>
            <h2 id={preview ? undefined : 'deal-title'} className="offer-title text-balance">
              {bannerText(banner, 'title')}
            </h2>
            {banner.text && <p className="offer-text">{bannerText(banner, 'text')}</p>}
            <Link to={banner.link || '/products'} className="btn btn-lime btn-lg" tabIndex={preview ? -1 : undefined}>
              {bannerText(banner, 'buttonLabel')} <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
      <div className="offer-media">
        {!loading && <img src={banner.image} srcSet={srcSetFor(banner.image)} sizes="(max-width: 767px) 100vw, 50vw" alt="" loading="lazy" width="1024" height="640" />}
        {!loading && percent > 0 && (
          <span className="offer-badge" aria-hidden="true">
            <small>{t('Up to')}</small>
            <strong>{percent}%</strong>
            <small>{t('off')}</small>
          </span>
        )}
      </div>
    </div>
  );
  if (preview) return card;
  return (
    <section className="home-band is-dark" aria-labelledby="deal-title">
      <div className="container">{card}</div>
    </section>
  );
}
