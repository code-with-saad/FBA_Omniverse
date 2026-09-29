import { useCallback, useState } from 'react';
import SearchBox from '../../components/common/SearchBox';
import useFetch from '../../hooks/useFetch';
import { toQuery } from '../../api/client';
import FarmerCard from '../../components/cards/FarmerCard';
import MapView from '../../components/map/MapView';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeletons } from '../../components/common/Loader';
import { PageHero } from '../../components/common/PageHeader';
import { DAY_NAMES, DAY_SHORT } from '../../utils/format';
import SearchSelect from '../../components/common/SearchSelect';
import FilterSidebar from '../../components/common/FilterSidebar';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd, itemListLd, ldGraph } from '../../utils/seo';
import { categoryName, listText, t } from '../../i18n';

const EMPTY_FILTERS = { city: '', market: '', day: '', category: '', rating: '', practice: '' };

export default function Farmers() {
  const [filters, setFilters] = useState({ search: '', city: '', market: '', day: '', category: '', rating: '', practice: '', sort: 'rating', page: 1 });
  const { data: practiceData } = useFetch('/practices');
  const [view, setView] = useState('grid');
  const { data, loading } = useFetch(`/farmers${toQuery({ ...filters, limit: view === 'map' ? 60 : 12, page: view === 'map' ? 1 : filters.page })}`);
  const { data: marketData } = useFetch('/markets');
  const { data: catData } = useFetch('/categories');
  const set = (changes) => setFilters((f) => ({ ...f, ...changes, page: changes.page || 1 }));
  const markets = (marketData?.markets || []).filter((m) => !filters.city || m.city === filters.city);
  const [showFilters, setShowFilters] = useState(false);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const activeCount = Object.keys(EMPTY_FILTERS).filter((k) => filters[k]).length;
  const fields = [
    { label: 'City', control: <SearchSelect value={filters.city} onChange={(v) => set({ city: v, market: '' })} ariaLabel={t('City')} emptyLabel="All cities" options={(marketData?.cities || []).map((c) => ({ value: c, label: t(c) }))} /> },
    { label: 'Market', control: <SearchSelect value={filters.market} onChange={(v) => set({ market: v })} ariaLabel={t('Market')} emptyLabel="All markets" options={markets.map((m) => ({ value: m._id, label: m.name, hint: m.city }))} /> },
    { label: 'Category', control: <SearchSelect value={filters.category} onChange={(v) => set({ category: v })} ariaLabel={t('Category')} emptyLabel="All categories" options={(catData?.categories || []).map((c) => ({ value: c.slug, label: categoryName(c) }))} /> },
    { label: 'Market day', control: <SearchSelect value={filters.day} onChange={(v) => set({ day: v })} ariaLabel={t('Market day')} emptyLabel="Any day" options={DAY_NAMES.map((d, i) => ({ value: String(i), label: d }))} /> },
    {
      label: 'Rating',
      control: (
        <select className="form-select" value={filters.rating} onChange={(e) => set({ rating: e.target.value })} aria-label={t('Rating')}>
          <option value="">{t('Any rating')}</option>
          <option value="4">{t('4 stars and up')}</option>
          <option value="3">{t('3 stars and up')}</option>
        </select>
      ),
    },
    { label: 'Farming practice', control: <SearchSelect value={filters.practice} onChange={(v) => set({ practice: v })} ariaLabel={t('Farming practice')} emptyLabel="Any practice" options={(practiceData?.practices || []).map((p) => ({ value: p, label: t(p) }))} /> },
  ];
  useSeo({
    title: t('Local farmers'),
    description: t('Meet the local farmers and stalls on MarketLink: what they grow, where they sell, ratings and their weekly stock.'),
    jsonLd: ldGraph(itemListLd(t('Local farmers on MarketLink'), (data?.farmers || []).map((f) => ({ name: f.stallName, path: `/farmers/${f.slug}` }))), breadcrumbLd([{ name: 'Farmers', path: '/farmers' }])),
    canonicalPath: '/farmers',
  });

  return (
    <>
      <PageHero crumbs={[{ label: t('Farmers') }]} title={t('Meet your local farmers')} subtitle={t('Every stall on MarketLink, with their markets, operating days, current stock and reviews.')} />
      <div className="container pb-5">
        <div className="soft-panel mb-4">
          <div className="row g-2">
            <div className="col-12 col-lg-6 col-xl-3">
              <SearchBox value={filters.search} onSearch={(q) => set({ search: q })} placeholder={t('Search farmer or speciality')} label={t('Search farmers')} delay={250} />
            </div>
            {fields.map(({ label, control }) => (
              <div key={label} className="col-md-3 d-none d-lg-block">
                {control}
              </div>
            ))}
            <div className="col-12 col-lg-6 col-xl-3 d-flex gap-2">
              <button type="button" className="btn btn-white filter-open-btn d-lg-none flex-shrink-0" onClick={() => setShowFilters(true)}>
                <i className="bi bi-sliders" aria-hidden="true" /> {t('Filters')}
                {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
              </button>
              <select className="form-select" value={filters.sort} onChange={(e) => set({ sort: e.target.value })} aria-label={t('Sort')}>
                <option value="rating">{t('Top rated')}</option>
                <option value="name">{t('Name A to Z')}</option>
                <option value="newest">{t('Newest')}</option>
              </select>
              <div className="tabs-pill flex-shrink-0">
                <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label={t('Grid view')} aria-pressed={view === 'grid'}>
                  <i className="bi bi-grid" />
                </button>
                <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')} aria-label={t('Map view')} aria-pressed={view === 'map'}>
                  <i className="bi bi-map" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <FilterSidebar open={showFilters} onClose={closeFilters} onClear={() => set(EMPTY_FILTERS)} clearDisabled={activeCount === 0}>
          {fields.map(({ label, control }) => (
            <div key={label}>
              <span className="filter-sheet-label">{t(label)}</span>
              {control}
            </div>
          ))}
        </FilterSidebar>

        {view === 'map' ? (
          <MapView
            height={560}
            markers={(data?.farmers || [])
              .filter((f) => f.latitude)
              .map((f) => ({
                id: f._id,
                lat: f.latitude,
                lng: f.longitude,
                type: 'farmer',
                image: f.logo,
                title: f.stallName,
                subtitle: `${listText(f.operatingDays.map((d) => DAY_SHORT[d]))} · ${listText(f.markets.map((m) => m.name))}`,
                link: `/farmers/${f.slug}`,
                linkLabel: t('View stall'),
              }))}
          />
        ) : (
          <div className="row g-3 g-lg-4">
            {loading && !data ? (
              <CardSkeletons count={8} cols="col-sm-6 col-lg-4 col-xl-3" height={330} />
            ) : (
              data?.farmers.map((f) => (
                <div key={f._id} className="col-sm-6 col-lg-4 col-xl-3">
                  <FarmerCard farmer={f} />
                </div>
              ))
            )}
          </div>
        )}
        {data && data.farmers.length === 0 && <EmptyState icon="bi-people" title={t('No farmers found')} message={t('Try clearing a filter.')} />}
        {view === 'grid' && <Pagination page={filters.page} pages={data?.pages} onChange={(page) => set({ page })} />}
      </div>
    </>
  );
}
