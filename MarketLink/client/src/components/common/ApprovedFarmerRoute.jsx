import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';

/** Selling pages (stock, pre-orders, pickup, reviews) open only for approved farmers. */
export default function ApprovedFarmerRoute() {
  const { user } = useAuth();
  if (user?.status === 'active') return <Outlet />;
  const suspended = user?.status === 'suspended';
  return (
    <div className="locked-feature">
      <span className="locked-icon" aria-hidden="true">
        <i className={`bi ${suspended ? 'bi-slash-circle' : 'bi-lock'}`} />
      </span>
      <h1 className="h3">{suspended ? t('Your stall is suspended') : t('Available after approval')}</h1>
      <p className="text-muted-2">
        {suspended
          ? t('Selling features are switched off while your stall is suspended. Please contact the MarketLink team.')
          : t('Weekly stock, pre-orders and pickup settings open as soon as a MarketLink admin approves your stall. You will get an e-mail and a notification.')}
      </p>
      <div className="d-flex gap-2 justify-content-center flex-wrap">
        <Link to="/farmer" className="btn btn-primary">
          <i className="bi bi-hourglass-split" /> {t('Approval status')}
        </Link>
        <Link to="/farmer/profile" className="btn btn-white">
          <i className="bi bi-shop-window" /> {t('Complete stall profile')}
        </Link>
      </div>
    </div>
  );
}
