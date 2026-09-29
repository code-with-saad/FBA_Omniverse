import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { DashHeader } from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import { PageLoader } from '../../components/common/Loader';
import { formatDate, timeAgo } from '../../utils/format';
import { NOTIF_ICONS as ICONS } from '../../components/layout/NotificationBell';
import { t, tServer } from '../../i18n';


/** In-app notifications (shared by customers, farmers and admins). */
export default function Notifications() {
  useDocumentTitle(t('Notifications'));
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch(`/notifications?page=${page}&limit=15`);
  const navigate = useNavigate();

  async function open(n) {
    if (!n.read) await api.post(`/notifications/${n._id}/read`).catch(() => {});
    if (n.link) navigate(n.link);
    else reload();
  }
  async function markAll() {
    await api.post('/notifications/read-all');
    reload();
  }
  async function remove(id) {
    await api.del(`/notifications/${id}`);
    reload();
  }

  if (loading && !data) return <PageLoader />;
  return (
    <>
      <DashHeader
        title={t('Notifications')}
        subtitle={t('{unread} unread · order updates, stock alerts, reviews and announcements', { unread: data.unread })}
        actions={
          data.unread > 0 && (
            <button type="button" className="btn btn-white" onClick={markAll}>
              <i className="bi bi-check2-all" /> {t('Mark all as read')}
            </button>
          )
        }
      />
      {data.notifications.length === 0 ? (
        <EmptyState icon="bi-bell" title={t('No notifications yet')} message={t('Order updates, restock alerts and announcements will appear here.')} />
      ) : (
        <div className="panel p-2">
          {data.notifications.map((n) => (
            <div key={n._id} className={`notif-item align-items-center ${n.read ? '' : 'unread'}`}>
              <span className="notif-icon">
                <i className={`bi ${ICONS[n.type] || 'bi-bell'}`} />
              </span>
              <button type="button" className="notif-open" onClick={() => open(n)}>
                <strong className="d-block small">{tServer(n.title)}</strong>
                <span className="d-block small text-muted-2">{tServer(n.message)}</span>
                <span className="fs-7 text-muted-2 d-inline-flex align-items-center gap-2 mt-1" title={formatDate(n.createdAt, { time: true })}>
                  {timeAgo(n.createdAt)}
                  {!n.read && <span className="chip chip-lime">{t('New')}</span>}
                </span>
              </button>
              <button type="button" className="btn btn-sm btn-icon btn-white" onClick={() => remove(n._id)} aria-label={t('Delete notification')}>
                <i className="bi bi-trash3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={data.pages} onChange={setPage} />
    </>
  );
}
