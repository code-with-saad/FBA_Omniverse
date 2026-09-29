import { Link } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import EmptyState from '../../components/common/EmptyState';
import { t } from '../../i18n';

export default function NotFound() {
  useDocumentTitle(t('Page not found'));
  return (
    <div className="container py-5">
      <EmptyState icon="bi-signpost-split" title={t('This page wandered off the market')} message={t('The page you\'re looking for doesn\'t exist or has moved.')} action={<Link to="/" className="btn btn-primary">{t('Back home')}</Link>} />
    </div>
  );
}
