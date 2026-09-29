import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import { MONTHS, monthsLabel } from '../../utils/format';
import DataGrid from '../../components/admin/DataGrid';
import AiWriteButton from '../../components/common/AiWriteButton';
import { action, badge, dateCell, display, esc, iconAction } from '../../utils/cells';
import UrduButton from '../../components/common/UrduButton';

const AUDIENCE = { all: 'Everyone', customer: 'Customers', farmer: 'Farmers' };

// Harvest seasons in Pakistan, used as one-click presets for the month chips
const SEASONS = [
  { label: 'All year', months: [] },
  { label: 'Winter', months: [12, 1, 2] },
  { label: 'Spring', months: [3, 4] },
  { label: 'Summer', months: [5, 6, 7, 8] },
  { label: 'Autumn', months: [9, 10, 11] },
];

const EMPTY = { title: '', message: '', titleUr: '', messageUr: '', audience: 'all', months: [], link: '', notify: true };

const sameMonths = (a, b) => a.length === b.length && a.every((m) => b.includes(m));

function statusOf(a, month) {
  if (!a.isActive) return ['cancelled', 'Hidden'];
  return !a.months?.length || a.months.includes(month) ? ['completed', 'Live banner'] : ['placed', 'Waiting for its season'];
}

const columns = (month) => [
  {
    data: 'title',
    title: 'Announcement',
    responsivePriority: 1,
    className: 'dt-comment',
    render: display((v, a) => `<strong class="small d-block">${esc(v)}</strong><div class="fs-7 text-muted-2 dt-clip">${esc(a.message)}</div>${a.link ? `<div class="fs-7 mt-1"><i class="bi bi-link-45deg"></i> ${esc(a.link)}</div>` : ''}`),
  },
  { data: 'audience', title: 'Audience', responsivePriority: 5, render: display((v) => `<span class="chip chip-soft">${esc(AUDIENCE[v] || v)}</span>`, (v) => AUDIENCE[v] || v) },
  { data: 'months', title: 'Season', orderable: false, responsivePriority: 4, render: display((v) => `<span class="small text-nowrap"><i class="bi bi-calendar3"></i> ${esc(monthsLabel(v || []))}</span>`, (v) => monthsLabel(v || [])) },
  { data: 'isActive', title: 'Status', responsivePriority: 3, render: display((v, a) => badge(...statusOf(a, month)), (v, a) => statusOf(a, month)[1]) },
  { data: 'createdAt', title: 'Created', responsivePriority: 6, render: display((v, a) => `${dateCell(v)}<div class="fs-7 text-muted-2">by ${esc(a.createdBy?.name || 'Admin')}</div>`) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, a) => `${iconAction('edit', `Edit ${a.title}`, 'bi-pencil')} ${action('toggle', a.isActive ? 'Hide' : 'Show')} ${iconAction('delete', 'Delete announcement', 'bi-trash3')}`,
  },
];

export default function AdminAnnouncements() {
  useDocumentTitle('Announcements');
  const { toast } = useToast();
  const { data, loading, reload } = useFetch('/admin/announcements');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const month = data?.month || new Date().getMonth() + 1;

  function toggleMonth(m) {
    setForm((f) => {
      const months = f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m].sort((a, b) => a - b);
      return { ...f, months: months.length === 12 ? [] : months };
    });
  }

  function startEdit(a) {
    setEditing(a._id);
    setForm({ title: a.title, message: a.message, titleUr: a.titleUr || '', messageUr: a.messageUr || '', audience: a.audience, months: a.months || [], link: a.link || '', notify: false });
    document.getElementById('an-title')?.focus();
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const { notify: _notify, ...body } = form;
        await api.put(`/admin/announcements/${editing}`, body);
        toast('Announcement updated');
      } else {
        const res = await api.post('/admin/announcements', form);
        if (!res.inSeason) toast(`Saved. It will show in ${monthsLabel(res.announcement.months)}.`, 'info');
        else toast(`Published${res.delivered ? ` and sent to ${res.delivered} users` : ''}`);
      }
      setEditing(null);
      setForm(EMPTY);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a) {
    await api.put(`/admin/announcements/${a._id}`, { isActive: !a.isActive });
    reload();
  }
  async function remove(a) {
    await api.del(`/admin/announcements/${a._id}`);
    if (editing === a._id) cancelEdit();
    toast('Announcement deleted');
    reload();
  }

  return (
    <>
      <DashHeader
        title="Announcements"
        subtitle="Publish platform-wide notices. Pick the months a notice belongs to, so seasonal banners (mangoes in summer, kinnow in winter) show only in their season."
      />
      <div className="row g-4">
        <div className="col-xl-5">
          <form className="panel" onSubmit={save}>
            <div className="panel-head">
              <h5>
                <i className={`bi ${editing ? 'bi-pencil-square' : 'bi-megaphone'}`} /> {editing ? 'Edit announcement' : 'New announcement'}
              </h5>
            </div>
            <div className="d-grid gap-3">
              <div>
                <label className="form-label" htmlFor="an-title">Title</label>
                <input id="an-title" className="form-control" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
                  <label className="form-label mb-0" htmlFor="an-msg">Message</label>
                  <AiWriteButton kind="announcement" english context={() => ({ title: form.title })} missing={(c) => (!c.title.trim() ? 'Type the title first' : '')} onText={(text) => setForm((f) => ({ ...f, message: text.slice(0, 1000) }))} />
                </div>
                <textarea id="an-msg" className="form-control" rows={4} required maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <div>
                <div className="urdu-label">
                  <label className="form-label mb-0" htmlFor="an-title-ur">
                    Title in Urdu <span className="text-muted-2 fw-normal">(optional)</span>
                  </label>
                  <UrduButton kind="text" text={form.title} onText={(v) => setForm((f) => ({ ...f, titleUr: v }))} />
                </div>
                <input id="an-title-ur" className="form-control" dir="rtl" lang="ur" maxLength={160} value={form.titleUr} onChange={(e) => setForm({ ...form, titleUr: e.target.value })} />
              </div>
              <div>
                <div className="urdu-label">
                  <label className="form-label mb-0" htmlFor="an-msg-ur">
                    Message in Urdu <span className="text-muted-2 fw-normal">(optional)</span>
                  </label>
                  <UrduButton kind="text" text={form.message} onText={(v) => setForm((f) => ({ ...f, messageUr: v }))} />
                </div>
                <textarea id="an-msg-ur" className="form-control" dir="rtl" lang="ur" rows={3} maxLength={1200} value={form.messageUr} onChange={(e) => setForm({ ...form, messageUr: e.target.value })} />
                <div className="form-text">Shown when a visitor switches the site to Urdu.</div>
              </div>
              <div>
                <label className="form-label" htmlFor="an-aud">Audience</label>
                <select id="an-aud" className="form-select" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  {Object.entries(AUDIENCE).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="form-label d-block">
                  Season <span className="text-muted-2 fw-normal">· {monthsLabel(form.months)}</span>
                </span>
                <div className="season-presets" role="group" aria-label="Season presets">
                  {SEASONS.map((s) => (
                    <button
                      type="button"
                      key={s.label}
                      className={`chip chip-btn ${sameMonths(form.months, s.months) ? 'active' : ''}`}
                      aria-pressed={sameMonths(form.months, s.months)}
                      onClick={() => setForm({ ...form, months: s.months })}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="month-picker" role="group" aria-label="Months">
                  {MONTHS.map((label, i) => (
                    <button type="button" key={label} className={form.months.includes(i + 1) ? 'active' : ''} aria-pressed={form.months.includes(i + 1)} onClick={() => toggleMonth(i + 1)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="form-text">No month selected means the notice shows all year.</div>
              </div>
              <div>
                <label className="form-label" htmlFor="an-link">
                  Link <span className="text-muted-2 fw-normal">(optional)</span>
                </label>
                <input id="an-link" className="form-control" maxLength={200} placeholder="/products?category=fruits" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </div>
              {!editing && (
                <div className="form-check">
                  <input id="an-notify" type="checkbox" className="form-check-input" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
                  <label className="form-check-label small" htmlFor="an-notify">
                    Also send as an in-app notification (only when it is in season now)
                  </label>
                </div>
              )}
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <i className={`bi ${editing ? 'bi-check2' : 'bi-send'}`} /> {editing ? 'Save changes' : 'Publish'}
              </button>
              {editing && (
                <button type="button" className="btn btn-white" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        <div className="col-xl-7">
          {loading && !data ? (
            <PageLoader />
          ) : (
            <div className="table-card h-100">
              <DataGrid
                data={data.announcements}
                columns={columns(month)}
                order={[[4, 'desc']]}
                exportName="MarketLink announcements"
                searchPlaceholder="Title or message…"
                onAction={(name, a) => {
                  if (name === 'edit') startEdit(a);
                  if (name === 'toggle') toggle(a);
                  if (name === 'delete') remove(a);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
