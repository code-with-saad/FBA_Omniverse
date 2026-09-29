import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import ProductCard from '../../components/cards/ProductCard';
import ReviewItem from '../../components/cards/ReviewItem';
import DirectionsMap from '../../components/map/DirectionsMap';
import RatingStars from '../../components/common/RatingStars';
import { TodayBadge } from '../../utils/marketToday';
import DayDots from '../../components/common/DayDots';
import FavButton from '../../components/common/FavButton';
import WriteReviewButton from '../../components/reviews/WriteReviewButton';
import ReportButton from '../../components/reviews/ReportButton';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import { coverFor, DAY_SHORT, formatDateKey, time12 } from '../../utils/format';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd, clip, farmerLd, ldGraph } from '../../utils/seo';
import { categoryName, isUrdu, listText, localText, t } from '../../i18n';
import { useAuth } from '../../context/AuthContext';

export default function FarmerDetail() {
  const { slug } = useParams();
  const { data, loading, error, reload } = useFetch(`/farmers/${slug}`);
  const [cat, setCat] = useState('');
  const [allReviews, setAllReviews] = useState(false);
  const { farmer: myStall } = useAuth();
  const f = data?.farmer;
  useSeo(
    f
      ? {
          title: f.city ? t('{name}, local farmer in {city}', { name: f.stallName, city: t(f.city) }) : t('{name}, local farmer', { name: f.stallName }),
          description: clip((!isUrdu() && f.bio) || t('{stallName} sells fresh produce on MarketLink. See this week\'s stock, pickup times and reviews.', { stallName: f.stallName })),
          image: f.coverImage || f.logo,
          type: 'profile',
          jsonLd: ldGraph(farmerLd(f), breadcrumbLd([{ name: 'Farmers', path: '/farmers' }, { name: f.stallName, path: `/farmers/${f.slug}` }])),
          canonicalPath: `/farmers/${f.slug}`,
        }
      : { title: t('Farmer') }
  );

  const categories = useMemo(() => {
    const map = new Map();
    for (const p of data?.products || []) if (p.category) map.set(p.category.slug, p.category);
    return [...map.values()];
  }, [data]);

  if (loading && !data) return <PageLoader />;
  if (error)
    return (
      <div className="container py-5">
        <EmptyState icon="bi-people" title={t('Farmer not found')} action={<Link to="/farmers" className="btn btn-primary">{t('All farmers')}</Link>} />
      </div>
    );

  const { farmer, products, reviews } = data;
  const visible = cat ? products.filter((p) => p.category?.slug === cat) : products;
  const inStock = products.filter((p) => p.status === 'available' && p.quantityAvailable > 0).length;
  const windowsByMarket = {};
  for (const w of farmer.pickupWindows) {
    const key = w.market?._id || 'x';
    (windowsByMarket[key] ||= { market: w.market, windows: [] }).windows.push(w);
  }

  return (
    <div className="container py-4">
      <div className="profile-hero" style={{ '--cover': coverFor(farmer.stallName) }}>
        {farmer.coverImage ? (
          <>
            <img className="cover-photo" src={farmer.coverImage} alt={t('{stallName}: the farm', { stallName: farmer.stallName })} />
          </>
        ) : (
          <>
            {[
              { src: products[0]?.image || farmer.logo, style: { width: 150, right: '8%', top: 24, transform: 'rotate(10deg)' } },
              { src: products[1]?.image, style: { width: 96, right: '24%', top: 60, transform: 'rotate(-12deg)' } },
              { src: products[2]?.image, style: { width: 80, right: '38%', top: 20 } },
            ]
              .filter((art) => art.src)
              .map((art, i) => (
                <img key={i} className="cover-art photo-card" src={art.src} alt="" style={art.style} />
              ))}
          </>
        )}
      </div>
      <div className="profile-head mb-4">
        <div className="profile-logo">
          <img src={farmer.logo} alt="" />
        </div>
        <div className="flex-grow-1 pb-1">
          <h1>{farmer.stallName}</h1>
          <div className="d-flex align-items-center gap-3 flex-wrap mt-1">
            <RatingStars value={farmer.ratingAvg} count={farmer.ratingCount} />
            <TodayBadge farmer={farmer} />
            <span className="small text-muted-2">
              <i className="bi bi-geo-alt" /> {farmer.city ? t(farmer.city) : farmer.address}
            </span>
            <span className="small text-muted-2">
              <i className="bi bi-basket" /> {t('{n} in stock', { n: inStock })}
            </span>
          </div>
        </div>
        <div className="pb-1">
          <FavButton type="farmers" id={farmer._id} withLabel />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="soft-panel mb-4">
            <p className="mb-3">{localText(farmer, 'bio')}</p>
            {farmer.categories?.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
                <span className="small fw-semi text-muted-2">{t('Grows / sells:')}</span>
                {farmer.categories.map((c) => (
                  <span key={c._id} className="chip" style={{ background: c.color }}>
                    <img src={c.icon} alt="" width={16} height={16} /> {categoryName(c)}
                  </span>
                ))}
              </div>
            )}
            <div className="d-flex flex-wrap gap-2">
              {farmer.tags?.map((tx) => (
                <span key={tx} className="chip chip-soft">
                  <i className="bi bi-patch-check" /> {t(tx)}
                </span>
              ))}
            </div>
          </div>

          <div className="d-flex align-items-end justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <span className="eyebrow">{t('Current weekly stock')}</span>
              <h2 className="h3 mb-0">{t('This week at the stall')}</h2>
            </div>
            <div className="d-flex gap-1 flex-wrap">
              <button type="button" className={`filter-chip ${!cat ? 'active' : ''}`} onClick={() => setCat('')}>
                {t('All ({n})', { n: products.length })}
              </button>
              {categories.map((c) => (
                <button type="button" key={c.slug} className={`filter-chip ${cat === c.slug ? 'active' : ''}`} onClick={() => setCat(c.slug)}>
                  {categoryName(c)}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState title={t('No products listed yet')} message={t('Check back closer to market day.')} />
          ) : (
            <div className="row g-3">
              {visible.map((p) => (
                <div key={p._id} className="col-6 col-md-4">
                  <ProductCard product={{ ...p, farmer: { _id: farmer._id, stallName: farmer.stallName, slug: farmer.slug, logo: farmer.logo } }} />
                </div>
              ))}
            </div>
          )}

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-5 mb-3">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <h2 className="h3 mb-0">{t('Reviews')}</h2>
              {farmer.ratingCount > 0 && <RatingStars value={farmer.ratingAvg} count={farmer.ratingCount} />}
            </div>
            <WriteReviewButton type="farmer" id={farmer._id} name={farmer.stallName} onDone={reload} />
          </div>
          <div className="soft-panel">
            {reviews.length === 0 ? (
              <p className="text-muted-2 mb-0">{t('No reviews yet.')}</p>
            ) : (
              (allReviews ? reviews : reviews.slice(0, 5)).map((r) => (
                <ReviewItem key={r._id} review={r} showProduct farmerName={farmer.stallName} canReply={String(myStall?._id) === String(farmer._id)} onReplied={reload} />
              ))
            )}
            {reviews.length > 5 && (
              <button type="button" className="btn btn-soft btn-sm mt-3" onClick={() => setAllReviews(!allReviews)}>
                {allReviews ? t('Show fewer reviews') : t('Show {v1} more reviews', { v1: reviews.length - 5 })}
              </button>
            )}
          </div>
          <div className="text-end mt-2">
            <ReportButton targetType="farmer" targetId={farmer._id} label={t('Report this stall')} />
          </div>
        </div>

        <aside className="col-lg-4">
          <div className="soft-panel mb-4">
            <h5 className="mb-3">{t('Market days')}</h5>
            <DayDots days={farmer.operatingDays} />
            <h6 className="mt-4 mb-2">{t('Pickup windows')}</h6>
            {Object.values(windowsByMarket).map(({ market, windows }) => (
              <div key={market?._id} className="mb-3">
                <Link to={`/markets/${market?.slug}`} className="small fw-bold">
                  <i className="bi bi-geo-alt" /> {market?.name}
                </Link>
                <ul className="window-list">
                  {windows.map((w) => (
                    <li key={w._id}>
                      <span className="day">{DAY_SHORT[w.day]}</span> {time12(w.start)} {t('to')} {time12(w.end)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {farmer.blockedDates?.length > 0 && (
              <div className="alert alert-warning small py-2 rounded-4">
                <i className="bi bi-calendar-x" /> {t('Not at the market on:')} <strong>{listText(farmer.blockedDates.slice(0, 4).map((d) => formatDateKey(d)))}</strong>
              </div>
            )}
            <div className="pay-note">
              <i className="bi bi-hourglass-split" />
              <span>{t('Pre-orders close {h} h before each pickup slot.', { h: farmer.orderCutoffHours })}</span>
            </div>
          </div>
          {farmer.latitude && (
            <div className="soft-panel">
              <h5 className="mb-1">{t('Stall location')}</h5>
              <p className="small text-muted-2">{farmer.address}</p>
              <DirectionsMap destination={{ lat: farmer.latitude, lng: farmer.longitude, title: farmer.stallName, image: farmer.logo }} height={240} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
