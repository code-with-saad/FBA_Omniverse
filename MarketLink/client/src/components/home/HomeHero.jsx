import { Link } from 'react-router-dom';
import useMediaQuery from '../../hooks/useMediaQuery';
import { initials } from '../../utils/format';
import { t } from '../../i18n';

// Why people can trust the market, in a panel at the bottom of the banner
const TRUST = [
  { icon: 'bi-basket2', title: 'Fresh every week', text: 'Picked for market day' },
  { icon: 'bi-cash-coin', title: 'Pay at pickup', text: 'No online payment' },
  { icon: 'bi-patch-check', title: 'Checked farmers', text: 'Every stall is approved' },
  { icon: 'bi-clock', title: 'Your pickup time', text: 'Choose a time slot' },
];

const PRODUCE_ALT = 'Fresh fruit and vegetables from local farmers: lettuce, broccoli, mint, apples, pears, oranges, kiwi, lemons, strawberries, mangoes and green chillies';
const AVATAR_COLORS = ['#d4f06e', '#f4b93e', '#8fd3a5', '#f28c38'];

/** "Fresh from the farm, [ready] at your market": the words in brackets are shown in lime. */
function Title({ as: Tag = 'h1', className }) {
  const parts = t('Fresh from the farm, [ready] at your market').split(/\[(.+?)\]/);
  return (
    <Tag id="hero-title" className={className}>
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={part} className="fh-lime">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </Tag>
  );
}

/** Counts of markets and farmers from the database, e.g. "8 farmers markets · 10 local farmers". */
function Eyebrow({ stats }) {
  return (
    <span className="fh-eyebrow">
      <span className="fh-pulse" aria-hidden="true" />
      {stats ? t('{markets} farmers markets · {farmers} local farmers', { markets: stats.markets, farmers: stats.farmers }) : t('Fresh from local farmers')}
    </span>
  );
}

/** Real review numbers: initials of recent reviewers, the stars and "4.4 from 332 reviews". */
function SocialProof({ reviews }) {
  const summary = reviews?.summary;
  if (!summary?.count) return <div className="fh-proof is-empty" aria-hidden="true" />;
  const names = [...new Set((reviews.reviews || []).map((r) => r.customer?.name).filter(Boolean))].slice(0, 4);
  const full = Math.floor(summary.average);
  const half = summary.average - full >= 0.25;
  return (
    <div className="fh-proof">
      <span className="fh-avatars" aria-hidden="true">
        {names.map((n, i) => (
          <span key={n} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
            {initials(n)}
          </span>
        ))}
      </span>
      <span className="fh-rating">
        <span className="fh-stars" role="img" aria-label={t('{avg} out of 5 stars', { avg: summary.average })}>
          {[1, 2, 3, 4, 5].map((s) => (
            <i key={s} className={`bi ${s <= full ? 'bi-star-fill' : s === full + 1 && half ? 'bi-star-half' : 'bi-star'}`} aria-hidden="true" />
          ))}
        </span>
        <span className="fh-proof-text">
          <strong>
            <bdi dir="ltr">{summary.average}/5</bdi>
          </strong>{' '}
          {t('from {count} customer reviews', { count: summary.count })}
        </span>
      </span>
    </div>
  );
}

function Actions() {
  return (
    <div className="fh-actions">
      <Link to="/products" className="btn btn-lime btn-lg fh-shop">
        {t('Shop now')} <i className="bi bi-arrow-right fh-arrow" aria-hidden="true" />
      </Link>
      <Link to="/categories" className="btn btn-lg fh-outline">
        {t('Explore categories')}
      </Link>
    </div>
  );
}

function TrustList({ className }) {
  return (
    <ul className={className} aria-label={t('Why shop at MarketLink')}>
      {TRUST.map((item) => (
        <li key={item.title}>
          <span className="fh-trust-icon">
            <i className={`bi ${item.icon}`} aria-hidden="true" />
          </span>
          <span>
            <strong>{t(item.title)}</strong>
            <span>{t(item.text)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A big lime leaf (the leaf of the MarketLink logo) behind the produce. */
function LeafShape() {
  return (
    <svg className="fh-shape" viewBox="0 0 420 480" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fh-leaf" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7cc243" />
          <stop offset="0.55" stopColor="#bfe45a" />
          <stop offset="1" stopColor="#e6fb93" />
        </linearGradient>
      </defs>
      <path d="M70 468 C -18 300, 44 52, 404 8 C 434 262, 318 452, 70 468 Z" fill="url(#fh-leaf)" />
      <path d="M86 452 C 170 318, 262 176, 380 38" fill="none" stroke="#1f4a37" strokeOpacity="0.42" strokeWidth="9" strokeLinecap="round" />
      <path d="M52 330 C 60 200, 150 90, 300 44" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function OfferBadge({ deals, className }) {
  if (!deals?.maxPercent) return null;
  return (
    <Link to="/products?deals=true" className={className}>
      <span className="fh-offer-icon">
        <i className="bi bi-tag-fill" aria-hidden="true" />
      </span>
      <span>
        <strong>{t('Up to {n}% off', { n: deals.maxPercent })}</strong>
        <span>{t('{n} offers this week', { n: deals.count })}</span>
      </span>
    </Link>
  );
}

function Leaves({ count }) {
  return Array.from({ length: count }, (_, i) => <img key={i} className={`fh-leaf fh-leaf-${i + 1}`} src="/images/hero/leaf.webp" alt="" width="162" height="200" draggable="false" />);
}

/** Computers and tablets in landscape: words on one side, the produce on the other, the promises in a panel below. */
function HeroWide({ stats, reviews }) {
  return (
    <section className="fresh-hero is-wide" aria-labelledby="hero-title">
      <div className="container">
        <div className="fh-grid">
          <div className="fh-copy">
            <Eyebrow stats={stats} />
            <Title className="fh-title" />
            <p className="fh-text">{t('Pre-order fruit, vegetables, dairy and bread from local farmers. Pick it up at the market in your time slot and pay the farmer.')}</p>
            <Actions />
            <SocialProof reviews={reviews} />
          </div>
          <div className="fh-visual">
            <span className="fh-glow" aria-hidden="true" />
            <LeafShape />
            <Leaves count={4} />
            <img className="fh-produce" src="/images/hero/produce.webp" alt={t(PRODUCE_ALT)} width="1120" height="761" fetchPriority="high" draggable="false" />
            <OfferBadge deals={stats?.deals} className="fh-offer" />
          </div>
        </div>
        <TrustList className="fh-trust" />
      </div>
    </section>
  );
}

/** Phones and small tablets: the produce first in a lime circle, then centred words, full-width buttons and promises to swipe. */
function HeroPhone({ stats, reviews }) {
  return (
    <section className="fresh-hero is-phone" aria-labelledby="hero-title">
      <div className="container">
        <div className="fhp-visual">
          <span className="fhp-disc" aria-hidden="true" />
          <Leaves count={3} />
          <img className="fhp-produce" src="/images/hero/produce-640.webp" alt={t(PRODUCE_ALT)} width="640" height="435" fetchPriority="high" draggable="false" />
          <OfferBadge deals={stats?.deals} className="fhp-sticker" />
        </div>
        <div className="fhp-copy">
          <Eyebrow stats={stats} />
          <Title className="fh-title" />
          <p className="fh-text">{t('Pre-order fruit, vegetables, dairy and bread from local farmers. Pick it up at the market in your time slot and pay the farmer.')}</p>
          <Actions />
          <SocialProof reviews={reviews} />
        </div>
      </div>
      <TrustList className="fhp-trust scroll-x" />
    </section>
  );
}

/**
 * The home page banner (one design for computers, another for phones): a dark green band with the
 * headline, "Shop now" and "Explore categories", real review numbers, a pile of fresh produce and
 * the four promises of the market.
 */
export default function HomeHero({ stats, reviews }) {
  const wide = useMediaQuery('(min-width: 992px)');
  return wide ? <HeroWide stats={stats} reviews={reviews} /> : <HeroPhone stats={stats} reviews={reviews} />;
}
