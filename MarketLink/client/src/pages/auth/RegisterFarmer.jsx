import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useFetch from '../../hooks/useFetch';
import LocationPicker from '../../components/map/LocationPicker';
import DayDots from '../../components/common/DayDots';
import { passwordOk } from './Register';
import { time12 } from '../../utils/format';
import TermsCheckbox from '../../components/legal/TermsCheckbox';
import PasswordInput from '../../components/common/PasswordInput';
import SearchSelect from '../../components/common/SearchSelect';
import useSeo from '../../hooks/useSeo';
import { categoryName, listText, t } from '../../i18n';
import { api } from '../../api/client';
import PhoneInput from '../../components/common/PhoneInput';

const STEPS = ['Stall & account', 'Farm details', 'Markets & location'];
const PRACTICES = ['Pesticide-free', 'Organic practices', 'Family farm', 'Free-range', 'Grass-fed', 'Hydroponic', 'Heirloom seeds', 'Picked daily', 'Small batch'];
const PHONE_RULE = /^\+?[\d\s()-]{7,20}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = {
  stallName: '',
  contactPerson: '',
  phone: '',
  email: '',
  password: '',
  confirm: '',
  address: '',
  city: '',
  bio: '',
  categories: [],
  tags: [],
  markets: [],
  latitude: '',
  longitude: '',
  acceptTerms: false,
};

/** Returns the first problem in a step, or '' when the step is complete. */
function validate(step, f) {
  if (step === 0) {
    if (!f.stallName.trim()) return t('Please enter your stall / business name.');
    if (!f.contactPerson.trim()) return t('Please enter the contact person.');
    if (!PHONE_RULE.test(f.phone.trim())) return t('Please enter a valid contact number (7-20 digits).');
    if (!EMAIL_RULE.test(f.email.trim())) return t('Please enter a valid e-mail address.');
    if (!passwordOk(f.password)) return t('Password: at least 8 characters with letters and numbers.');
    if (f.password !== f.confirm) return t('Passwords do not match.');
  }
  if (step === 1) {
    if (!f.address.trim()) return t('Please enter your farm or stall address.');
    if (!f.city.trim()) return t('Please enter your city.');
    if (!f.categories.length) return t('Choose at least one thing you grow or sell.');
  }
  if (step === 2 && !f.acceptTerms) return t('Please confirm your details and accept the Terms & Conditions.');
  return '';
}

export default function RegisterFarmer() {
  useSeo({ title: t('Sell with MarketLink'), description: t('Register your farm stall on MarketLink: list your weekly stock, take pre-orders and set your pickup times.'), canonicalPath: '/register/farmer' });
  const { registerFarmer, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: catData } = useFetch('/categories');
  const { data: marketData } = useFetch('/markets');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [customTag, setCustomTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [variant, setVariant] = useState(0);
  const [error, setError] = useState('');

  if (user && !busy) return <Navigate to={homeFor(user)} replace />;

  // Editing any field hides the previous error message
  const change = (e) => {
    setError('');
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const toggle = (key, value) => {
    setError('');
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));
  };

  // "Generate with AI" for "About your farm": uses the stall name, city, crops and practices typed so far
  async function writeBio() {
    if (form.stallName.trim().length < 2) return toast(t('Type the stall / farm name first'), 'warning');
    setWriting(true);
    try {
      const res = await api.post('/ai/farm-bio', { stallName: form.stallName, contactPerson: form.contactPerson, city: form.city, categories: form.categories, tags: form.tags, markets: form.markets, variant });
      setForm((f) => ({ ...f, bio: res.description.slice(0, 1200) }));
      setVariant((v) => v + 1);
      toast(res.source === 'claude' ? t('Written by AI (Claude). Check it and save.') : t('Written by the built-in AI. Check it and save.'), res.source === 'claude' ? 'success' : 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setWriting(false);
    }
    return undefined;
  }

  function next() {
    const problem = validate(step, form);
    setError(problem);
    if (!problem) setStep(step + 1);
  }

  async function submit(e) {
    e.preventDefault();
    for (let s = 0; s < STEPS.length; s += 1) {
      const problem = validate(s, form);
      if (problem) {
        setStep(s);
        setError(problem);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const { confirm: _confirm, latitude, longitude, ...rest } = form;
      await registerFarmer({ ...rest, ...(latitude !== '' && longitude !== '' ? { latitude, longitude } : {}) });
      toast(t('Registration received! An admin will review your stall shortly.'));
      navigate('/farmer', { replace: true });
    } catch (err) {
      setError(err.message);
      // Account problems (e.g. e-mail already used) are fixed on the first step
      if (/e-mail|password|contact|phone/i.test(err.original || err.message)) setStep(0);
    } finally {
      setBusy(false);
    }
  }

  const cities = marketData?.cities || [];
  const markets = [...(marketData?.markets || [])].sort((a, b) => (b.city === form.city) - (a.city === form.city) || a.name.localeCompare(b.name));

  return (
    <AuthLayout wide title={t('Sell your harvest')} highlight={t('before market day.')} text={t('Publish weekly stock and prices, take pre-orders with pickup slots, and see your best sellers. Your stall goes live after a quick admin approval.')}>
      <h1 className="mb-1">{t('Register your stall')}</h1>
      <p className="text-muted-2 mb-3">{t('Three short steps. You can edit everything later from your farmer dashboard.')}</p>

      <div className="wizard-steps" aria-label={t('Sign-up progress')}>
        {STEPS.map((label, i) => (
          <div key={label} className={`wstep ${i === step ? 'current' : ''} ${i < step ? 'done' : ''}`} aria-current={i === step ? 'step' : undefined}>
            <span className="n">{i < step ? <i className="bi bi-check-lg" /> : i + 1}</span>
            <span className="d-none d-sm-inline">{t(label)}</span>
          </div>
        ))}
      </div>

      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-danger small py-2">{error}</div>}

        {step === 0 && (
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label" htmlFor="f-stall">{t('Stall / business name *')}</label>
              <input id="f-stall" name="stallName" className="form-control" value={form.stallName} onChange={change} placeholder={t('e.g. Malir Green Fields')} maxLength={100} autoFocus />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="f-contact">{t('Contact person *')}</label>
              <input id="f-contact" name="contactPerson" className="form-control" value={form.contactPerson} onChange={change} autoComplete="name" />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="f-phone">{t('Contact number *')}</label>
              <PhoneInput id="f-phone" value={form.phone} onChange={change} />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="f-email">{t('E-mail *')}</label>
              <input id="f-email" name="email" type="email" className="form-control" value={form.email} onChange={change} autoComplete="email" />
              <div className="fs-7 text-muted-2 mt-1">{t('You will use this e-mail to log in and receive new pre-order alerts.')}</div>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="f-pass">{t('Password *')}</label>
              <PasswordInput id="f-pass" name="password" value={form.password} onChange={change} autoComplete="new-password" />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="f-confirm">{t('Confirm password *')}</label>
              <PasswordInput id="f-confirm" name="confirm" value={form.confirm} onChange={change} autoComplete="new-password" />
            </div>
            <div className="col-12 fs-7 text-muted-2">{t('At least 8 characters with letters and numbers.')}</div>
          </div>
        )}

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label" htmlFor="f-address">{t('Farm / stall address *')}</label>
              <input id="f-address" name="address" className="form-control" value={form.address} onChange={change} placeholder={t('Village / road / area')} autoFocus />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="f-city">{t('City *')}</label>
              <SearchSelect id="f-city" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} ariaLabel={t('City')} placeholder={t('Choose a city')} options={cities.map((c) => ({ value: c, label: t(c) }))} />
            </div>
            <div className="col-12">
              <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
                <label className="form-label mb-0" htmlFor="f-bio">{t('About your farm')}</label>
                <button type="button" className="btn btn-sm btn-ai" onClick={writeBio} disabled={writing}>
                  {writing ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-stars" aria-hidden="true" />} {variant ? t('Try another') : t('Generate with AI')}
                </button>
              </div>
              <textarea
                id="f-bio"
                name="bio"
                rows={3}
                className="form-control"
                value={form.bio}
                onChange={change}
                maxLength={1200}
                placeholder={t('What do you grow, how do you farm, what makes your produce special?')}
              />
              <div className="fs-7 text-muted-2 text-end">{form.bio.length}/1200</div>
            </div>
            <div className="col-12">
              <span className="form-label d-block">{t('What do you grow / sell? *')}</span>
              <div className="choice-grid" role="group" aria-label={t('Categories')}>
                {(catData?.categories || []).map((c) => {
                  const on = form.categories.includes(c._id);
                  return (
                    <button type="button" key={c._id} className={`choice-tile ${on ? 'active' : ''}`} onClick={() => toggle('categories', c._id)} aria-pressed={on}>
                      <img src={c.icon} alt="" /> {categoryName(c)}
                      <i className="bi bi-check-circle-fill check" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-12">
              <span className="form-label d-block">{t('Farming practices (optional)')}</span>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {[...PRACTICES, ...form.tags.filter((tx) => !PRACTICES.includes(tx))].map((p) => (
                  <button type="button" key={p} className={`filter-chip ${form.tags.includes(p) ? 'active' : ''}`} onClick={() => toggle('tags', p)} aria-pressed={form.tags.includes(p)}>
                    {t(p)}
                  </button>
                ))}
              </div>
              <div className="d-flex gap-2" style={{ maxWidth: 360 }}>
                <input className="form-control form-control-sm" value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder={t('Add your own, e.g. Rain-fed')} maxLength={40} aria-label={t('Custom practice')} />
                <button
                  type="button"
                  className="btn btn-soft btn-sm text-nowrap"
                  disabled={!customTag.trim() || form.tags.length >= 8}
                  onClick={() => {
                    if (!form.tags.includes(customTag.trim())) setForm({ ...form, tags: [...form.tags, customTag.trim()] });
                    setCustomTag('');
                  }}
                >
                  <i className="bi bi-plus" /> {t('Add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="d-grid gap-3">
            <div>
              <span className="form-label d-block">{t('Markets you want to sell at (optional)')}</span>
              <div className="fs-7 text-muted-2 mb-2">{t('You will set exact pickup days and times after logging in.')}</div>
              <div className="d-grid gap-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
                {markets.map((m) => {
                  const on = form.markets.includes(m._id);
                  return (
                    <label key={m._id} className={`market-choice ${on ? 'active' : ''}`}>
                      <input type="checkbox" className="form-check-input mt-0" checked={on} onChange={() => toggle('markets', m._id)} />
                      <img src={m.image} alt="" />
                      <span className="flex-grow-1 min-w-0">
                        <strong className="d-block small">{m.name}</strong>
                        <span className="fs-7 text-muted-2">
                          {t(m.city)} · {time12(m.openTime)} {t('to')} {time12(m.closeTime)}
                        </span>
                      </span>
                      <span className="d-none d-md-inline-flex">
                        <DayDots days={m.operatingDays} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="form-label d-block">{t('Farm / stall location on the map (optional)')}</span>
              <LocationPicker lat={form.latitude} lng={form.longitude} onChange={(p) => setForm((f) => ({ ...f, latitude: p.lat, longitude: p.lng }))} height={220} />
              {form.latitude !== '' && (
                <div className="fs-7 text-muted-2 mt-1">
                  {t('Pinned at')} {form.latitude}, {form.longitude} ·{' '}
                  <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setForm({ ...form, latitude: '', longitude: '' })}>
                    {t('remove pin')}
                  </button>
                </div>
              )}
            </div>
            <div className="soft-panel py-3">
              <div className="info-row">
                <span>{t('Stall')}</span>
                <span>{form.stallName}</span>
              </div>
              <div className="info-row">
                <span>{t('Contact')}</span>
                <span>
                  {form.contactPerson} · {form.phone}
                </span>
              </div>
              <div className="info-row">
                <span>{t('Location')}</span>
                <span>
                  {form.address}, {form.city}
                </span>
              </div>
              <div className="info-row">
                <span>{t('Grows / sells')}</span>
                <span>{listText((catData?.categories || []).filter((c) => form.categories.includes(c._id)).map((c) => categoryName(c)))}</span>
              </div>
            </div>
            <TermsCheckbox
              id="f-terms"
              checked={form.acceptTerms}
              onChange={(v) => {
                setError('');
                setForm((f) => ({ ...f, acceptTerms: v }));
              }}
            >
              {t('I confirm these details are correct and I will keep my stock, prices and pickup times up to date.')}{' '}
            </TermsCheckbox>
          </div>
        )}

        <div className="d-flex gap-2 mt-4">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-white btn-lg"
              onClick={() => {
                setError('');
                setStep(step - 1);
              }}
            >
              <i className="bi bi-arrow-left" /> {t('Back')}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary btn-lg flex-grow-1" onClick={next}>
              {t('Continue')} <i className="bi bi-arrow-right" />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-lg flex-grow-1" disabled={busy}>
              {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send-check" />} {t('Submit for approval')}
            </button>
          )}
        </div>
      </form>
      <p className="mt-4 small text-center">
        {t('Already registered?')} <Link to="/login">{t('Log in')}</Link> {t('· Want to shop instead?')} <Link to="/register">{t('Create a customer account')}</Link>
      </p>
    </AuthLayout>
  );
}
