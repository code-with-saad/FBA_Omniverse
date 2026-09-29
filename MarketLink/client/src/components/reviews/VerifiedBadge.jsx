import { t } from '../../i18n';
/** "Verified purchase" when the customer bought what they reviewed, "Unverified" otherwise. */
export default function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="review-badge is-verified" title={t('This customer bought it on MarketLink')}>
      <i className="bi bi-patch-check-fill" aria-hidden="true" /> {t('Verified purchase')}
    </span>
  ) : (
    <span className="review-badge" title={t('Written without a MarketLink purchase')}>
      <i className="bi bi-question-circle" aria-hidden="true" /> {t('Unverified')}
    </span>
  );
}
