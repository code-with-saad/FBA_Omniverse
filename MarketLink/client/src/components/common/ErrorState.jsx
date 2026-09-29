import { t } from '../../i18n';
export default function ErrorState({ error, onRetry }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-3 rounded-4" role="alert">
      <i className="bi bi-exclamation-triangle fs-4" />
      <div className="flex-grow-1">{error?.message || t('Something went wrong.')}</div>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-white" onClick={onRetry}>
          {t('Try again')}
        </button>
      )}
    </div>
  );
}
