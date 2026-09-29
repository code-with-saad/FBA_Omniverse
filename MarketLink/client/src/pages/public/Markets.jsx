import { useCallback, useState } from 'react';
import SearchBox from '../../components/common/SearchBox';
import useFetch from '../../hooks/useFetch';
import { toQuery } from '../../api/client';
import MarketCard from '../../components/cards/MarketCard';
import MapView from '../../components/map/MapView';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeletons } from '../../components/common/Loader';
import { PageHero } from '../../components/common/PageHeader';
import { getCurrentPosition } from '../../components/map/DirectionsMap';
import { DAY_NAMES, DAY_SHORT, time12 } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import SearchSelect from '../../components/common/SearchSelect';
import FilterSidebar from '../../components/common/FilterSidebar';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd, itemListLd, ldGraph } from '../../utils/seo';
import { categoryName, listText, t } from '../../i18n';

export default function Markets() {
  const todayDay = String(new Date().getDay());
  const [filters, setFilters] = useState({ search: '', city: '', category: '', day: todayDay });
  const { data: catData } = useFetch('/categories');
  const [location, setLocation] = useState(null);
  const [view, setView] = useState('grid');
  const [locating, setLocating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const activeCount = ['city', 'category', 'day'].filter((k) => filters[k]).length;
  const { toast } = useToast();
  const { data, loading } = useFetch(`/markets${toQuery({ ...filters, lat: location?.lat, lng: location?.lng })}`);
  const fields = [
    { label: 'City', control: <SearchSelect value={filters.city} onChange={(v) => setFilters({ ...filters, city: v })} ariaLabel={t('City')} emptyLabel="All cities" options={(data?.cities || []).map((c) => ({ value: c, label: t(c) }))} /> },
    { label: 'Category', control: <SearchSelect value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} ariaLabel={t('Category')} emptyLabel="All produce" options={(catData?.categories || []).map((c) => ({ value: c.slug, label: categoryName(c) }))} /> },
    { label: 'Market day', control: <SearchSelect value={filters.day} onChange={(v) => setFilters({ ...filters, day: v })} ariaLabel={t('Market day')} emptyLabel="Any day" options={DAY_NAMES.map((d, i) => ({ value: String(i), label: d }))} /> },
  ];
  const markets = data?.markets || [];
  useSeo({
    title: t('Farmers markets'),
    description: t('Find farmers markets near you: opening days and times, location on the map and the farmers selling at each market.'),
    jsonLd: ldGraph(itemListLd(t('Farmers markets on MarketLink'), markets.map((m) => ({ name: m.name, path: `/markets/${m.slug}` }))), breadcrumbLd([{ name: 'Markets', path: '/markets' }])),
    canonicalPath: '/markets',
  });

  async function nearMe() {
    setLocating(true);
    try {
      setLocation(await getCurrentPosition());
      toast(t('Showing markets closest to you'), 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <PageHero crumbs={[{ label: t('Markets') }]} title={t('Farmers markets')} subtitle={t('Browse markets by location and day, see which farmers are there and get directions to the pickup point.')} />
      <div className="container pb-5">
        <div className="soft-panel mb-4">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-lg-6 col-xl-3">
              <SearchBox value={filters.search} onSearch={(q) => setFilters((f) => ({ ...f, search: q }))} placeholder={t('Search market or area')} label={t('Search markets')} delay={150} />
            </div>
            {fields.map(({ label, control }) => (
              <div key={label} className="col-lg-2 d-none d-lg-block">
                {control}
              </div>
            ))}
            <div className="col-12 col-xl-3 d-flex flex-wrap gap-2 justify-content-end">
              <button type="button" className="btn btn-white filter-open-btn d-lg-none flex-shrink-0 me-auto" onClick={() => setShowFilters(true)}>
                <i className="bi bi-sliders" aria-hidden="true" /> {t('Filters')}
                {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
              </button>
              <button type="button" className={`btn text-nowrap flex-shrink-0 ${location ? 'btn-forest' : 'btn-white'}`} onClick={location ? () => setLocation(null) : nearMe} disabled={locating}>
                {locating ? <span className="spinner-border spinner-border-sm" /> : <i className={`bi ${location ? 'bi-check2-circle' : 'bi-crosshair'}`} />} {t('Near me')}
              </button>
              <div className="tabs-pill flex-nowrap flex-shrink-0">
                <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label={t('Grid view')}>
                  <i className="bi bi-grid" />
                </button>
                <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')} aria-label={t('Map view')}>
                  <i className="bi bi-map" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <FilterSidebar open={showFilters} onClose={closeFilters} onClear={() => setFilters({ ...filters, city: '', category: '', day: '' })} clearDisabled={activeCount === 0}>
          {fields.map(({ label, control }) => (
            <div key={label}>
              <span className="filter-sheet-label">{t(label)}</span>
              {control}
            </div>
          ))}
        </FilterSidebar>

        <div className="when-chips" role="group" aria-label={t('Market day')}>
          <button type="button" className={`filter-chip ${filters.day === todayDay ? 'active' : ''}`} aria-pressed={filters.day === todayDay} onClick={() => setFilters((f) => ({ ...f, day: todayDay }))}>
            <i className="bi bi-broadcast" aria-hidden="true" /> {t('Open today')}
          </button>
          <button type="button" className={`filter-chip ${filters.day === String((Number(todayDay) + 1) % 7) ? 'active' : ''}`} aria-pressed={filters.day === String((Number(todayDay) + 1) % 7)} onClick={() => setFilters((f) => ({ ...f, day: String((Number(todayDay) + 1) % 7) }))}>
            {t('Tomorrow')}
          </button>
          <button type="button" className={`filter-chip ${!filters.day ? 'active' : ''}`} aria-pressed={!filters.day} onClick={() => setFilters((f) => ({ ...f, day: '' }))}>
            {t('All days')}
          </button>
          {data && <span className="small text-muted-2 ms-1">{t('{n} markets', { n: markets.length })}</span>}
        </div>

        {view === 'map' ? (
          <MapView
            height={560}
            userLocation={location}
            markers={markets.map((m) => ({
              id: m._id,
              lat: m.latitude,
              lng: m.longitude,
              type: 'market',
              image: m.image,
              title: m.name,
              subtitle: t('{v1} · {v2} to {v3}', { v1: listText(m.operatingDays.map((d) => DAY_SHORT[d])), v2: time12(m.openTime), v3: time12(m.closeTime) }),
              link: `/markets/${m.slug}`,
            }))}
          />
        ) : (
          <div className="row g-3 g-lg-4">
            {loading && !data ? (
              <CardSkeletons count={6} cols="col-sm-6 col-lg-4" height={320} />
            ) : (
              markets.map((m) => (
                <div key={m._id} className="col-sm-6 col-lg-4">
                  <MarketCard market={m} />
                </div>
              ))
            )}
          </div>
        )}
        {data && markets.length === 0 && (
          <EmptyState
            title={filters.day === todayDay ? t('No market is open today') : t('No markets found')}
            message={t('Try a different day, city or produce type.')}
            action={
              filters.day && (
                <button type="button" className="btn btn-primary" onClick={() => setFilters((f) => ({ ...f, day: '' }))}>
                  {t('Show all days')}
                </button>
              )
            }
          />
        )}
      </div>
    </>
  );
}
