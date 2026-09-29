import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import TermsCheckbox from '../../components/legal/TermsCheckbox';
import PasswordInput from '../../components/common/PasswordInput';
import useSeo from '../../hooks/useSeo';
import { t } from '../../i18n';
import PhoneInput from '../../components/common/PhoneInput';

export const PASSWORD_HINT = 'At least 8 characters with letters and numbers';
export const passwordOk = (p) => /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/.test(p);

export default function Register() {
  useSeo({ title: t('Create an account'), description: t('Create a free MarketLink account to pre-order from local farmers, save favourites and get restock alerts.') });
  const { register, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', password: '', confirm: '', acceptTerms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  if (user && !busy) return <Navigate to={homeFor(user)} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!passwordOk(form.password)) return setError(t('Password: at least 8 characters with letters and numbers.'));
    if (form.password !== form.confirm) return setError(t('Passwords do not match.'));
    if (!form.acceptTerms) return setError(t('Please accept the Terms & Conditions to create your account.'));
    setBusy(true);
    try {
      await register(form);
      toast(t('Welcome to MarketLink!'));
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <AuthLayout title={t('Fresh food,')} highlight={t('zero wasted trips.')} text={t('Create a free account to pre-order from local farmers, save favourites, get restock alerts and track your pickups.')}>
      <h1 className="mb-1">{t('Create your account')}</h1>
      <p className="text-muted-2 mb-4">{t('It takes less than a minute.')}</p>
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger small py-2">{error}</div>}
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label" htmlFor="r-name">{t('Full name')}</label>
            <input id="r-name" name="name" className="form-control" required value={form.name} onChange={change} autoComplete="name" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="r-email">{t('E-mail')}</label>
            <input id="r-email" name="email" type="email" className="form-control" required value={form.email} onChange={change} autoComplete="email" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="r-phone">{t('Contact number')}</label>
            <PhoneInput id="r-phone" required value={form.phone} onChange={change} />
          </div>
          <div className="col-md-8">
            <label className="form-label" htmlFor="r-address">{t('Address')}</label>
            <input id="r-address" name="address" className="form-control" required value={form.address} onChange={change} autoComplete="street-address" />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="r-city">{t('City')}</label>
            <input id="r-city" name="city" className="form-control" value={form.city} onChange={change} autoComplete="address-level2" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="r-pass">{t('Password')}</label>
            <PasswordInput id="r-pass" name="password" required value={form.password} onChange={change} autoComplete="new-password" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="r-confirm">{t('Confirm password')}</label>
            <PasswordInput id="r-confirm" name="confirm" required value={form.confirm} onChange={change} autoComplete="new-password" />
          </div>
          <div className="col-12 fs-7 text-muted-2">{t('At least 8 characters with letters and numbers.')}</div>
          <div className="col-12">
            <TermsCheckbox
              id="r-terms"
              checked={form.acceptTerms}
              onChange={(v) => {
                setError('');
                setForm((f) => ({ ...f, acceptTerms: v }));
              }}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-lg w-100 mt-3" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm" />} {t('Create account')}
        </button>
      </form>
      <p className="mt-4 small text-center">
        {t('Already have an account?')} <Link to="/login">{t('Log in')}</Link> {t('· Are you a farmer?')} <Link to="/register/farmer">{t('Register your stall')}</Link>
      </p>
    </AuthLayout>
  );
}
