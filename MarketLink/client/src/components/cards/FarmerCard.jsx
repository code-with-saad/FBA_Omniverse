import { Link } from 'react-router-dom';
import { TodayBadge } from '../../utils/marketToday';
import { coverFor } from '../../utils/format';
import RatingStars from '../common/RatingStars';
import DayDots from '../common/DayDots';
import FavButton from '../common/FavButton';
import { localText, t } from '../../i18n';

/** A farmer's stall. `showLocation` (home page) shows where the farm is instead of the description. */
export default function FarmerCard({ farmer, showLocation = false }) {
  return (
    <article className="farmer-card">
      <div className="cover" style={{ '--cover': coverFor(farmer.stallName) }}>
        {(farmer.coverImage || farmer.logo) && <img className="cover-photo" src={farmer.coverImage || farmer.logo} alt="" loading="lazy" />}
        <div className="position-absolute" style={{ top: 12, insetInlineEnd: 12, zIndex: 3 }}>
          <FavButton type="farmers" id={farmer._id} />
        </div>
      </div>
      <div className="farmer-logo">{farmer.logo ? <img src={farmer.logo} alt={t('{name} logo', { name: farmer.stallName })} loading="lazy" /> : <i className="bi bi-shop fs-3 text-success" />}</div>
      <div className="card-body">
        <h3 className="card-title">
          <Link to={`/farmers/${farmer.slug}`} className="stretched">
            {farmer.stallName}
          </Link>
        </h3>
        <div className="mb-2 d-flex align-items-center gap-2 flex-wrap">
          <RatingStars value={farmer.ratingAvg} count={farmer.ratingCount} />
          <TodayBadge farmer={farmer} />
        </div>
        {showLocation && (farmer.address || farmer.city) && (
          <p className="farmer-place">
            <i className="bi bi-geo-alt-fill" aria-hidden="true" />
            <span>{farmer.address && farmer.city && !farmer.address.includes(farmer.city) ? `${farmer.address}, ${t(farmer.city)}` : farmer.address || t(farmer.city)}</span>
          </p>
        )}
        {!showLocation && localText(farmer, 'bio') && (
          <p className="small text-muted-2 mb-3" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {localText(farmer, 'bio')}
          </p>
        )}
        <div className="d-flex flex-wrap gap-1 mb-3">
          {(farmer.tags || []).slice(0, 3).map((tx) => (
            <span key={tx} className="chip chip-soft">
              {t(tx)}
            </span>
          ))}
        </div>
        <div className="mt-auto d-flex align-items-center justify-content-between gap-2">
          <DayDots days={farmer.operatingDays} />
          {farmer.productCount !== undefined && <span className="small fw-semi text-muted-2">{farmer.productCount} {t('items')}</span>}
        </div>
      </div>
    </article>
  );
}
