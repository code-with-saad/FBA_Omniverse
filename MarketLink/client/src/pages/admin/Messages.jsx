import { useState } from 'react';
import { CONTACT_TOPICS, topicLabel } from '../../utils/contactTopics';
import { useOutletContext } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { action, dateCell, display, esc, muted } from '../../utils/cells';
import { formatDate } from '../../utils/format';

const FILTERS = [
  { name: 'status', label: 'Status', options: [{ value: 'new', label: 'New' }, { value: 'read', label: 'Read' }] },
  { name: 'topic', label: 'Topic', options: CONTACT_TOPICS },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const COLUMNS = [
  { data: 'name', title: 'From', responsivePriority: 1, render: display((v, m) => `<strong class="small d-block">${esc(v)}</strong>${muted(m.email)}`) },
  { data: 'subject', title: 'Subject', render: display((v, m) => `${m.topic ? `<span class="chip chip-soft me-1">${esc(topicLabel(m.topic))}</span>` : ''}<span class="small ${m.status === 'new' ? 'fw-bold' : ''}">${esc(v || '(no subject)')}</span><div class="fs-7 text-muted-2 dt-clip">${esc(m.message)}</div>`) },
  { data: 'status', title: 'Status', render: display((v) => (v === 'new' ? '<span class="chip chip-lime">New</span>' : '<span class="chip chip-soft">Read</span>')) },
  { data: 'createdAt', title: 'Received', render: display((v) => dateCell(v, true)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, m) => [action('open', 'Open', 'btn-soft', 'bi-envelope-open'), action('toggle', m.status === 'new' ? 'Mark read' : 'Mark unread'), action('delete', '', 'btn-white', 'bi-trash3')].join(' '),
  },
];

export default function AdminMessages() {
  useDocumentTitle('Contact messages');
  const { toast } = useToast();
  const { refreshBadges } = useOutletContext();
  const [filters, setFilters] = useState({ status: '', topic: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState(null);
  const refresh = () => {
    setReloadKey((k) => k + 1);
    refreshBadges();
  };

  async function onAction(name, m) {
    try {
      if (name === 'open') {
        setOpen(m);
        if (m.status === 'new') {
          await api.patch(`/admin/messages/${m._id}`, { status: 'read' });
          refresh();
        }
      }
      if (name === 'toggle') {
        await api.patch(`/admin/messages/${m._id}`, { status: m.status === 'new' ? 'read' : 'new' });
        refresh();
      }
      if (name === 'delete') {
        await api.del(`/admin/messages/${m._id}`);
        toast('Message deleted');
        refresh();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <DashHeader title="Contact messages" subtitle="Messages sent through the Contact Us page." />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="messages" columns={COLUMNS} filters={filters} order={[[3, 'desc']]} exportName="MarketLink messages" reloadKey={reloadKey} onAction={onAction} searchPlaceholder="Name, e-mail or text…" />
      </div>
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.subject || '(no subject)'}
        guardChanges={false}
        footer={
          <a className="btn btn-primary" href={`mailto:${open?.email}?subject=Re: ${encodeURIComponent(open?.subject || 'Your message')}`}>
            <i className="bi bi-reply" /> Reply by e-mail
          </a>
        }
      >
        <div className="fs-7 text-muted-2 mb-2">
          {open?.name} · {open?.email} · {open && formatDate(open.createdAt, { time: true })}
        </div>
        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
          {open?.message}
        </p>
      </Modal>
    </>
  );
}
