import { Link } from 'react-router-dom';
import { darkCoverFor, time12 } from '../../utils/format';
import DayDots from '../common/DayDots';
import { categoryName, t } from '../../i18n';

export default function MarketCard({ market }) {
  return (
    <article className="market-card">
      <div className="market-visual" style={{ '--cover': darkCoverFor(market.name) }}>
        {market.city && <span className="chip city">{t(market.city)}</span>}
        {market.distanceKm !== undefined && (
          <span className="chip chip-lime distance">
            <i className="bi bi-geo-alt-fill" /> {market.distanceKm} {t('km')}
          </span>
        )}
        {market.image ? <img src={market.image} alt={market.name} loading="lazy" /> : <i className="bi bi-shop-window fs-1 text-white-50" aria-hidden="true" />}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          <Link to={`/markets/${market.slug}`} className="stretched">
            {market.name}
          </Link>
        </h3>
        <div className="meta-line mb-1">
          <i className="bi bi-geo-alt" />
          <span>{market.address}</span>
        </div>
        {market.categories?.length > 0 && (
          <div className="meta-line mb-1">
            <i className="bi bi-basket" />
            <span className="text-truncate">{market.categories.map((c) => categoryName(c)).join(' · ')}</span>
          </div>
        )}
        <div className="meta-line mb-3">
          <i className="bi bi-clock" />
          <span>
            {time12(market.openTime)} {t('to')} {time12(market.closeTime)}
          </span>
        </div>
        <div className="mt-auto d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <DayDots days={market.operatingDays} />
          {market.farmerCount !== undefined && (
            <span className="small fw-semi text-muted-2">
              <i className="bi bi-shop" /> {market.farmerCount} {t('farmers')}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
