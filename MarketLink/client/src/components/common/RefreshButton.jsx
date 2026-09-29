import { useState } from 'react';
import { time12 } from '../../utils/format';
import { t } from '../../i18n';

const clock = (d) => time12(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

/**
 * Reloads a dashboard's numbers without reloading the whole page. The icon turns while the new data
 * loads; the time of the last update is shown next to it (on wider screens) and in the tooltip.
 * `onRefresh` starts the reload, `loading` is true until the new data is there.
 */
export default function RefreshButton({ onRefresh, loading = false, className = '' }) {
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [turning, setTurning] = useState(false);
  const busy = turning || loading;

  function refresh() {
    setTurning(true);
    setUpdatedAt(new Date());
    setTimeout(() => setTurning(false), 600); // a short turn even when the data comes back at once
    onRefresh();
  }

  const time = clock(updatedAt);
  return (
    <button type="button" className={`btn btn-white refresh-btn ${className}`} onClick={refresh} disabled={busy} title={t('Last updated {time}', { time })} aria-label={t('Refresh the numbers')}>
      <i className={`bi bi-arrow-clockwise ${busy ? 'is-spinning' : ''}`} aria-hidden="true" />
      <span className="refresh-label">{busy ? t('Updating…') : t('Refresh')}</span>
      <span className="refresh-time d-none d-xl-inline">{t('Updated {time}', { time })}</span>
    </button>
  );
}
