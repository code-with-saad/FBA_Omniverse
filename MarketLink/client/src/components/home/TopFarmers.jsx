import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bone } from '../common/Skeletons';
import FavButton from '../common/FavButton';
import { TodayBadge } from '../../utils/marketToday';
import { coverFor } from '../../utils/format';
import { localText, t } from '../../i18n';

/** The highest rated farmers as a row of photo cards with their rank; arrows on computers, swipe on phones. */
export default function TopFarmers({ farmers, loading }) {
  const row = useRef(null);
  const scroll = (dir) => {
    const el = row.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <div className="tf-wrap">
      <div className="tf-arrows d-none d-md-flex">
        <button type="button" className="tf-arrow" onClick={() => scroll(-1)} aria-label={t('Previous farmers')}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <button type="button" className="tf-arrow" onClick={() => scroll(1)} aria-label={t('Next farmers')}>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>
      <ol className="tf-row" ref={row}>
        {loading && !farmers
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Bone h={380} r="1.2rem" />
              </li>
            ))
          : (farmers || []).map((f, i) => (
              <li key={f._id}>
                <article className="tf-card">
                  <div className="tf-photo" style={{ '--cover': coverFor(f.stallName) }}>
                    {(f.coverImage || f.logo) && <img src={f.coverImage || f.logo} alt="" loading="lazy" />}
                    <span className="tf-rank" aria-label={t('Number {n}', { n: i + 1 })}>
                      #{i + 1}
                    </span>
                    {f.ratingCount > 0 && (
                      <span className="tf-rating">
                        <i className="bi bi-star-fill" aria-hidden="true" /> {Number(f.ratingAvg).toFixed(1)} <small>({f.ratingCount})</small>
                      </span>
                    )}
                    <div className="tf-fav">
                      <FavButton type="farmers" id={f._id} />
                    </div>
                  </div>
                  <div className="tf-body">
                    <div className="tf-head">
                      <span className="tf-logo">{f.logo ? <img src={f.logo} alt="" loading="lazy" /> : <i className="bi bi-shop" aria-hidden="true" />}</span>
                      <span className="min-w-0">
                        <h3 className="tf-name">
                          <Link to={`/farmers/${f.slug}`} className="stretched">
                            {f.stallName}
                          </Link>
                        </h3>
                        {f.city && (
                          <span className="tf-city">
                            <i className="bi bi-geo-alt-fill" aria-hidden="true" /> {t(f.city)}
                          </span>
                        )}
                      </span>
                    </div>
                    {localText(f, 'bio') && <p className="tf-bio">{localText(f, 'bio')}</p>}
                    <div className="tf-foot">
                      <TodayBadge farmer={f} />
                      <span className="tf-go">
                        {t('Visit stall')} <i className="bi bi-arrow-right" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </article>
              </li>
            ))}
      </ol>
    </div>
  );
}
