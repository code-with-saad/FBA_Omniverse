import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api, toFormData } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import { ImageInput } from './Products';
import { PasswordForm } from '../customer/Profile';
import ProfilePhoto from '../../components/common/ProfilePhoto';
import { ApprovalBanner } from './Dashboard';
import SearchSelect from '../../components/common/SearchSelect';
import { categoryName, t } from '../../i18n';
import PhoneInput from '../../components/common/PhoneInput';
import SaveBar, { isChanged } from '../../components/common/SaveBar';
import UrduButton, { autoUrdu } from '../../components/common/UrduButton';

export default function FarmerProfile() {
  useDocumentTitle(t('Stall profile'));
  const { data, setData } = useFetch('/farmer/me');
  if (!data) return <PageLoader />;
  return <ProfileEditor data={data} setData={setData} />;
}

function ProfileEditor({ data, setData }) {
  const { user, refresh } = useAuth();
  const { data: catData } = useFetch('/categories');
  const { data: cityData } = useFetch('/cities');
  const { toast } = useToast();
  const [saved, setSaved] = useState(() => {
    const f = data.farmer;
    return {
      stallName: f.stallName,
      contactPerson: f.contactPerson,
      phone: f.phone,
      address: f.address,
      city: f.city || '',
      bio: f.bio || '',
      bioUr: f.bioUr || '',
      tags: (f.tags || []).join(', '),
      categories: (f.categories || []).map((c) => c._id || c),
    };
  });
  const [form, setForm] = useState(saved);
  const [logo, setLogo] = useState(null);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [variant, setVariant] = useState(0);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const dirty = isChanged(form, saved) || Boolean(logo || cover);
  const cancel = () => {
    setForm(saved);
    setLogo(null);
    setCover(null);
  };

  // "Generate with AI": a short "about the farm" text from the stall details
  async function writeBio() {
    if (form.stallName.trim().length < 2) return toast(t('Type the stall / farm name first'), 'warning');
    setWriting(true);
    try {
      const res = await api.post('/farmer/describe', {
        stallName: form.stallName,
        contactPerson: form.contactPerson,
        city: form.city,
        categories: form.categories,
        tags: form.tags,
        markets: (data.farmer.markets || []).map((m) => m._id || m),
        variant,
      });
      setForm((f) => ({ ...f, bio: res.description }));
      setVariant((v) => v + 1);
      fillUrduBio(res.description);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setWriting(false);
    }
    return undefined;
  }

  // "About your farm in Urdu" is written from the same stall details (or translated by Claude)
  const bioDetails = { stallName: form.stallName, city: form.city, categories: form.categories, tags: form.tags, markets: (data.farmer.markets || []).map((m) => m._id || m) };
  const fillUrduBio = (text = form.bio) => autoUrdu({ kind: 'farm-bio', text, details: bioDetails, current: form.bioUr, onText: (v) => setForm((f) => (f.bioUr ? f : { ...f, bioUr: v })) });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.upload('PUT', '/farmer/profile', toFormData(form, { logo, coverImage: cover }));
      setData(res);
      setSaved(form);
      setLogo(null);
      setCover(null);
      toast(t('Stall profile saved'));
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DashHeader
        title={t('Stall profile')}
        subtitle={t('This is what customers see on your public stall page.')}
        actions={
          data.farmer.isActive && (
            <Link to={`/farmers/${data.farmer.slug}`} className="btn btn-white" target="_blank">
              <i className="bi bi-box-arrow-up-right" /> {t('View public page')}
            </Link>
          )
        }
      />
      <ApprovalBanner status={user.status} />
      <div className="row g-4">
        <div className="col-xl-7">
          <form id="stall-form" className="panel" onSubmit={save}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="s-name">{t('Stall / business name')}</label>
                <input id="s-name" name="stallName" className="form-control" required value={form.stallName} onChange={change} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="s-contact">{t('Contact person')}</label>
                <input id="s-contact" name="contactPerson" className="form-control" required value={form.contactPerson} onChange={change} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="s-phone">{t('Contact number')}</label>
                <PhoneInput id="s-phone" required value={form.phone} onChange={change} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="s-email">{t('E-mail')}</label>
                <input id="s-email" className="form-control" value={data.farmer.email} disabled />
              </div>
              <div className="col-md-8">
                <label className="form-label" htmlFor="s-address">{t('Address')}</label>
                <input id="s-address" name="address" className="form-control" required value={form.address} onChange={change} />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="s-city">{t('City')}</label>
                <SearchSelect id="s-city" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} ariaLabel={t('City')} placeholder={t('Choose a city')} options={(cityData?.cities || []).map((c) => ({ value: c.name, label: t(c.name), hint: t(c.province) }))} />
              </div>
              <div className="col-12">
                <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
                  <label className="form-label mb-0" htmlFor="s-bio">{t('About your farm')}</label>
                  <button type="button" className="btn btn-sm btn-ai" onClick={writeBio} disabled={writing}>
                    {writing ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-stars" />} {variant ? t('Try another') : t('Generate with AI')}
                  </button>
                </div>
                <textarea id="s-bio" name="bio" rows={5} className="form-control" value={form.bio} onChange={change} onBlur={() => fillUrduBio()} maxLength={1200} />
                <span className="fs-7 text-muted-2">{t('The AI uses your stall name, city, categories, practices and markets. Edit the text before saving.')}</span>
              </div>
              <div className="col-12">
                <div className="urdu-label">
                  <label className="form-label mb-0" htmlFor="s-bio-ur">
                    {t('About your farm in Urdu')} <span className="text-muted-2 fw-normal">{t('(optional)')}</span>
                  </label>
                  <UrduButton kind="farm-bio" text={form.bio} details={bioDetails} onText={(v) => setForm((f) => ({ ...f, bioUr: v }))} />
                </div>
                <textarea id="s-bio-ur" name="bioUr" rows={4} className="form-control" dir="rtl" lang="ur" value={form.bioUr} onChange={change} maxLength={1500} />
                <span className="fs-7 text-muted-2">{t('Shown to visitors who use the site in Urdu. Leave empty to show the text above.')}</span>
              </div>
              <div className="col-12">
                <span className="form-label d-block">{t('What you grow / sell')}</span>
                <div className="choice-grid" role="group" aria-label={t('Categories')}>
                  {(catData?.categories || []).map((c) => {
                    const on = form.categories.includes(c._id);
                    return (
                      <button
                        type="button"
                        key={c._id}
                        className={`choice-tile ${on ? 'active' : ''}`}
                        aria-pressed={on}
                        onClick={() => setForm({ ...form, categories: on ? form.categories.filter((x) => x !== c._id) : [...form.categories, c._id] })}
                      >
                        <img src={c.icon} alt="" /> {categoryName(c)}
                        <i className="bi bi-check-circle-fill check" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="s-tags">{t('Farming practices (comma separated)')}</label>
                <input id="s-tags" name="tags" className="form-control" value={form.tags} onChange={change} placeholder={t('Pesticide-free, Family farm')} />
              </div>
              <div className="col-md-6">
                <ImageInput label={t('Logo')} current={data.farmer.logo} file={logo} onFile={setLogo} />
              </div>
              <div className="col-md-6">
                <ImageInput label={t('Cover photo')} current={data.farmer.coverImage} file={cover} onFile={setCover} />
              </div>
            </div>
            <SaveBar dirty={dirty} busy={busy} form="stall-form" onCancel={cancel} saveLabel={t('Save profile')} />
          </form>
        </div>
        <div className="col-xl-5 d-flex flex-column gap-4">
          <div className="panel">
            <div className="panel-head">
              <h5>
                <i className="bi bi-person-circle" /> {t('Your photo')}
              </h5>
            </div>
            <ProfilePhoto subtitle={t('Contact person · {stallName}', { stallName: data.farmer.stallName })} />
            <p className="small text-muted-2 mb-0">{t('Shown in the menu and on your dashboard. Your stall logo and cover photo are set on the left.')}</p>
          </div>
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
