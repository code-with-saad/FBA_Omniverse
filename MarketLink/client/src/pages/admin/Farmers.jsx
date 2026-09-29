import { useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import DayDots from '../../components/common/DayDots';
import DataGrid from '../../components/admin/DataGrid';
import AiWriteButton from '../../components/common/AiWriteButton';
import FilterBar from '../../components/admin/FilterBar';
import FarmerRankings from '../../components/admin/FarmerRankings';
import { action, badge, dateCell, display, esc, moneyCell, muted } from '../../utils/cells';
import { formatDate } from '../../utils/format';

const FILTERS = [
  { name: 'status', label: 'Status', options: [{ value: 'pending', label: 'Pending approval' }, { value: 'active', label: 'Approved' }, { value: 'suspended', label: 'Suspended' }] },
  { name: 'city', label: 'City', options: 'cities' },
  { name: 'market', label: 'Market', options: 'markets' },
  { name: 'category', label: 'Grows / sells', options: 'categories' },
  { name: 'from', label: 'Joined from', type: 'date' },
  { name: 'to', label: 'Joined to', type: 'date' },
];

const COLUMNS = [
  {
    data: 'stallName',
    title: 'Stall',
    responsivePriority: 1,
    render: display((v, f) => `<div class="d-flex align-items-center gap-2"><span class="thumb-sm"><img src="${esc(f.logo)}" alt=""></span><div class="min-w-0"><strong class="d-block small">${esc(v)}</strong>${muted(f.categories?.map((c) => c.name).join(', ') || '-')}</div></div>`),
  },
  { data: 'contactPerson', title: 'Contact', render: display((v, f) => `<span class="small">${esc(v)}</span><div>${muted(f.email)}</div>`) },
  { data: 'city', title: 'City', render: display((v) => esc(v || '-')) },
  { data: 'markets', title: 'Markets', orderable: false, render: display((v) => `<span class="small">${esc(v?.map((m) => m.name).join(', ') || '-')}</span>`, (v) => v?.map((m) => m.name).join(', ')) },
  { data: 'productCount', title: 'Products', orderable: false, className: 'text-end' },
  { data: 'orderCount', title: 'Orders', orderable: false, className: 'text-end' },
  { data: 'revenue', title: 'Revenue', orderable: false, className: 'text-end', render: display(moneyCell) },
  { data: 'ratingAvg', title: 'Rating', className: 'text-end', render: display((v, f) => (f.ratingCount ? `${esc(v)} <i class="bi bi-star-fill text-warning"></i>` : '-')) },
  { data: 'user.status', title: 'Status', orderable: false, render: display((v) => badge(v, v === 'active' ? 'Approved' : undefined)) },
  { data: 'createdAt', title: 'Joined', render: display((v) => dateCell(v)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, f) =>
      [
        action('view', 'View'),
        f.user?.status !== 'active' ? action('approve', f.user?.status === 'pending' ? 'Approve' : 'Re-activate', 'btn-primary', 'bi-check-lg') : action('suspend', 'Suspend', 'btn-outline-danger'),
      ].join(' '),
  },
];

export default function AdminFarmers() {
  useDocumentTitle('Manage farmers');
  const { toast } = useToast();
  const { openModal, changed } = useOutletContext();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ status: params.get('status') || '', city: '', market: '', category: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [viewing, setViewing] = useState(null);
  const [suspending, setSuspending] = useState(null);
  const [reason, setReason] = useState('');

  async function setFarmerStatus(farmer, next, why) {
    try {
      await api.patch(`/admin/farmers/${farmer._id}/status`, { status: next, reason: why });
      toast(next === 'active' ? `${farmer.stallName} approved` : `${farmer.stallName} suspended`);
      setSuspending(null);
      setViewing(null);
      setReason('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function onAction(name, farmer) {
    if (name === 'view') setViewing(farmer);
    if (name === 'approve') return setFarmerStatus(farmer, 'active'); // the button spins until it is saved
    if (name === 'suspend') setSuspending(farmer);
    return undefined;
  }

  return (
    <>
      <DashHeader
        title="Farmers"
        subtitle="Approve new registrations, add stalls yourself, or suspend stalls that break the guidelines."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('farmer')}>
            <i className="bi bi-person-plus" /> Add farmer
          </button>
        }
      />
      <FarmerRankings />
      <div className="table-card">
        <FilterBar fields={FILTERS} value={filters} onChange={setFilters} />
        <DataGrid table="farmers" columns={COLUMNS} filters={filters} order={[[9, 'desc']]} exportName="MarketLink farmers" onAction={onAction} reloadKey={reloadKey + changed} searchPlaceholder="Search stall, contact, e-mail…" />
      </div>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.stallName || ''} size="modal-lg" guardChanges={false}>
        {viewing && (
          <div className="row g-3">
            <div className="col-md-6">
              <div className="info-row"><span>Contact person</span><span>{viewing.contactPerson}</span></div>
              <div className="info-row"><span>Phone</span><span>{viewing.phone}</span></div>
              <div className="info-row"><span>E-mail</span><span>{viewing.email}</span></div>
              <div className="info-row"><span>Address</span><span>{viewing.address}{viewing.city ? `, ${viewing.city}` : ''}</span></div>
              <div className="info-row"><span>Status</span><span><StatusBadge status={viewing.user?.status} /></span></div>
              <div className="info-row"><span>Last login</span><span>{viewing.user?.lastLoginAt ? formatDate(viewing.user.lastLoginAt, { time: true }) : '-'}</span></div>
            </div>
            <div className="col-md-6">
              <p className="small">{viewing.bio || 'No description yet.'}</p>
              <div className="small mb-2">
                <strong>Grows / sells:</strong> {viewing.categories?.map((c) => c.name).join(', ') || '-'}
              </div>
              <div className="small mb-2">
                <strong>Practices:</strong> {viewing.tags?.join(', ') || '-'}
              </div>
              <div className="mb-2"><DayDots days={viewing.operatingDays} /></div>
              <div className="small text-muted-2">Markets: {viewing.markets.map((m) => m.name).join(', ') || '-'}</div>
              <div className="small text-muted-2">Map pin: {viewing.latitude ? `${viewing.latitude}, ${viewing.longitude}` : 'not set'}</div>
              {viewing.isActive && (
                <Link to={`/farmers/${viewing.slug}`} className="btn btn-sm btn-white mt-3">
                  Open public page
                </Link>
              )}
            </div>
            <div className="col-12 d-flex justify-content-end gap-2">
              {viewing.user?.status !== 'active' ? (
                <button type="button" className="btn btn-primary" onClick={() => setFarmerStatus(viewing, 'active')}>
                  Approve stall
                </button>
              ) : (
                <button type="button" className="btn btn-outline-danger" onClick={() => setSuspending(viewing)}>
                  Suspend stall
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        title={`Suspend ${suspending?.stallName}?`}
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={() => setSuspending(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setFarmerStatus(suspending, 'suspended', reason)}>
              Suspend
            </button>
          </>
        }
      >
        <p className="small text-muted-2">The farmer can no longer log in and all their products are hidden from customers.</p>
        <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
          <label className="form-label mb-0" htmlFor="suspend-reason">Reason (e-mailed to the farmer)</label>
          <AiWriteButton kind="moderation-note" english context={{ action: 'suspend' }} onText={setReason} />
        </div>
        <textarea id="suspend-reason" className="form-control" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
