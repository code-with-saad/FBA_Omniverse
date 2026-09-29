import { t } from '../../i18n';
export function PageLoader({ label = t('Loading…') }) {
  return (
    <div className="page-loader" role="status">
      <div className="text-center">
        <div className="spinner-border text-primary mb-2" aria-hidden="true" />
        <div className="small text-muted-2">{label}</div>
      </div>
    </div>
  );
}

export function CardSkeletons({ count = 8, cols = 'col-6 col-md-4 col-xl-3', height = 300 }) {
  return Array.from({ length: count }, (_, i) => (
    <div className={cols} key={i}>
      <div className="skeleton" style={{ height }} />
    </div>
  ));
}

export function InlineSpinner() {
  return <span className="spinner-border spinner-border-sm" aria-hidden="true" />;
}
