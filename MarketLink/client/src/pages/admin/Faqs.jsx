import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import DataGrid from '../../components/admin/DataGrid';
import AiWriteButton from '../../components/common/AiWriteButton';
import { action, badge, display, esc, iconAction, numberInput } from '../../utils/cells';
import UrduButton from '../../components/common/UrduButton';

const EMPTY = { question: '', answer: '', questionUr: '', answerUr: '', group: 'shopping', showOnHome: false };

const columns = (groups) => [
  {
    data: 'question',
    title: 'Question',
    responsivePriority: 1,
    className: 'dt-comment',
    render: display((v, f) => `<strong class="small d-block">${esc(v)}</strong><div class="fs-7 text-muted-2 dt-clip">${esc(f.answer)}</div>`),
  },
  { data: 'group', title: 'Topic', responsivePriority: 4, render: display((v) => `<span class="chip chip-soft">${esc(groups[v] || v)}</span>`, (v) => groups[v] || v) },
  { data: 'order', title: 'Order', responsivePriority: 5, className: 'text-nowrap', render: display((v, f) => numberInput('order', v, `Position of "${f.question}"`), (v) => v) },
  {
    data: 'showOnHome',
    title: 'Home page',
    responsivePriority: 6,
    render: display((v) => (v ? '<span class="chip chip-soft"><i class="bi bi-house"></i> Shown</span>' : '<span class="fs-7 text-muted-2">No</span>'), (v) => (v ? 'Yes' : 'No')),
  },
  { data: 'isActive', title: 'Status', responsivePriority: 3, render: display((v) => (v ? badge('completed', 'Published') : badge('cancelled', 'Hidden')), (v) => (v ? 'Published' : 'Hidden')) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, type, f) => `${iconAction('edit', `Edit "${f.question}"`, 'bi-pencil')} ${action('toggle', f.isActive ? 'Hide' : 'Publish')} ${iconAction('delete', 'Delete question', 'bi-trash3')}`,
  },
];

/** Admin: the questions on the FAQ page and the home page (they also feed search engines and AI assistants). */
export default function AdminFaqs() {
  useDocumentTitle('FAQs');
  const { toast } = useToast();
  const { data, loading, reload } = useFetch('/admin/faqs');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const groups = data?.groups || {};

  function startEdit(f) {
    setEditing(f._id);
    setForm({ question: f.question, answer: f.answer, questionUr: f.questionUr || '', answerUr: f.answerUr || '', group: f.group, showOnHome: f.showOnHome });
    document.getElementById('faq-question')?.focus();
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await api.put(`/admin/faqs/${editing}`, form);
      else await api.post('/admin/faqs', form);
      toast(editing ? 'Question updated' : 'Question published');
      cancelEdit();
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function update(f, body, message) {
    try {
      await api.put(`/admin/faqs/${f._id}`, body);
      if (message) toast(message);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove(f) {
    await api.del(`/admin/faqs/${f._id}`);
    if (editing === f._id) cancelEdit();
    toast('Question deleted');
    reload();
  }

  return (
    <>
      <DashHeader
        title="FAQs"
        subtitle="Questions on the FAQ page and the home page. Start every answer with one short, direct sentence: Google and AI assistants quote it."
        actions={
          <Link to="/faq" target="_blank" className="btn btn-white">
            <i className="bi bi-box-arrow-up-right" /> View FAQ page
          </Link>
        }
      />
      <div className="row g-4">
        <div className="col-xl-5">
          <form className="panel" onSubmit={save}>
            <div className="panel-head">
              <h5>
                <i className={`bi ${editing ? 'bi-pencil-square' : 'bi-plus-circle'}`} /> {editing ? 'Edit question' : 'New question'}
              </h5>
            </div>
            <div className="d-grid gap-3">
              <div>
                <label className="form-label" htmlFor="faq-question">Question</label>
                <input id="faq-question" className="form-control" required maxLength={200} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="How do I pay?" />
              </div>
              <div>
                <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
                  <label className="form-label mb-0" htmlFor="faq-answer">Answer</label>
                  <AiWriteButton kind="faq-answer" english context={() => ({ question: form.question })} missing={(c) => (!c.question.trim() ? 'Type the question first' : '')} onText={(text) => setForm((f) => ({ ...f, answer: text.slice(0, 1500) }))} />
                </div>
                <textarea id="faq-answer" className="form-control" rows={6} required maxLength={1500} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
                <div className="form-text">Leave an empty line between paragraphs. Lines starting with 1., 2., 3. become a numbered list.</div>
              </div>
              <div>
                <div className="urdu-label">
                  <label className="form-label mb-0" htmlFor="faq-question-ur">
                    Question in Urdu <span className="text-muted-2 fw-normal">(optional)</span>
                  </label>
                  <UrduButton kind="text" text={form.question} onText={(v) => setForm((f) => ({ ...f, questionUr: v }))} />
                </div>
                <input id="faq-question-ur" className="form-control" dir="rtl" lang="ur" maxLength={300} value={form.questionUr} onChange={(e) => setForm({ ...form, questionUr: e.target.value })} placeholder="ادائیگی کیسے کروں؟" />
              </div>
              <div>
                <div className="urdu-label">
                  <label className="form-label mb-0" htmlFor="faq-answer-ur">
                    Answer in Urdu <span className="text-muted-2 fw-normal">(optional)</span>
                  </label>
                  <UrduButton kind="text" text={form.answer} onText={(v) => setForm((f) => ({ ...f, answerUr: v }))} />
                </div>
                <textarea id="faq-answer-ur" className="form-control" dir="rtl" lang="ur" rows={5} maxLength={2500} value={form.answerUr} onChange={(e) => setForm({ ...form, answerUr: e.target.value })} />
                <div className="form-text">Shown when a visitor switches the site to Urdu. Leave empty to show the English text.</div>
              </div>
              <div>
                <label className="form-label" htmlFor="faq-group">Topic</label>
                <select id="faq-group" className="form-select" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
                  {Object.entries(groups).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-check">
                <input id="faq-home" type="checkbox" className="form-check-input" checked={form.showOnHome} onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })} />
                <label className="form-check-label small" htmlFor="faq-home">
                  Also show on the home page
                </label>
              </div>
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
                data={data.faqs}
                columns={columns(groups)}
                order={[]}
                exportName="MarketLink FAQs"
                searchPlaceholder="Question or answer…"
                emptyText="No questions yet"
                onEdit={(field, f, value) => update(f, { [field]: value }, 'Order saved')}
                onAction={(name, f) => {
                  if (name === 'edit') startEdit(f);
                  if (name === 'toggle') update(f, { isActive: !f.isActive }, f.isActive ? 'Question hidden' : 'Question published');
                  if (name === 'delete') remove(f);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
