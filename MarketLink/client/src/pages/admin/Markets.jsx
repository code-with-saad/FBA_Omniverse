import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api, toFormData } from '../../api/client';
import { resetFilterOptions, useFilterOptions } from '../../components/admin/FilterBar';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import Modal, { ConfirmModal } from '../../components/common/Modal';
import LocationPicker from '../../components/map/LocationPicker';
import DataGrid from '../../components/admin/DataGrid';
import AiWriteButton from '../../components/common/AiWriteButton';
import { badge, dayDotsCell, display, esc, iconAction, muted, thumbCell } from '../../utils/cells';
import { PageLoader } from '../../components/common/Loader';
import { ImageInput } from '../farmer/Products';
import { DAY_LETTER, DAY_NAMES, time12 } from '../../utils/format';
import SearchSelect from '../../components/common/SearchSelect';
import UrduButton, { autoUrdu } from '../../components/common/UrduButton';

const EMPTY = { name: '', description: '', descriptionUr: '', address: '', city: '', categories: [], latitude: '', longitude: '', operatingDays: [], openTime: '07:00', closeTime: '13:00', mapProvider: 'openstreetmap', mapLink: '', isActive: true };

const COLUMNS = [
  {
    data: 'name',
    title: 'Market',
    responsivePriority: 1,
    className: 'td-min-lg',
    render: display((v, m) => thumbCell(m.image, v, esc(m.address), { bg: '#173b2c', href: `/markets/${m.slug}`, cls: m.image?.includes('/seed/') ? '' : 'photo' })),
  },
  { data: 'operatingDays', title: 'Days', orderable: false, render: display((v) => dayDotsCell(v || []), (v) => (v || []).map((d) => DAY_NAMES[d]).join(', ')) },
  { data: 'openTime', title: 'Hours', className: 'dt-nowrap', render: display((v, m) => `<span class="small">${esc(time12(v))} to ${esc(time12(m.closeTime))}</span>`, (v, m) => `${v}-${m.closeTime}`) },
  { data: 'city', title: 'City', render: display((v) => `<span class="small text-nowrap">${esc(v || '-')}</span>`) },
  { data: 'categories', title: 'Sells', orderable: false, className: 'td-min', render: display((v) => muted((v || []).map((c) => c.name).join(', ') || '-'), (v) => (v || []).map((c) => c.name).join(', ')) },
  { data: 'farmerCount', title: 'Farmers', className: 'text-end' },
  { data: 'isActive', title: 'Status', render: display((v) => badge(v ? 'active' : 'inactive', v ? 'Active' : 'Hidden'), (v) => (v ? 'Active' : 'Hidden')) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, m) => `${iconAction('edit', `Edit ${m.name}`, 'bi-pencil')} ${iconAction('delete', `Remove ${m.name}`, 'bi-trash3')}`,
  },
];

// Rendered with a `key`, so the form starts fresh for every market.
function MarketForm({ market, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => (market ? { ...EMPTY, ...market, mapLink: market.mapLink || '', description: market.description || '', descriptionUr: market.descriptionUr || '', city: market.city || '', categories: (market.categories || []).map((c) => c._id || c) } : EMPTY));
  const options = useFilterOptions();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const urduDetails = { name: form.name, city: form.city, operatingDays: form.operatingDays, openTime: form.openTime, closeTime: form.closeTime };
  const toggleDay = (d) => setForm({ ...form, operatingDays: form.operatingDays.includes(d) ? form.operatingDays.filter((x) => x !== d) : [...form.operatingDays, d].sort() });

  async function submit(e) {
    e.preventDefault();
    if (form.latitude === '' || form.longitude === '') return toast('Please set the market location on the map', 'warning');
    setBusy(true);
    try {
      const body = { ...form, operatingDays: form.operatingDays.join(','), categories: form.categories.join(',') };
      ['_id', 'slug', 'createdAt', 'updatedAt', '__v', 'image', 'farmerCount'].forEach((k) => delete body[k]);
      const fd = toFormData(body, { image: file });
      if (market) await api.upload('PUT', `/admin/markets/${market._id}`, fd);
      else await api.upload('POST', '/admin/markets', fd);
      toast(market ? 'Market updated' : 'Market added');
      resetFilterOptions();
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <Modal open onClose={onClose} title={market ? `Edit ${market.name}` : 'Add a market'} size="modal-lg">
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-md-7">
            <label className="form-label" htmlFor="m-name">Market name</label>
            <input id="m-name" name="name" className="form-control" required value={form.name} onChange={change} />
          </div>
          <div className="col-md-5">
            <label className="form-label" htmlFor="m-city">City</label>
            <SearchSelect
              id="m-city"
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
              required
              ariaLabel="City"
              placeholder="Choose a city"
              options={options.cities.filter((c) => c.isActive !== false || c.name === form.city).map((c) => ({ value: c.name, label: c.name, hint: c.province }))}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="m-address">Address</label>
            <input id="m-address" name="address" className="form-control" required value={form.address} onChange={change} />
          </div>
          <div className="col-12">
            <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
              <label className="form-label mb-0" htmlFor="m-desc">Description</label>
              <AiWriteButton
                kind="market-description"
                english
                context={() => ({
                  name: form.name,
                  address: form.address,
                  city: form.city,
                  days: form.operatingDays.map((d) => DAY_NAMES[d]).join(', '),
                  openTime: time12(form.openTime),
                  closeTime: time12(form.closeTime),
                  categories: options.categories.filter((c) => form.categories.includes(c._id)).map((c) => c.name).join(', '),
                })}
                missing={(c) => (!c.name.trim() ? 'Type the market name first' : '')}
                onText={(text) => setForm((f) => ({ ...f, description: text }))}
              />
            </div>
            <textarea
              id="m-desc"
              name="description"
              rows={2}
              className="form-control"
              value={form.description}
              onChange={change}
              onBlur={() => autoUrdu({ kind: 'market-description', text: form.description, details: urduDetails, current: form.descriptionUr, onText: (v) => setForm((f) => (f.descriptionUr ? f : { ...f, descriptionUr: v })) })}
            />
          </div>
          <div className="col-12">
            <div className="urdu-label">
              <label className="form-label mb-0" htmlFor="m-desc-ur">
                Description in Urdu <span className="text-muted-2 fw-normal">(optional)</span>
              </label>
              <UrduButton kind="market-description" text={form.description} details={urduDetails} onText={(v) => setForm((f) => ({ ...f, descriptionUr: v }))} />
            </div>
            <textarea id="m-desc-ur" name="descriptionUr" rows={2} className="form-control" dir="rtl" lang="ur" value={form.descriptionUr} onChange={change} maxLength={1200} />
          </div>
          <div className="col-12">
            <span className="form-label d-block">What is sold here (categories)</span>
            <div className="pick-chips">
              {options.categories.map((c) => {
                const on = form.categories.includes(c._id);
                return (
                  <button type="button" key={c._id} className={`filter-chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => setForm({ ...form, categories: on ? form.categories.filter((x) => x !== c._id) : [...form.categories, c._id] })}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="col-md-6">
            <span className="form-label d-block">Operating days</span>
            <div className="day-picker">
              {DAY_LETTER.map((l, i) => (
                <button type="button" key={i} className={form.operatingDays.includes(i) ? 'active' : ''} onClick={() => toggleDay(i)} aria-label={DAY_NAMES[i]} aria-pressed={form.operatingDays.includes(i)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="m-open">Opens</label>
            <input id="m-open" name="openTime" type="time" className="form-control" value={form.openTime} onChange={change} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="m-close">Closes</label>
            <input id="m-close" name="closeTime" type="time" className="form-control" value={form.closeTime} onChange={change} />
          </div>
          <div className="col-12">
            <span className="form-label d-block">Map location</span>
            <LocationPicker lat={form.latitude} lng={form.longitude} onChange={(p) => setForm((f) => ({ ...f, latitude: p.lat, longitude: p.lng }))} height={260} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="m-lat">Latitude</label>
            <input id="m-lat" name="latitude" type="number" step="0.000001" className="form-control" required value={form.latitude} onChange={change} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="m-lng">Longitude</label>
            <input id="m-lng" name="longitude" type="number" step="0.000001" className="form-control" required value={form.longitude} onChange={change} />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="m-provider">Map provider</label>
            <select id="m-provider" name="mapProvider" className="form-select" value={form.mapProvider} onChange={change}>
              <option value="openstreetmap">OpenStreetMap</option>
              <option value="google">Google Maps</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="m-active">Visibility</label>
            <select id="m-active" name="isActive" className="form-select" value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}>
              <option value="true">Active</option>
              <option value="false">Hidden</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="m-link">Map link (optional embed / share link)</label>
            <input id="m-link" name="mapLink" className="form-control" value={form.mapLink} onChange={change} placeholder="https://www.google.com/maps/…" />
          </div>
          <div className="col-12">
            <ImageInput label="Market image" current={market?.image} file={file} onFile={setFile} />
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm" />} {market ? 'Save market' : 'Add market'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminMarkets() {
  useDocumentTitle('Manage markets');
  const { toast } = useToast();
  const { data, loading, reload } = useFetch('/admin/markets');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function remove() {
    try {
      const res = await api.del(`/admin/markets/${deleting._id}`);
      toast(res.message);
      setDeleting(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (loading && !data) return <PageLoader />;
  return (
    <>
      <DashHeader
        title="Markets"
        subtitle="Add, edit or remove farmers markets, their days, timings and map coordinates."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <i className="bi bi-plus-lg" /> Add market
          </button>
        }
      />
      <div className="table-card">
        <DataGrid
          data={data.markets}
          columns={COLUMNS}
          order={[[0, 'asc']]}
          exportName="MarketLink markets"
          searchPlaceholder="Market, address or city…"
          onAction={(name, m) => {
            if (name === 'edit') {
              setEditing(m);
              setOpen(true);
            }
            if (name === 'delete') setDeleting(m);
          }}
        />
      </div>
      {open && (
        <MarketForm
          key={editing?._id || 'new'}
          market={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name}?`}
        message="Farmers selling here will have their pickup windows for this market removed. Markets with order history are archived instead of deleted."
        confirmLabel="Remove market"
        danger
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
