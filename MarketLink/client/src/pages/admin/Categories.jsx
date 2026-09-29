import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api, toFormData } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import Modal, { ConfirmModal } from '../../components/common/Modal';
import DataGrid from '../../components/admin/DataGrid';
import { badge, display, esc, iconAction, thumbCell } from '../../utils/cells';
import { PageLoader } from '../../components/common/Loader';
import { ImageInput } from '../farmer/Products';
import UrduButton, { autoUrdu } from '../../components/common/UrduButton';

const EMPTY = { name: '', nameUr: '', description: '', color: '#E4F3D8', sortOrder: 0, isActive: true };

const COLUMNS = [
  { data: 'name', title: 'Category', responsivePriority: 1, render: display((v, c) => thumbCell(c.icon, v, esc((c.description || '').length > 70 ? `${c.description.slice(0, 68)}…` : c.description || ''), { bg: c.color, href: `/products?category=${c.slug}` })) },
  { data: 'productCount', title: 'Products', className: 'text-end' },
  { data: 'sortOrder', title: 'Order', className: 'text-end' },
  { data: 'color', title: 'Colour', orderable: false, render: display((v) => `<span class="d-inline-flex align-items-center gap-2 small"><span class="swatch" style="background:${esc(v)}"></span>${esc(v)}</span>`) },
  { data: 'isActive', title: 'Status', render: display((v) => badge(v ? 'active' : 'inactive', v ? 'Active' : 'Hidden'), (v) => (v ? 'Active' : 'Hidden')) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, c) => `${iconAction('edit', `Edit ${c.name}`, 'bi-pencil')} ${iconAction('delete', `Delete ${c.name}`, 'bi-trash3')}`,
  },
];

// Rendered with a `key`, so the form starts fresh for every category.
function CategoryForm({ category, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() =>
    category ? { name: category.name, nameUr: category.nameUr || '', description: category.description || '', color: category.color || '#E4F3D8', sortOrder: category.sortOrder, isActive: category.isActive } : EMPTY
  );
  const [file, setFile] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = toFormData(form, { icon: file, image: photo });
      if (category) await api.upload('PUT', `/admin/categories/${category._id}`, fd);
      else await api.upload('POST', '/admin/categories', fd);
      toast(category ? 'Category updated' : 'Category added');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={category ? `Edit ${category.name}` : 'Add category'}>
      <form onSubmit={save}>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="cat-name">Name</label>
            <input
              id="cat-name"
              className="form-control"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => autoUrdu({ kind: 'name', text: form.name, current: form.nameUr, onText: (v) => setForm((f) => (f.nameUr ? f : { ...f, nameUr: v })) })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="cat-name-ur">
              Name in Urdu <span className="text-muted-2 fw-normal">(optional)</span>
            </label>
            <div className="input-group urdu-group">
              <input id="cat-name-ur" className="form-control" dir="rtl" lang="ur" maxLength={60} value={form.nameUr} onChange={(e) => setForm({ ...form, nameUr: e.target.value })} placeholder="سبزیاں" />
              <UrduButton kind="name" text={form.name} onText={(v) => setForm((f) => ({ ...f, nameUr: v }))} compact />
            </div>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="cat-order">Sort order</label>
            <input id="cat-order" type="number" className="form-control" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="cat-desc">Description</label>
            <input id="cat-desc" className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="col-6">
            <label className="form-label" htmlFor="cat-color">Card colour</label>
            <input id="cat-color" type="color" className="form-control form-control-color w-100" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="col-6">
            <label className="form-label" htmlFor="cat-active">Visibility</label>
            <select id="cat-active" className="form-select" value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}>
              <option value="true">Active</option>
              <option value="false">Hidden</option>
            </select>
          </div>
          <div className="col-md-6">
            <ImageInput label="Icon (small round photo)" current={category?.icon} file={file} onFile={setFile} />
          </div>
          <div className="col-md-6">
            <ImageInput label="Card photo (home page, landscape)" current={category?.image} file={photo} onFile={setPhoto} />
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCategories() {
  useDocumentTitle('Categories');
  const { toast } = useToast();
  const { data, loading, reload } = useFetch('/admin/categories');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function remove() {
    try {
      await api.del(`/admin/categories/${deleting._id}`);
      toast('Category deleted');
      setDeleting(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(null);
    }
  }

  if (loading && !data) return <PageLoader />;
  return (
    <>
      <DashHeader
        title="Product categories"
        subtitle="Master data used by farmers when listing products and by customers when filtering."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <i className="bi bi-plus-lg" /> Add category
          </button>
        }
      />
      <div className="table-card">
        <DataGrid
          data={data.categories}
          columns={COLUMNS}
          order={[[2, 'asc']]}
          exportName="MarketLink categories"
          searchPlaceholder="Category name…"
          onAction={(name, c) => {
            if (name === 'edit') {
              setEditing(c);
              setOpen(true);
            }
            if (name === 'delete') setDeleting(c);
          }}
        />
      </div>
      {open && (
        <CategoryForm
          key={editing?._id || 'new'}
          category={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
      <ConfirmModal open={Boolean(deleting)} title={`Delete ${deleting?.name}?`} message="Categories that are used by products cannot be deleted. Hide them instead." confirmLabel="Delete" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  );
}
