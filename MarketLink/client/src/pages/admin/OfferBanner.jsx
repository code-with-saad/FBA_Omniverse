import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import OfferBanner from '../../components/home/OfferBanner';
import SaveBar, { isChanged } from '../../components/common/SaveBar';
import UrduButton from '../../components/common/UrduButton';

const FIELDS = [
  { name: 'tag', label: 'Small label', max: 40, hint: "e.g. This week's offers" },
  { name: 'title', label: 'Headline', max: 90, hint: 'Write {percent} where the number goes, e.g. "Up to {percent}% off fresh vegetables"' },
  { name: 'text', label: 'Text', max: 220, area: true },
  { name: 'buttonLabel', label: 'Button', max: 30 },
];
const URDU_MAX = { tag: 60, title: 120, text: 300, buttonLabel: 40 };

/** Admin: the "Up to N% off" offer banner on the home page (words, percent, photo, link) with a live preview. */
export default function AdminOfferBanner() {
  useDocumentTitle('Offer banner');
  const { data, loading, reload } = useFetch('/banners/home-offer');
  if (loading && !data) return <PageLoader />;
  if (!data?.banner) return null;
  // A new form after every save, so it starts from what was saved
  return <BannerForm key={data.banner.updatedAt || 'new'} saved={data.banner} reload={reload} />;
}

function BannerForm({ saved, reload }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({ ...saved }));
  const [file, setFile] = useState(null);
  const [photo, setPhoto] = useState(saved.image);
  const [busy, setBusy] = useState(false);
  const data = { banner: saved };

  function pickFile(next) {
    if (photo?.startsWith('blob:')) URL.revokeObjectURL(photo);
    setFile(next);
    setPhoto(next ? URL.createObjectURL(next) : saved.image);
  }
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const dirty = isChanged(form, saved) || Boolean(file);
  const livePercent = form.autoPercent && data.banner.deals ? data.banner.deals.maxPercent : Number(form.percent) || 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of FIELDS) {
        fd.append(f.name, form[f.name] || '');
        fd.append(`${f.name}Ur`, form[`${f.name}Ur`] || '');
      }
      fd.append('link', form.link || '');
      fd.append('percent', form.percent);
      fd.append('autoPercent', form.autoPercent);
      fd.append('isActive', form.isActive);
      if (file) fd.append('image', file);
      const res = await api.upload('PUT', '/admin/banners/home-offer', fd);
      toast(res.message || 'Offer banner saved');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DashHeader title="Offer banner" subtitle="The offer banner on the home page. Change the percent, the words, the photo and where the button goes; the preview updates as you type." />
      <div className="row g-4">
        <div className="col-xl-5">
          <form id="banner-form" className="panel" onSubmit={save}>
            <div className="panel-head">
              <h5>
                <i className="bi bi-percent" /> Banner details
              </h5>
            </div>
            <div className="d-grid gap-3">
              <div className="form-check form-switch">
                <input id="ob-active" type="checkbox" role="switch" className="form-check-input" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                <label className="form-check-label" htmlFor="ob-active">
                  Show the banner on the home page
                </label>
              </div>
              <div className="row g-2 align-items-end">
                <div className="col-5">
                  <label className="form-label" htmlFor="ob-percent">
                    Percent off
                  </label>
                  <div className="input-group">
                    <input id="ob-percent" type="number" min={0} max={90} className="form-control" value={form.percent} disabled={form.autoPercent} onChange={(e) => set('percent', e.target.value)} />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
                <div className="col-7">
                  <div className="form-check">
                    <input id="ob-auto" type="checkbox" className="form-check-input" checked={form.autoPercent} onChange={(e) => set('autoPercent', e.target.checked)} />
                    <label className="form-check-label small" htmlFor="ob-auto">
                      Use the biggest real offer this week{data.banner.deals ? ` (${data.banner.deals.maxPercent}% now)` : ' (no offers now)'}
                    </label>
                  </div>
                </div>
              </div>
              {FIELDS.map((f) => (
                <div key={f.name} className="row g-2">
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor={`ob-${f.name}`}>
                      {f.label}
                    </label>
                    {f.area ? (
                      <textarea id={`ob-${f.name}`} className="form-control" rows={3} maxLength={f.max} value={form[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} />
                    ) : (
                      <input id={`ob-${f.name}`} className="form-control" required maxLength={f.max} value={form[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} />
                    )}
                  </div>
                  <div className="col-sm-6">
                    <div className="urdu-label">
                      <label className="form-label mb-0" htmlFor={`ob-${f.name}-ur`}>
                        In Urdu <span className="text-muted-2 fw-normal">(optional)</span>
                      </label>
                      <UrduButton kind="text" text={form[f.name]} onText={(v) => set(`${f.name}Ur`, v)} />
                    </div>
                    {f.area ? (
                      <textarea
                        id={`ob-${f.name}-ur`}
                        className="form-control"
                        dir="rtl"
                        lang="ur"
                        rows={3}
                        maxLength={URDU_MAX[f.name]}
                        value={form[`${f.name}Ur`] || ''}
                        onChange={(e) => set(`${f.name}Ur`, e.target.value)}
                      />
                    ) : (
                      <input
                        id={`ob-${f.name}-ur`}
                        className="form-control"
                        dir="rtl"
                        lang="ur"
                        maxLength={URDU_MAX[f.name]}
                        value={form[`${f.name}Ur`] || ''}
                        onChange={(e) => set(`${f.name}Ur`, e.target.value)}
                      />
                    )}
                  </div>
                  {f.hint && <div className="form-text mt-1">{f.hint}</div>}
                </div>
              ))}
              <div>
                <label className="form-label" htmlFor="ob-link">
                  Button link
                </label>
                <input id="ob-link" className="form-control" required maxLength={200} placeholder="/products?deals=true" value={form.link || ''} onChange={(e) => set('link', e.target.value)} />
                <div className="form-text">A page on this site, for example /products?deals=true or /products?category=fruits</div>
              </div>
              <div>
                <label className="form-label" htmlFor="ob-image">
                  Photo
                </label>
                <input id="ob-image" type="file" accept="image/png,image/jpeg,image/webp" className="form-control" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
                <div className="form-text">A wide photo (about 1200 × 750), up to 2 MB.</div>
              </div>
            </div>
            <SaveBar
              dirty={dirty}
              busy={busy}
              form="banner-form"
              saveLabel="Save banner"
              onCancel={() => {
                setForm({ ...saved });
                pickFile(null);
              }}
            />
          </form>
        </div>
        <div className="col-xl-7">
          <div className="panel offer-preview">
            <div className="panel-head">
              <h5>
                <i className="bi bi-eye" /> Preview
              </h5>
              {!form.isActive && <span className="chip chip-soft">Hidden from the home page</span>}
            </div>
            <OfferBanner preview banner={{ ...form, image: photo, shownPercent: livePercent }} />
          </div>
        </div>
      </div>
    </>
  );
}
