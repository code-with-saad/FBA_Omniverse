import { useMemo, useState } from 'react';
import SearchBox from '../../components/common/SearchBox';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import MapView from '../../components/map/MapView';
import { getCurrentPosition } from '../../components/map/DirectionsMap';
import { DAY_LETTER, DAY_NAMES, DAY_SHORT, distanceKm, time12 } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import SearchSelect from '../../components/common/SearchSelect';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd } from '../../utils/seo';
import { listText, t } from '../../i18n';

export default function MapExplore() {
  useSeo({ title: t('Market map'), description: t('All farmers markets and farmer stalls on one map, with directions and opening days.'), jsonLd: breadcrumbLd([{ name: 'Market map', path: '/map' }]) });
  const { data } = useFetch('/map');
  const { toast } = useToast();
  const [layer, setLayer] = useState('all');
  const [day, setDay] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [me, setMe] = useState(null);
  const [city, setCity] = useState(null);

  const cities = useMemo(() => {
    const counts = {};
    for (const m of data?.markets || []) if (m.city) counts[m.city] = (counts[m.city] || 0) + 1;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [data]);
  const activeCity = city ?? cities[0] ?? '';

  const items = useMemo(() => {
    if (!data) return [];
    const list = [
      ...data.markets.map((m) => ({
        id: m._id,
        type: 'market',
        lat: m.latitude,
        lng: m.longitude,
        image: m.image,
        title: m.name,
        subtitle: t('{v1} · {v2} to {v3}', { v1: listText(m.operatingDays.map((d) => DAY_SHORT[d])), v2: time12(m.openTime), v3: time12(m.closeTime) }),
        address: m.address,
        city: m.city,
        days: m.operatingDays,
        link: `/markets/${m.slug}`,
        linkLabel: t('View market'),
      })),
      ...data.farmers.map((f) => ({
        id: f._id,
        type: 'farmer',
        lat: f.latitude,
        lng: f.longitude,
        image: f.logo,
        title: f.stallName,
        subtitle: t('Stall · {v1}', { v1: listText(f.markets.map((m) => m.name)) }),
        address: f.address,
        city: f.city,
        days: f.operatingDays,
        link: `/farmers/${f.slug}`,
        linkLabel: t('View stall'),
      })),
    ];
    return list
      .filter((i) => !activeCity || me || i.city === activeCity)
      .filter((i) => layer === 'all' || i.type === layer)
      .filter((i) => day === '' || i.days.includes(Number(day)))
      .filter((i) => !search || `${i.title} ${i.address}`.toLowerCase().includes(search.toLowerCase()))
      .map((i) => (me ? { ...i, distance: distanceKm(me.lat, me.lng, i.lat, i.lng) } : i))
      .sort((a, b) => (me ? a.distance - b.distance : a.title.localeCompare(b.title)));
  }, [data, layer, day, search, me, activeCity]);

  async function locate() {
    try {
      setMe(await getCurrentPosition());
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="container-fluid px-3 px-lg-4">
      <div className="explore-layout">
        <div className="explore-panel">
          <div className="p-3 border-bottom">
            <h1 className="h4 mb-3">{t('Explore the map')}</h1>
            <SearchSelect size="sm" className="mb-2" value={activeCity} onChange={setCity} ariaLabel={t('City')} emptyLabel="All cities" disabled={Boolean(me)} options={cities.map((c) => ({ value: c, label: t(c) }))} />
            <SearchBox className="mb-2" value={search} onSearch={setSearch} placeholder={t('Search markets or stalls')} label={t('Search map')} delay={150} />
            <div className="d-flex gap-1 mb-2 flex-wrap">
              {[
                ['all', t('All')],
                ['market', t('Markets')],
                ['farmer', t('Farmer stalls')],
              ].map(([v, l]) => (
                <button key={v} type="button" className={`filter-chip ${layer === v ? 'active' : ''}`} onClick={() => setLayer(v)}>
                  {l}
                </button>
              ))}
              <button type="button" className={`filter-chip ms-auto ${me ? 'active' : ''}`} onClick={me ? () => setMe(null) : locate}>
                <i className="bi bi-crosshair" /> {t('Near me')}
              </button>
            </div>
            <div className="day-picker">
              {DAY_LETTER.map((letter, i) => (
                <button key={i} type="button" className={String(i) === day ? 'active' : ''} onClick={() => setDay(String(i) === day ? '' : String(i))} title={DAY_NAMES[i]} aria-label={DAY_NAMES[i]}>
                  {letter}
                </button>
              ))}
            </div>
          </div>
          <div className="explore-list">
            <div className="small text-muted-2 px-2 py-1">{items.length} {t('places')}</div>
            {items.map((i) => (
              <div
                key={i.id}
                role="button"
                tabIndex={0}
                className={`explore-item ${selected === i.id ? 'active' : ''}`}
                onClick={() => setSelected(i.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(i.id)}
              >
                <span className="thumb" style={{ background: i.type === 'market' ? '#173b2c' : '#fde7d6' }}>
                  <img src={i.image} alt="" />
                </span>
                <span className="flex-grow-1 min-w-0">
                  <strong className="d-block small">{i.title}</strong>
                  <span className="d-block fs-7 text-muted-2 text-truncate">{i.subtitle}</span>
                  <span className="fs-7">
                    <span className={`chip ${i.type === 'market' ? 'chip-dark' : 'chip-warn'} py-0`}>{i.type === 'market' ? t('Market') : t('Stall')}</span>
                    {i.distance !== undefined && <span className="ms-2 fw-semi">{i.distance} {t('km')}</span>}
                  </span>
                </span>
                <Link to={i.link} className="btn btn-sm btn-soft btn-icon align-self-center" onClick={(e) => e.stopPropagation()} aria-label={t('Open {title}', { title: i.title })}>
                  <i className="bi bi-arrow-right" />
                </Link>
              </div>
            ))}
          </div>
        </div>
        <MapView markers={items} selectedId={selected} onSelect={setSelected} userLocation={me} height="100%" scrollWheelZoom />
      </div>
    </div>
  );
}
