import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import useClickOutside from '../../hooks/useClickOutside';
import { timeAgo } from '../../utils/format';
import { t, tServer } from '../../i18n';

export const NOTIF_ICONS = { order: 'bi-bag-check', restock: 'bi-arrow-repeat', stock: 'bi-box-seam', announcement: 'bi-megaphone', review: 'bi-star', account: 'bi-person-check', moderation: 'bi-flag', system: 'bi-info-circle' };

/** Bell icon with unread count. Polls the API every 30 seconds for new in-app alerts. */
export default function NotificationBell({ allLink }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [top, setTop] = useState(null); // phones: where the full-width list starts (under the bell)
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);

  const loadCount = useCallback(() => {
    api.get('/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 30000);
    return () => clearInterval(timer);
  }, [loadCount]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setTop(Math.round(ref.current.getBoundingClientRect().bottom + 8));
    if (next) {
      const data = await api.get('/notifications?limit=8').catch(() => null);
      if (data) {
        setItems(data.notifications);
        setUnread(data.unread);
      }
    }
  }

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      await api.post(`/notifications/${n._id}/read`).catch(() => {});
      loadCount();
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    await api.post('/notifications/read-all').catch(() => {});
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  return (
    <div className="ml-dropdown" ref={ref}>
      <button type="button" className="nav-icon-btn" onClick={toggle} aria-label={t('Notifications ({unread} unread)', { unread })} aria-expanded={open}>
        <i className="bi bi-bell" />
        {unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="ml-dropdown-menu notif-menu" style={{ '--notif-top': top ? `${top}px` : undefined }}>
          <div className="d-flex align-items-center justify-content-between px-2 py-1">
            <strong>{t('Notifications')}</strong>
            {unread > 0 && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={markAll}>
                {t('Mark all read')}
              </button>
            )}
          </div>
          {items.length === 0 && <div className="text-center text-muted-2 small py-4"><i className="bi bi-check2-circle me-1" /> {t('You\'re all caught up')}</div>}
          {items.map((n) => (
            <button type="button" key={n._id} className={`notif-item w-100 border-0 text-start ${n.read ? 'bg-transparent' : 'unread'}`} onClick={() => openItem(n)}>
              <span className="notif-icon">
                <i className={`bi ${NOTIF_ICONS[n.type] || 'bi-bell'}`} />
              </span>
              <span className="min-w-0">
                <strong className="d-block small">{tServer(n.title)}</strong>
                <span className="d-block fs-7 text-muted-2">{tServer(n.message)}</span>
                <span className="fs-7 text-muted-2">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
          <Link to={allLink} className="ml-dropdown-item justify-content-center fw-semi" onClick={() => setOpen(false)}>
            {t('View all notifications')}
          </Link>
        </div>
      )}
    </div>
  );
}
