import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DashHeader } from '../../components/common/PageHeader';
import ProductCard from '../../components/cards/ProductCard';
import FarmerCard from '../../components/cards/FarmerCard';
import MarketCard from '../../components/cards/MarketCard';
import EmptyState from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Loader';
import MapView from '../../components/map/MapView';
import { time12 } from '../../utils/format';
import { t } from '../../i18n';

export default function Favorites() {
  useDocumentTitle(t('Favourites'));
  const [tab, setTab] = useState('products');
  const { data, loading } = useFetch('/customer/favorites');
  if (loading && !data) return <PageLoader />;

  const tabs = [
    { value: 'products', label: t('Products'), n: data.products.length },
    { value: 'farmers', label: t('Farmers'), n: data.farmers.length },
    { value: 'markets', label: t('Saved markets'), n: data.markets.length },
  ];

  return (
    <>
      <DashHeader title={t('Favourites')} subtitle={t('Quick access to what you love. You\'ll get a restock alert when a favourite product is back.')} />
      <div className="tabs-pill mb-4" role="tablist">
        {tabs.map((tx) => (
          <button key={tx.value} type="button" role="tab" aria-selected={tab === tx.value} className={tab === tx.value ? 'active' : ''} onClick={() => setTab(tx.value)}>
            {t(tx.label)}
            <span className="n">{tx.n}</span>
          </button>
        ))}
      </div>

      {tab === 'products' &&
        (data.products.length ? (
          <div className="row g-3">
            {data.products.map((p) => (
              <div key={p._id} className="col-6 col-lg-4 col-xxl-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t('No favourite products yet')} message={t('Tap the heart on any product to save it here.')} action={<Link to="/products" className="btn btn-primary">{t('Browse products')}</Link>} />
        ))}

      {tab === 'farmers' &&
        (data.farmers.length ? (
          <div className="row g-3">
            {data.farmers.map((f) => (
              <div key={f._id} className="col-sm-6 col-xxl-4">
                <FarmerCard farmer={f} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="bi-people" title={t('No favourite farmers yet')} action={<Link to="/farmers" className="btn btn-primary">{t('Meet the farmers')}</Link>} />
        ))}

      {tab === 'markets' &&
        (data.markets.length ? (
          <>
            <MapView
              height={320}
              className="mb-4"
              markers={data.markets.map((m) => ({ id: m._id, lat: m.latitude, lng: m.longitude, type: 'market', image: m.image, title: m.name, subtitle: t('{from} to {to}', { from: time12(m.openTime), to: time12(m.closeTime) }), link: `/markets/${m.slug}` }))}
            />
            <div className="row g-3">
              {data.markets.map((m) => (
                <div key={m._id} className="col-sm-6 col-xxl-4">
                  <MarketCard market={m} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title={t('No saved markets')} message={t('Save your usual markets for quick directions and pickup details.')} action={<Link to="/markets" className="btn btn-primary">{t('Find markets')}</Link>} />
        ))}
    </>
  );
}
