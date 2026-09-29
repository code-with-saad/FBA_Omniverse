import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { toQuery } from '../../api/client';
import ProductCard from '../../components/cards/ProductCard';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { CardSkeletons } from '../../components/common/Loader';
import { PageHero } from '../../components/common/PageHeader';
import { DAY_LETTER, DAY_NAMES, money } from '../../utils/format';
import { CURRENCY } from '../../config';
import SearchSelect from '../../components/common/SearchSelect';
import FilterSidebar from '../../components/common/FilterSidebar';
import SearchBox from '../../components/common/SearchBox';
import useViewMode from '../../hooks/useViewMode';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd, clip, itemListLd, ldGraph } from '../../utils/seo';
import { categoryName, isUrdu, rich, t } from '../../i18n';

const SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'name', label: 'Name A to Z' },
];

const FILTER_KEYS = ['search', 'category', 'city', 'market', 'day', 'minPrice', 'maxPrice', 'rating', 'practice', 'inStock', 'deals', 'sort', 'page'];

function Filters({ params, set, categories, markets, cities, practices = [], onDone }) {
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '');

  const category = params.get('category') || '';
  const day = params.get('day') ?? '';

  return (
    <div className="filter-panel">
      <div className="filter-title mt-0">{t('Category')}</div>
      <div className="d-grid gap-1">
        <button type="button" className={`cat-option ${!category ? 'active' : ''}`} onClick={() => set({ category: '' })}>
          <i className="bi bi-grid" style={{ width: 24, textAlign: 'center' }} /> {t('All products')}
        </button>
        {categories.map((c) => (
          <button type="button" key={c._id} className={`cat-option ${category === c.slug ? 'active' : ''}`} onClick={() => set({ category: c.slug })}>
            <img src={c.icon} alt="" /> {categoryName(c)}
            <span className="n">{c.productCount}</span>
          </button>
        ))}
      </div>

      <div className="filter-title">{t('Location')}</div>
      <SearchSelect className="mb-2" value={params.get('city') || ''} onChange={(v) => set({ city: v, market: '' })} ariaLabel={t('City')} emptyLabel="All cities" options={cities.map((c) => ({ value: c, label: t(c) }))} />
      <SearchSelect
        value={params.get('market') || ''}
        onChange={(v) => set({ market: v })}
        ariaLabel={t('Market')}
        emptyLabel="All markets"
        options={markets.filter((m) => !params.get('city') || m.city === params.get('city')).map((m) => ({ value: m._id, label: m.name, hint: m.city }))}
      />

      <div className="filter-title">{t('Market day')}</div>
      <div className="day-picker">
        {DAY_LETTER.map((letter, i) => (
          <button
            type="button"
            key={i}
            className={String(i) === day ? 'active' : ''}
            onClick={() => set({ day: String(i) === day ? '' : String(i) })}
            title={DAY_NAMES[i]}
            aria-label={DAY_NAMES[i]}
            aria-pressed={String(i) === day}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="filter-title">{t('Price ({currency})', { currency: t(CURRENCY) })}</div>
      <form
        className="d-flex gap-2 align-items-center"
        onSubmit={(e) => {
          e.preventDefault();
          set({ minPrice, maxPrice });
          onDone?.();
        }}
      >
        <input type="number" min="0" className="form-control form-control-sm" placeholder={t('Min')} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} aria-label={t('Minimum price')} />
        <span>{t('to')}</span>
        <input type="number" min="0" className="form-control form-control-sm" placeholder={t('Max')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label={t('Maximum price')} />
        <button type="submit" className="btn btn-soft btn-sm btn-icon" aria-label={t('Apply price')}>
          <i className="bi bi-arrow-right" />
        </button>
      </form>

      <div className="filter-title">{t('Rating')}</div>
      <div className="d-flex gap-1 flex-wrap" role="group" aria-label={t('Minimum rating')}>
        {[
          ['', t('Any')],
          ['4', '4+'],
          ['3', '3+'],
        ].map(([v, l]) => (
          <button key={l} type="button" className={`filter-chip ${(params.get('rating') || '') === v ? 'active' : ''}`} aria-pressed={(params.get('rating') || '') === v} onClick={() => set({ rating: v })}>
            {v && <i className="bi bi-star-fill text-warning" />} {l}
          </button>
        ))}
      </div>

      {practices.length > 0 && (
        <>
          <div className="filter-title">{t('Farming practice')}</div>
          <SearchSelect value={params.get('practice') || ''} onChange={(v) => set({ practice: v })} ariaLabel={t('Farming practice')} emptyLabel="Any practice" options={practices.map((p) => ({ value: p, label: t(p) }))} />
        </>
      )}

      <div className="form-check form-switch mt-3">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="inStock"
          checked={params.get('inStock') === 'true'}
          onChange={(e) => set({ inStock: e.target.checked ? 'true' : '' })}
        />
        <label className="form-check-label small fw-semi" htmlFor="inStock">
          {t('In stock only')}
        </label>
      </div>
      <div className="form-check form-switch mt-2">
        <input className="form-check-input" type="checkbox" role="switch" id="deals" checked={params.get('deals') === 'true'} onChange={(e) => set({ deals: e.target.checked ? 'true' : '' })} />
        <label className="form-check-label small fw-semi" htmlFor="deals">
          {t('On offer only')}
        </label>
      </div>
    </div>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const resultsRef = useRef(null);
  const [view, setView] = useViewMode('shop', 'grid');
  const onSearch = useCallback((q) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (q) next.set('search', q);
    else next.delete('search');
    next.delete('page');
    return next;
  }), [setParams]);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const { data: catData } = useFetch('/categories');
  const seoCategory = (catData?.categories || []).find((c) => c.slug === params.get('category'));
  const { data: marketData } = useFetch('/markets');
  const { data: practiceData } = useFetch('/practices');

  const query = {};
  for (const key of FILTER_KEYS) if (params.get(key)) query[key] = params.get(key);
  const { data, loading, error, reload } = useFetch(`/products${toQuery({ limit: 12, ...query })}`);
  const listLd = itemListLd(seoCategory ? t('{name} from local farmers', { name: seoCategory.name }) : t('Fresh produce this week'), (data?.products || []).map((p) => ({ name: p.name, path: `/products/${p.slug}` })));
  const crumbLd = breadcrumbLd([{ name: 'Shop', path: '/products' }, ...(seoCategory ? [{ name: seoCategory.name, path: `/products?category=${seoCategory.slug}` }] : [])]);
  useSeo(
    seoCategory
      ? { title: t('{name} from local farmers', { name: seoCategory.name }), description: clip(seoCategory.description || t('Fresh {v1} from local farmers. Pre-order and pick up at the market.', { v1: seoCategory.name.toLowerCase() })), canonicalPath: `/products?category=${seoCategory.slug}`, jsonLd: ldGraph(listLd, crumbLd) }
      : { title: t('Shop fresh produce'), description: t('Browse this week\'s vegetables, fruit, dairy, honey, baked goods and more from local farmers. Filter by market, day, city and price, then pre-order for pickup.'), canonicalPath: '/products', jsonLd: ldGraph(listLd, crumbLd) }
  );

  function set(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === undefined || v === null) next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
    requestAnimationFrame(() => {
      const top = resultsRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top < 0) resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const categories = catData?.categories || [];
  const markets = marketData?.markets || [];
  const activeCategory = categories.find((c) => c.slug === params.get('category'));
  const activeFilters = FILTER_KEYS.filter((k) => !['sort', 'page'].includes(k) && params.get(k));
  const chipLabel = (k) => {
    const v = params.get(k);
    if (k === 'search') return `“${v}”`;
    if (k === 'category') return activeCategory ? categoryName(activeCategory) : v;
    if (k === 'city') return t(v);
    if (k === 'market') return markets.find((m) => m._id === v)?.name || t('Market');
    if (k === 'day') return DAY_NAMES[Number(v)];
    if (k === 'minPrice') return t('From {price}', { price: money(v) });
    if (k === 'maxPrice') return t('Up to {price}', { price: money(v) });
    if (k === 'rating') return t('{n}+ stars', { n: v });
    if (k === 'practice') return t(v);
    if (k === 'inStock') return t('In stock only');
    if (k === 'deals') return t('On offer only');
    return v;
  };

  return (
    <>
      <PageHero
        crumbs={[{ label: t('Shop') }]}
        title={activeCategory ? activeCategory.name : t('Shop the market')}
        subtitle={(activeCategory && (isUrdu() ? t('Fresh {v1} from local farmers. Pre-order and pick up at the market.', { v1: categoryName(activeCategory) }) : activeCategory.description)) || t('Browse this week’s stock from every farmer. Filter by market, day and price, then pre-order for pickup.')}
      />
      <div className="container pb-5">
        <div className="row g-4">
          <div className="col-lg-3 d-none d-lg-block">
            <div className="filter-scroll">
              <Filters key={params.toString()} params={params} set={set} categories={categories} markets={markets} cities={marketData?.cities || []} practices={practiceData?.practices} />
            </div>
          </div>
          <div className="col-lg-9 shop-results" ref={resultsRef}>
            <div className="shop-toolbar">
              <SearchBox value={params.get('search') || ''} onSearch={onSearch} placeholder={t('Search products')} className="shop-search" />
              <button type="button" className="btn btn-white d-lg-none filter-open-btn" onClick={() => setShowFilters(true)}>
                <i className="bi bi-sliders" aria-hidden="true" /> {t('Filters')}
                {activeFilters.length > 0 && <span className="filter-count">{activeFilters.length}</span>}
              </button>
              <select className="form-select shop-sort" value={params.get('sort') || 'popular'} onChange={(e) => set({ sort: e.target.value })} aria-label={t('Sort products')}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
              <div className="view-toggle shop-view" role="group" aria-label={t('How to show the products')}>
                <button type="button" className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')} title={t('Grid view')}>
                  <i className="bi bi-grid-3x3-gap" aria-hidden="true" />
                  <span className="visually-hidden">{t('Grid view')}</span>
                </button>
                <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')} title={t('List view')}>
                  <i className="bi bi-list-ul" aria-hidden="true" />
                  <span className="visually-hidden">{t('List view')}</span>
                </button>
              </div>
            </div>
            <div className="results-bar">
              <span className="small text-muted-2">
                {rich('Showing <b>{n}</b> products', { n: data?.total ?? '…' })}
              </span>
              {activeFilters.length > 0 && (
                <div className="active-filters" aria-label={t('Filters in use')}>
                  {activeFilters.map((k) => (
                    <button key={k} type="button" className="active-filter" onClick={() => set(k === 'city' ? { city: '', market: '' } : { [k]: '' })} aria-label={t('Remove filter: {name}', { name: chipLabel(k) })}>
                      {chipLabel(k)} <i className="bi bi-x" aria-hidden="true" />
                    </button>
                  ))}
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setParams({})}>
                    {t('Clear filters')}
                  </button>
                </div>
              )}
            </div>

            {error && <ErrorState error={error} onRetry={reload} />}
            <div className={view === 'list' ? 'product-list' : 'row g-3'}>
              {loading && !data ? (
                <CardSkeletons count={9} cols={view === 'list' ? 'col-12' : 'col-6 col-md-4'} />
              ) : (
                data?.products.map((p) => (
                  <div key={p._id} className={view === 'list' ? 'product-list-item' : 'col-6 col-md-4 col-xl-3'}>
                    <ProductCard product={p} layout={view} />
                  </div>
                ))
              )}
            </div>
            {data && data.products.length === 0 && (
              <EmptyState
                icon="bi-search"
                title={t('Nothing matches those filters')}
                message={t('Try another category, market day or a wider price range.')}
                action={
                  <button type="button" className="btn btn-primary" onClick={() => setParams({})}>
                    {t('Clear all filters')}
                  </button>
                }
              />
            )}
            <Pagination page={data?.page || 1} pages={data?.pages} onChange={(p) => set({ page: String(p) })} />
          </div>
        </div>
      </div>

      <FilterSidebar open={showFilters} onClose={closeFilters} onClear={() => setParams({})} clearDisabled={activeFilters.length === 0}>
        <Filters key={params.toString()} params={params} set={set} categories={categories} markets={markets} cities={marketData?.cities || []} practices={practiceData?.practices} onDone={closeFilters} />
      </FilterSidebar>
    </>
  );
}
