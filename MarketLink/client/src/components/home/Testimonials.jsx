import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RatingStars from '../common/RatingStars';
import Avatar from '../common/Avatar';
import VerifiedBadge from '../reviews/VerifiedBadge';
import { formatDate } from '../../utils/format';
import { productPath } from '../../utils/links';
import { productName, t } from '../../i18n';

const DELAY = 5000; // ms each review stays on screen
const ARC = 2; // avatars shown on each side of the current one
const TINTS = ['#e4f3d8', '#ffe4da', '#e3eefb', '#f8e8cf', '#daf1e3', '#fff0c2', '#fbe1ee'];

/**
 * Home page customer reviews: the customers sit on an arc and their review is shown large next to it.
 * The reviews move on by themselves; they wait while the mouse or the keyboard is on the card and
 * with the pause button. Clicking a face or a dot shows that review.
 */
export default function Testimonials({ data, loading }) {
  const reviews = data?.reviews || [];
  const summary = data?.summary;
  const count = reviews.length;
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [stopped, setStopped] = useState(false);
  const playing = count > 1 && !hover && !stopped;

  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => go(1), DELAY);
    return () => clearTimeout(timer);
  }, [playing, index, go]);

  if (!loading && !count) return null;
  const review = reviews[index % Math.max(count, 1)];

  return (
    <section className="home-band is-light testimonials" aria-labelledby="reviews-title">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('Customer reviews')}</span>
            <h2 id="reviews-title" className="section-title">
              {t('Loved by families who shop at the market')}
            </h2>
          </div>
          {summary && (
            <p className="tm-summary">
              <strong>{summary.average.toFixed(1)}</strong>
              <span>
                <RatingStars value={summary.average} />
                <span className="d-block">
                  {t('from {n} reviews', { n: summary.count })} · {t('{n}% verified purchases', { n: summary.verifiedShare })}
                </span>
              </span>
            </p>
          )}
        </div>

        {!review ? (
          <div className="tm-card skeleton" style={{ minHeight: 320 }} />
        ) : (
          <div
            className="tm-card"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHover(false)}
            aria-roledescription="carousel"
            aria-label={t('What customers say')}
          >
            <div className="tm-arc" role="group" aria-label={t('Choose a review')}>
              <span className="tm-circle" aria-hidden="true" />
              {reviews.map((r, i) => {
                // Place on the arc: 0 = the current review in the middle, -2..2 around it
                let slot = (((i - index) % count) + count) % count;
                if (slot > count / 2) slot -= count;
                const shown = Math.abs(slot) <= ARC;
                const angle = (slot * 58) / ARC; // degrees from the middle
                return (
                  <button
                    key={r._id}
                    type="button"
                    className={`tm-face ${slot === 0 ? 'is-current' : ''}`}
                    style={{
                      '--tm-x': Math.cos((angle * Math.PI) / 180).toFixed(3), // 1 = next to the review
                      '--tm-y': ((slot / ARC + 1) / 2).toFixed(3), // 0 = top, 1 = bottom
                      '--tm-slot': slot, // position in the row of faces on phones
                      '--tm-bg': TINTS[i % TINTS.length],
                      opacity: shown ? 1 : 0,
                    }}
                    onClick={() => setIndex(i)}
                    tabIndex={shown ? 0 : -1}
                    aria-hidden={!shown || undefined}
                    aria-label={t('Review by {name}', { name: r.customer?.name || t('MarketLink customer') })}
                    aria-current={slot === 0 ? 'true' : undefined}
                  >
                    <Avatar name={r.customer?.name} src={r.customer?.avatar} />
                  </button>
                );
              })}
            </div>

            <figure className="tm-quote" key={review._id} aria-live={playing ? 'off' : 'polite'}>
              <i className="bi bi-quote tm-mark" aria-hidden="true" />
              <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                <RatingStars value={review.rating} />
                <VerifiedBadge verified={review.verified} />
              </div>
              <blockquote>
                <p dir="auto">{review.comment}</p>
              </blockquote>
              <figcaption>
                <strong>{review.customer?.name || t('MarketLink customer')}</strong>
                <span>
                  {review.customer?.city && `${t(review.customer.city)} · `}
                  <time dateTime={String(review.createdAt).slice(0, 10)}>{formatDate(review.createdAt)}</time>
                </span>
                {(review.product || review.farmer) && (
                  <Link to={review.product ? productPath(review.product) : `/farmers/${review.farmer.slug}`} className="tm-about">
                    <img src={review.product?.image || review.farmer?.logo} alt="" loading="lazy" />
                    {review.product ? productName(review.product) : review.farmer?.stallName}
                    {review.product && review.farmer && <span className="text-muted-2"> · {review.farmer.stallName}</span>}
                  </Link>
                )}
              </figcaption>
            </figure>

            <div className="tm-controls">
              <div className="tm-dots" role="group" aria-label={t('Choose a review')}>
                {reviews.map((r, i) => (
                  <button key={r._id} type="button" className={`tm-dot ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} aria-label={t('Review {n} of {total}', { n: i + 1, total: count })} aria-current={i === index ? 'true' : undefined} />
                ))}
              </div>
              <button type="button" className="tm-pause" onClick={() => setStopped((s) => !s)} aria-pressed={stopped} aria-label={stopped ? t('Play reviews') : t('Pause reviews')}>
                <i className={`bi ${stopped ? 'bi-play-fill' : 'bi-pause-fill'}`} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
