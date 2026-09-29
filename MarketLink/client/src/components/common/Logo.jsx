import { Link } from 'react-router-dom';
import { t } from '../../i18n';

/** MarketLink mark, designed in Canva (basket, leaf and handle in a rounded frame) and rebuilt as SVG. */
export function LogoMark({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <rect x="3" y="3" width="58" height="58" rx="15" fill="#ffffff" stroke="#0d3017" strokeWidth="4" />
      <path d="M19 33c0-9.5 5.8-15 13-15s13 5.5 13 15" fill="none" stroke="#0d3017" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M32.5 31.5c-3.8-7.2-0.9-15.6 9.4-18 1.3 9.4-2.6 16.2-9.4 18z" fill="#3fa34d" />
      <path d="M33.4 30.2c1.9-4.6 4.4-8.6 7.4-12.6" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="12" y="32" width="40" height="6" rx="3" fill="#0d3017" />
      <path d="M15.5 40h33l-3.6 13.6a4 4 0 0 1-3.9 3H23a4 4 0 0 1-3.9-3z" fill="#0d3017" />
      <path d="M17.3 46.4h29.4M18.9 52.1h26.2M25.4 40.5l1.2 15.6M32 40.5v15.6M38.6 40.5l-1.2 15.6" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ light = false, to = '/' }) {
  return (
    <Link to={to} className={`brand ${light ? 'brand-light' : ''}`} aria-label={t('MarketLink home')}>
      <LogoMark />
      <span className="brand-name">
        Market<span>Link</span>
      </span>
    </Link>
  );
}
