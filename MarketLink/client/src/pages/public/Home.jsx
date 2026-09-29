import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import ProductCard from '../../components/cards/ProductCard';
import MapView from '../../components/map/MapView';
import { Bone } from '../../components/common/Skeletons';
import DayDots from '../../components/common/DayDots';
import CountUp from '../../components/common/CountUp';
import GlobalSearch from '../../components/layout/GlobalSearch';
import HomeHero from '../../components/home/HomeHero';
import VideoTour from '../../components/home/VideoTour';
import Testimonials from '../../components/home/Testimonials';
import HomeFaq from '../../components/home/HomeFaq';
import OfferBanner from '../../components/home/OfferBanner';
import TopFarmers from '../../components/home/TopFarmers';
import { DAY_NAMES, nextOccurrence, time12 } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import useSeo from '../../hooks/useSeo';
import { homeLd } from '../../utils/seo';
import { categoryName, t } from '../../i18n';
import { srcSetFor } from '../../utils/hires';

function useNextMarket(markets) {
  return useMemo(() => {
    if (!markets?.length) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let best = null;
    for (const m of markets) {
      const [ch, cm] = m.closeTime.split(':').map(Number);
      const from = new Date(now);
      if (m.operatingDays.includes(now.getDay()) && nowMinutes < ch * 60 + cm) {
        if (!best || best.inDays > 0) best = { market: m, inDays: 0 };
        continue;
      }
      from.setDate(from.getDate() + 1);
      const next = nextOccurrence(m.operatingDays, from);
      if (next && (!best || next.inDays + 1 < best.inDays)) best = { market: m, inDays: next.inDays + 1, date: next.date };
    }
    return best;
  }, [markets]);
}

const STATS = [
  { key: 'markets', label: 'Markets', icon: 'bi-shop-window' },
  { key: 'farmers', label: 'Local farmers', icon: 'bi-people' },
  { key: 'products', label: 'Products this week', icon: 'bi-basket2' },
  { key: 'ordersCompleted', label: 'Pickups done', icon: 'bi-bag-check' },
];

const REASONS = [
  { icon: 'bi-geo-alt', title: 'Grown near you', text: 'Every farmer sells at a market in your city, so the food travels less and reaches you fresh.' },
  { icon: 'bi-tags', title: 'Fair prices', text: 'Farmers set their own prices and MarketLink is free for them to join. No middlemen.' },
  { icon: 'bi-patch-check', title: 'Reviews you can trust', text: 'Only customers who collected their order can leave a verified review.' },
  { icon: 'bi-hourglass-split', title: 'No waiting in line', text: 'Your order is packed before you arrive. Pick it up in the time slot you chose.' },
];

function SectionHead({ id, eyebrow, title, text, link }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {text && <p>{text}</p>}
      </div>
      {link && (
        <Link to={link.to} className="link-arrow">
          {link.label} <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}


function SearchCard({ next }) {
  return (
    <div className="search-card-wrap">
      <div className="search-card">
        <div className="search-card-main">
          <label className="search-card-label" htmlFor="home-search">
            {t('What would you like to buy today?')}
          </label>
          <GlobalSearch withCategory size="lg" inputId="home-search" placeholder={t('Try mangoes, sourdough or honey…')} />
        </div>
        <div className="next-market">
          <span className="next-market-icon">
            <i className="bi bi-calendar-heart" aria-hidden="true" />
          </span>
          {next ? (
            <span className="min-w-0">
              <span className="d-block small fw-semi text-muted-2">{t('Next market day')}</span>
              <strong className="d-block">
                {next.inDays === 0 ? t('Today') : next.inDays === 1 ? t('Tomorrow') : DAY_NAMES[next.date.getDay()]}, {time12(next.market.openTime)}
              </strong>
              <Link to={`/markets/${next.market.slug}`} className="small text-truncate d-block">
                {next.market.name} <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </span>
          ) : (
            <span className="flex-grow-1">
              <Bone w="50%" h={12} />
              <Bone w="80%" h={18} className="mt-2" />
              <Bone w="65%" h={12} className="mt-2" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryCards({ categories }) {
  return (
    <div className="home-block">
      <SectionHead id="cats-title" eyebrow={t('Shop by category')} title={t("What's growing this week")} link={{ to: '/categories', label: t('View all') }} />
      <div className="cat-cards">
        {categories
          ? categories.slice(0, 8).map((c) => (
              <Link key={c._id} to={`/products?category=${c.slug}`} className="cat-card" style={{ '--cat-bg': c.color }}>
                <span className="cat-card-photo">
                  <img src={c.image || c.icon} alt="" loading="lazy" />
                </span>
                <span className="cat-card-body">
                  <strong>{categoryName(c)}</strong>
                  <span>{t('{n} items', { n: c.productCount })}</span>
                </span>
                <i className="bi bi-arrow-right cat-card-go" aria-hidden="true" />
              </Link>
            ))
          : Array.from({ length: 8 }, (_, i) => <Bone key={i} h={210} r="1.1rem" className="cat-card-bone" />)}
      </div>
    </div>
  );
}

function TopPicks({ categories }) {
  const [category, setCategory] = useState('');
  const products = useFetch(`/products?sort=popular&limit=8&inStock=true${category ? `&category=${category}` : ''}`);
  const chips = (categories || []).filter((c) => c.productCount > 0).slice(0, 6);
  return (
    <section className="home-band is-light" aria-labelledby="harvest-title">
      <div className="container">
        <SectionHead
          id="harvest-title"
          eyebrow={t('Most loved')}
          title={t('Top picks this week')}
          text={t('Popular picks from farmers near you. Reserve yours before market day.')}
          link={{ to: '/best-sellers', label: t('Best sellers') }}
        />
        <div className="pick-chips" role="group" aria-label={t('Category')}>
          <button type="button" className={`chip chip-btn ${!category ? 'active' : ''}`} aria-pressed={!category} onClick={() => setCategory('')}>
            {t('All produce')}
          </button>
          {chips.map((c) => (
            <button key={c.slug} type="button" className={`chip chip-btn ${category === c.slug ? 'active' : ''}`} aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)}>
              {categoryName(c)}
            </button>
          ))}
        </div>
        <div className={`product-rail ${products.loading ? 'is-loading' : ''}`}>
          {products.loading && !products.data
            ? Array.from({ length: 4 }, (_, i) => <Bone key={i} h={330} r="1.1rem" className="product-rail-item" />)
            : products.data?.products.map((p) => (
                <div key={p._id} className="product-rail-item">
                  <ProductCard product={p} />
                </div>
              ))}
        </div>
        <div className="text-center mt-4">
          <Link to={category ? `/products?category=${category}` : '/products'} className="btn btn-outline-primary">
            {t('Shop the market')} <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyChooseUs() {
  return (
    <section className="home-band is-dark" aria-labelledby="why-title">
      <div className="container">
        <div className="why-grid">
          <div className="why-photo">
            <img
              src="/images/hero/pickup.webp"
              srcSet={srcSetFor('/images/hero/pickup.webp')}
              sizes="(max-width: 991px) 100vw, 45vw"
              alt={t('Crates of fresh produce ready at a market stall')}
              loading="lazy"
            />
            <span className="why-photo-note">
              <i className="bi bi-bag-check-fill" aria-hidden="true" /> {t('Packed and waiting at the stall')}
            </span>
          </div>
          <div>
            <span className="eyebrow">{t('Why choose us')}</span>
            <h2 id="why-title" className="section-title">
              {t('The easy way to buy from local farmers')}
            </h2>
            <ul className="why-list">
              {REASONS.map((r) => (
                <li key={r.title}>
                  <span className="why-icon">
                    <i className={`bi ${r.icon}`} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t(r.title)}</strong>
                    <span>{t(r.text)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}


const JOURNEY = [
  { icon: 'bi-flower2', title: 'Grown and picked', text: 'Farmers harvest for market day, not for a warehouse.' },
  { icon: 'bi-basket2', title: 'Packed at the stall', text: 'Your order is weighed and bagged before you arrive.' },
  { icon: 'bi-house-heart', title: 'On your table', text: 'Collect it in your time slot and pay the farmer.' },
];

function FarmStory({ stats }) {
  return (
    <section className="home-band is-light" aria-labelledby="story-title">
      <div className="container">
        <div className="story-grid">
          <div className="story-photos">
            <img
              className="story-photo-main"
              src="/images/hero/farmers.webp"
              srcSet={srcSetFor('/images/hero/farmers.webp')}
              sizes="(max-width: 991px) 100vw, 50vw"
              alt={t('A farmer harvesting sweet potatoes in the field')}
              loading="lazy"
            />
            <img className="story-photo-small" src="/images/hero/summer.webp" alt={t('A basket of ripe mangoes')} loading="lazy" />
            <span className="story-badge">
              <strong>{stats ? <CountUp value={stats.farmers} /> : '…'}</strong>
              <span>{t('Local farmers')}</span>
            </span>
          </div>
          <div>
            <span className="eyebrow">{t('Our story')}</span>
            <h2 id="story-title" className="section-title">
              {t('From our farms to your table')}
            </h2>
            <p className="text-muted-2">
              {t(
                'MarketLink puts the farmers market online: farmers publish what they picked this week, you reserve it, and it is waiting for you at the stall. Fewer middlemen, fresher food and fair prices for the people who grow it.'
              )}
            </p>
            <ol className="story-steps">
              {JOURNEY.map((s) => (
                <li key={s.title}>
                  <span className="story-step-icon">
                    <i className={`bi ${s.icon}`} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t(s.title)}</strong>
                    <span>{t(s.text)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <dl className="story-numbers">
              {STATS.map((s) => (
                <div key={s.key}>
                  <dt>
                    <i className={`bi ${s.icon}`} aria-hidden="true" /> {t(s.label)}
                  </dt>
                  <dd>{stats ? <CountUp value={stats[s.key]} /> : <Bone w={56} h={28} />}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

const FARMER_POINTS = ['Publish your weekly stock and prices in minutes', 'Take pre-orders with pickup times, no more guessing', 'Free to join, no commission on your sales'];
const MARKET_POINTS = ['Bring your market online with its days and hours', 'Farmers and customers find you on the map', 'We help you set up the stalls and pickup points'];

function GetInvolved({ user }) {
  return (
    <section className="home-band is-dark" aria-labelledby="join-title">
      <div className="container">
        <div className="text-center mb-4 mb-lg-5">
          <span className="eyebrow">{t('Grow with us')}</span>
          <h2 id="join-title" className="section-title">
            {t('Be part of your local food market')}
          </h2>
        </div>
        <div className="join-grid">
          <article className="join-card is-farmer">
            <img src="/images/hero/cta-farmer.webp" srcSet={srcSetFor('/images/hero/cta-farmer.webp')} sizes="(max-width: 991px) 100vw, 50vw" alt="" loading="lazy" />
            <div className="join-body">
              <span className="join-tag">
                <i className="bi bi-flower1" aria-hidden="true" /> {t('For farmers')}
              </span>
              <h3>{t('Sell your harvest before you pack the truck')}</h3>
              <ul className="join-points">
                {FARMER_POINTS.map((p) => (
                  <li key={p}>
                    <i className="bi bi-check-circle-fill" aria-hidden="true" /> {t(p)}
                  </li>
                ))}
              </ul>
              <Link to={user ? '/farmers' : '/register/farmer'} className="btn btn-lime btn-lg">
                {user ? t('Meet the farmers') : t('Register your stall')} <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </article>
          <article className="join-card is-market">
            <img src="/images/hero/welcome.webp" srcSet={srcSetFor('/images/hero/welcome.webp')} sizes="(max-width: 991px) 100vw, 50vw" alt="" loading="lazy" />
            <div className="join-body">
              <span className="join-tag">
                <i className="bi bi-shop-window" aria-hidden="true" /> {t('For market organisers')}
              </span>
              <h3>{t('Run a farmers market in your city?')}</h3>
              <ul className="join-points">
                {MARKET_POINTS.map((p) => (
                  <li key={p}>
                    <i className="bi bi-check-circle-fill" aria-hidden="true" /> {t(p)}
                  </li>
                ))}
              </ul>
              <Link to="/contact?topic=market_request" className="btn btn-light btn-lg">
                {t('Request your market')} <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const faqs = useFetch('/faqs?home=1');
  useSeo({ jsonLd: homeLd(faqs.data?.faqs) });
  const { user } = useAuth();
  const stats = useFetch('/stats');
  const cats = useFetch('/categories');
  const offer = useFetch('/banners/home-offer');
  const markets = useFetch('/markets');
  const farmers = useFetch('/farmers?limit=8');
  const reviews = useFetch('/testimonials');
  const next = useNextMarket(markets.data?.markets);
  const categories = cats.data?.categories || null;

  const karachiMarkets = (markets.data?.markets || []).filter((m) => m.city === 'Karachi');


  return (
    <>
      <HomeHero stats={stats.data} reviews={reviews.data} />

      <section className="home-band is-light home-first" aria-labelledby="cats-title">
        <div className="container">
          <SearchCard next={next} />
          <CategoryCards categories={categories} />
        </div>
      </section>

      <OfferBanner banner={offer.data?.banner} loading={offer.loading && !offer.data} />
      <TopPicks categories={categories} />
      <VideoTour />

      <section className="home-band is-light" aria-labelledby="farmers-title">
        <div className="container">
          <SectionHead
            id="farmers-title"
            eyebrow={t('Meet the growers')}
            title={t('Top-rated farmers')}
            text={t('Rated by customers who collected their orders. See who is at the market today.')}
            link={{ to: '/farmers', label: t('All farmers') }}
          />
          <TopFarmers farmers={farmers.data?.farmers} loading={farmers.loading} />
        </div>
      </section>

      <section className="home-band is-dark" aria-labelledby="markets-title">
        <div className="container">
          <SectionHead
            id="markets-title"
            eyebrow={t('Markets')}
            title={t('Find a market near you')}
            text={t('Every market, its days and opening hours, with directions to the exact pickup point.')}
            link={{ to: '/markets', label: t('All markets') }}
          />
          <div className="row g-4">
            <div className="col-lg-5">
              <div className="d-grid gap-2">
                {markets.loading && !markets.data
                  ? [0, 1, 2, 3, 4].map((i) => <Bone key={i} h={64} r="1rem" />)
                  : karachiMarkets.slice(0, 5).map((m) => (
                      <Link key={m._id} to={`/markets/${m.slug}`} className="farmer-mini">
                        <span className="logo" style={{ background: '#173b2c' }}>
                          <img src={m.image} alt="" />
                        </span>
                        <span className="flex-grow-1 min-w-0">
                          <strong className="d-block text-truncate">{m.name}</strong>
                          <span className="fs-7 text-muted-2 d-block text-truncate">
                            {time12(m.openTime)} {t('to')} {time12(m.closeTime)} · {m.farmerCount} {t('farmers')}
                          </span>
                        </span>
                        <span className="d-none d-sm-inline-flex">
                          <DayDots days={m.operatingDays} />
                        </span>
                      </Link>
                    ))}
              </div>
            </div>
            <div className="col-lg-7">
              <MapView
                height={400}
                markers={karachiMarkets.map((m) => ({
                  id: m._id,
                  lat: m.latitude,
                  lng: m.longitude,
                  type: 'market',
                  image: m.image,
                  title: m.name,
                  subtitle: t('{from} to {to}', { from: time12(m.openTime), to: time12(m.closeTime) }),
                  link: `/markets/${m.slug}`,
                }))}
              />
            </div>
          </div>
        </div>
      </section>

      <FarmStory stats={stats.data} />
      <GetInvolved user={user} />
      <Testimonials data={reviews.data} loading={reviews.loading} />
      <WhyChooseUs />
      <HomeFaq faqs={faqs.data?.faqs} loading={faqs.loading} />
    </>
  );
}
