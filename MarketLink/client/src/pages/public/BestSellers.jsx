import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { toQuery } from '../../api/client';
import { PageHero } from '../../components/common/PageHeader';
import ProductCard from '../../components/cards/ProductCard';
import SearchSelect from '../../components/common/SearchSelect';
import { CardSkeletons } from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import useSeo from '../../hooks/useSeo';
import { categoryName, t } from '../../i18n';

const TOPS = [5, 10, 20];

export default function BestSellers() {
  useSeo({ title: t('Best sellers'), description: t('The products customers pre-order most at the farmers markets: the top 5, top 10 and the best sellers at every market.'), canonicalPath: '/best-sellers' });
  const [top, setTop] = useState(10);
  const [market, setMarket] = useState('');
  const [category, setCategory] = useState('');
  const { data: marketData } = useFetch('/markets');
  const { data: catData } = useFetch('/categories');
  const { data, loading } = useFetch(`/products${toQuery({ sort: 'popular', limit: top, market, category })}`);
  const markets = marketData?.markets || [];
  const categories = catData?.categories || [];
  const products = (data?.products || []).filter((p) => p.totalSold > 0);
  const where = markets.find((m) => m._id === market)?.name;

  return (
    <>
      <PageHero crumbs={[{ label: 'Shop', to: '/products' }, { label: 'Best sellers' }]} title={t('Best sellers')} subtitle={t('What customers pre-order most, counted from the pickups done on MarketLink.')} />
      <div className="container pb-5">
        <div className="best-toolbar">
          <div className="view-toggle" role="group" aria-label={t('How many')}>
            {TOPS.map((n) => (
              <button key={n} type="button" className={top === n ? 'active' : ''} aria-pressed={top === n} onClick={() => setTop(n)}>
                {t('Top {n}', { n })}
              </button>
            ))}
          </div>
          <SearchSelect value={market} onChange={setMarket} ariaLabel={t('Market')} emptyLabel="All markets" options={markets.map((m) => ({ value: m._id, label: m.name, hint: m.city }))} />
          <SearchSelect value={category} onChange={setCategory} ariaLabel={t('Category')} emptyLabel="All categories" options={categories.map((c) => ({ value: c.slug, label: categoryName(c) }))} />
        </div>
        <h2 className="h5 mb-3">{where ? t('Top {n} at {market}', { n: top, market: where }) : t('Top {n} at every market', { n: top })}</h2>
        {loading && !data ? (
          <div className="row g-3">
            <CardSkeletons count={8} cols="col-6 col-md-4 col-xl-3" />
          </div>
        ) : products.length ? (
          <ol className="best-grid">
            {products.map((p, i) => (
              <li key={p._id}>
                <span className={`best-rank ${i < 3 ? `is-top${i + 1}` : ''}`} aria-label={t('Number {n}', { n: i + 1 })}>
                  {i + 1}
                </span>
                <ProductCard product={p} />
                <span className="best-sold">
                  <i className="bi bi-bag-check" aria-hidden="true" /> {t('{n} sold', { n: p.totalSold })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon="bi-trophy" title={t('No best sellers here yet')} message={t('Nothing has been picked up from this market or category yet.')} action={<Link to="/products" className="btn btn-primary">{t('Shop the market')}</Link>} />
        )}
      </div>
    </>
  );
}
