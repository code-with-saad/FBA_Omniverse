import { SOCIAL } from '../../config';
import { t } from '../../i18n';

/** Round social media icon links (footer and Contact page). */
export default function SocialLinks({ className = '' }) {
  return (
    <ul className={`social-links ${className}`} aria-label={t('MarketLink on social media')}>
      {SOCIAL.map((s) => (
        <li key={s.name}>
          <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name} title={s.name}>
            <i className={`bi ${s.icon}`} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
