import { t } from '../../i18n';
export default function RatingStars({ value = 0, count, size }) {
  const stars = [];
  for (let i = 1; i <= 5; i += 1) {
    const icon = value >= i ? 'bi-star-fill' : value >= i - 0.5 ? 'bi-star-half' : 'bi-star';
    stars.push(<i key={i} className={`bi ${icon}`} />);
  }
  return (
    <span className="rating" style={size ? { fontSize: size } : undefined} aria-label={t('Rated {value} out of 5', { value })}>
      {stars}
      {count !== undefined && <span className="count">{count ? `${Number(value).toFixed(1)} (${count})` : t('No reviews yet')}</span>}
    </span>
  );
}

export function StarInput({ value, onChange, label = t('Rating') }) {
  return (
    <div className="star-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <i className={`bi ${n <= value ? 'bi-star-fill' : 'bi-star'}`} />
        </button>
      ))}
    </div>
  );
}
