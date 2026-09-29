import { useLocation } from 'react-router-dom';
import { t } from '../../i18n';

/** Grey placeholder shapes shown while a page or its data is loading (e.g. on a slow connection). */
export function Bone({ w = '100%', h = 16, r, className = '', style }) {
  return <span className={`skeleton bone ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

function CardGrid({ count = 4, height = 280 }) {
  return (
    <div className="row g-3 g-lg-4">
      {Array.from({ length: count }, (_, i) => (
        <div className="col-6 col-md-4 col-xl-3" key={i}>
          <div className="skeleton-card">
            <Bone h={height * 0.55} r="1rem" />
            <Bone w="70%" h={14} className="mt-3" />
            <Bone w="45%" h={12} className="mt-2" />
            <Bone w="100%" h={34} r="50rem" className="mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shape of the home page: banner, the promises under it, category cards and products. */
export function HomeSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label={t('Loading the home page')}>
      <div className="container">
        <div className="skeleton hero-skeleton" />
        <div className="skeleton-searchcard skeleton-trust">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} h={44} r="0.8rem" />
          ))}
        </div>
        <Bone w={260} h={26} className="mt-5 mb-3" />
        <div className="skeleton-rail">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} h={210} r="1.1rem" />
          ))}
        </div>
        <Bone w={220} h={26} className="mt-5 mb-3" />
        <CardGrid count={4} />
      </div>
      <span className="visually-hidden">{t('Loading…')}</span>
    </div>
  );
}

/** Generic page: title area and a grid of cards (shop, markets, farmers ...). */
export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label={t('Loading the page')}>
      <div className="container">
        <Bone w={140} h={12} className="mt-4" />
        <Bone w="min(420px, 80%)" h={38} className="mt-3" />
        <Bone w="min(560px, 90%)" h={14} className="mt-3 mb-4" />
        <CardGrid count={8} />
      </div>
      <span className="visually-hidden">{t('Loading…')}</span>
    </div>
  );
}

/** Suspense fallback for public pages: the home page gets its own shape. */
export function RouteSkeleton() {
  const { pathname } = useLocation();
  return pathname === '/' ? <HomeSkeleton /> : <PageSkeleton />;
}
