import useFavorite from '../../hooks/useFavorite';
import { t } from '../../i18n';

export default function FavButton({ type, id, className = '', withLabel = false }) {
  const { active, toggle, busy } = useFavorite(type, id);
  const icon = type === 'markets' ? (active ? 'bi-bookmark-fill' : 'bi-bookmark') : active ? 'bi-heart-fill' : 'bi-heart';
  const label = type === 'markets' ? (active ? t('Saved') : t('Save market')) : active ? t('Favourited') : t('Add to favourites');

  if (withLabel) {
    return (
      <button type="button" className={`btn ${active ? 'btn-forest' : 'btn-white'} ${className}`} onClick={toggle} disabled={busy} aria-pressed={active}>
        <i className={`bi ${icon} ${active && type !== 'markets' ? 'text-danger' : ''}`} /> {label}
      </button>
    );
  }
  return (
    <button type="button" className={`fav-btn ${active ? 'active' : ''} ${className}`} onClick={toggle} disabled={busy} aria-pressed={active} aria-label={label} title={label}>
      <i className={`bi ${icon}`} />
    </button>
  );
}
