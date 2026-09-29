import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { localText, t } from '../../i18n';

const KEY = 'marketlink_dismissed_announcements';

function readDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/** Shows the latest active admin announcement (for the current season) as a thin banner above the navbar. */
export default function AnnouncementBar() {
  const { user } = useAuth();
  const { data } = useFetch(`/announcements/active?r=${user?.role || 'guest'}`);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(dismissed));
    } catch {
      /* ignore */
    }
  }, [dismissed]);

  const item = data?.announcements?.find((a) => !dismissed.includes(a._id));
  if (!item) return null;
  return (
    <div className="announcement-bar">
      <div className="container d-flex align-items-center gap-2 py-2">
        <i className="bi bi-megaphone-fill" />
        <span className="flex-grow-1 text-truncate">
          <strong>{localText(item, 'title')}</strong> <span className="d-none d-md-inline">{localText(item, 'message')}</span>
        </span>
        {item.link && (
          <Link to={item.link} className="announcement-link">
            {t('Shop now')} <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        )}
        <button type="button" className="btn-close" aria-label={t('Dismiss announcement')} onClick={() => setDismissed((d) => [...d, item._id])} />
      </div>
    </div>
  );
}
