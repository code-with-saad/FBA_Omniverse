import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import Modal, { ConfirmModal } from '../../components/common/Modal';
import { PageLoader } from '../../components/common/Loader';
import DataGrid from '../../components/admin/DataGrid';
import { resetFilterOptions } from '../../components/admin/FilterBar';
import { action, display, esc, muted } from '../../utils/cells';

const COLUMNS = [
  { data: 'name', title: 'City', responsivePriority: 1, render: display((v, c) => `<strong class="small d-block">${esc(v)}</strong>${muted(c.province || '')}`) },
  { data: 'markets', title: 'Markets', className: 'text-end' },
  { data: 'farmers', title: 'Farmers', className: 'text-end' },
  { data: 'customers', title: 'Customers', className: 'text-end' },
  { data: 'latitude', title: 'Map centre', orderable: false, render: display((v, c) => (v != null ? `<span class="small text-nowrap">${esc(v)}, ${esc(c.longitude)}</span>` : '-'), (v, c) => (v != null ? `${v}, ${c.longitude}` : '')) },
  { data: 'isActive', title: 'In dropdowns', render: display((v) => (v ? '<span class="chip chip-lime">Shown</span>' : '<span class="chip chip-soft">Hidden</span>'), (v) => (v ? 'Shown' : 'Hidden')) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, c) => [action('edit', 'Edit', 'btn-white', 'bi-pencil'), action('toggle', c.isActive ? 'Hide' : 'Show'), action('delete', '', 'btn-white', 'bi-trash3')].join(' '),
  },
];

const EMPTY = { name: '', province: '', latitude: '', longitude: '', isActive: true };

/** Cities table: the city dropdowns for markets, farmers and filters come from here. */
export default function AdminCities() {
  useDocumentTitle('Cities');
  const { toast } = useToast();
  const { data, loading, reload } = useFetch('/admin/cities');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const saved = (msg) => {
    toast(msg);
    resetFilterOptions();
    reload();
  };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing._id) await api.put(`/admin/cities/${editing._id}`, editing);
      else await api.post('/admin/cities', editing);
      setEditing(null);
      saved('City saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onAction(name, city) {
    try {
      if (name === 'edit') setEditing({ ...city, latitude: city.latitude ?? '', longitude: city.longitude ?? '' });
      if (name === 'toggle') {
        await api.put(`/admin/cities/${city._id}`, { isActive: !city.isActive });
        saved(city.isActive ? `${city.name} hidden from dropdowns` : `${city.name} shown in dropdowns`);
      }
      if (name === 'delete') setDeleting(city);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove() {
    try {
      await api.del(`/admin/cities/${deleting._id}`);
      setDeleting(null);
      saved('City deleted');
    } catch (err) {
      setDeleting(null);
      toast(err.message, 'error');
    }
  }

  const change = (e) => setEditing({ ...editing, [e.target.name]: e.target.value });

  return (
    <>
      <DashHeader
        title="Cities"
        subtitle="The city dropdowns for markets, farmers and all filters come from this table."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
            <i className="bi bi-plus-lg" /> Add city
          </button>
        }
      />
      <div className="table-card">{loading && !data ? <PageLoader /> : <DataGrid data={data.cities} columns={COLUMNS} order={[[1, 'desc']]} exportName="MarketLink cities" onAction={onAction} searchPlaceholder="Search cities…" />}</div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? `Edit ${editing.name}` : 'Add a city'}
        footer={
          <>
            <button type="button" data-modal-cancel className="btn btn-white" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="city-form" className="btn btn-primary" disabled={busy}>
              Save city
            </button>
          </>
        }
      >
        {editing && (
          <form id="city-form" onSubmit={save} className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="c-name">City name</label>
              <input id="c-name" name="name" className="form-control" required value={editing.name} onChange={change} />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="c-prov">Province</label>
              <input id="c-prov" name="province" className="form-control" value={editing.province} onChange={change} />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="c-lat">Latitude (city centre)</label>
              <input id="c-lat" name="latitude" type="number" step="any" className="form-control" value={editing.latitude} onChange={change} />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="c-lng">Longitude</label>
              <input id="c-lng" name="longitude" type="number" step="any" className="form-control" value={editing.longitude} onChange={change} />
            </div>
            <div className="col-12 form-check ms-2">
              <input id="c-active" type="checkbox" className="form-check-input" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
              <label className="form-check-label small" htmlFor="c-active">
                Show in the city dropdowns
              </label>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmModal open={Boolean(deleting)} title={`Delete ${deleting?.name}?`} message="Cities that still have markets cannot be deleted; hide them instead." confirmLabel="Delete" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  );
}
