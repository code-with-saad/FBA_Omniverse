import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PasswordInput from '../../components/common/PasswordInput';
import useSeo from '../../hooks/useSeo';
import { t } from '../../i18n';

const DEMO = [
  { label: 'Customer', email: 'customer@marketlink.com', password: 'Customer@123' },
  { label: 'Farmer', email: 'farmer@marketlink.com', password: 'Farmer@123' },
  { label: 'Admin', email: 'admin@marketlink.com', password: 'Admin@123' },
];

// After logging in, go back to the page that asked for it only when it belongs to this role's area
function allowedReturn(from, user) {
  if (!from || from === '/login') return null;
  if (from.startsWith('/admin')) return user.role === 'admin' ? from : null;
  if (from.startsWith('/farmer')) return user.role === 'farmer' ? from : null;
  if (from.startsWith('/account') || from.startsWith('/checkout')) return user.role === 'customer' ? from : null;
  return from;
}

export default function Login() {
  useSeo({ title: t('Log in'), description: t('Log in to MarketLink as a customer, farmer or administrator.') });
  const { login, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user && !busy) return <Navigate to={homeFor(user)} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      toast(t('Welcome back, {v1}!', { v1: user.name.split(' ')[0] }));
      // stay "busy" until the page changes, so this page does not redirect to the dashboard first
      navigate(allowedReturn(location.state?.from, user) || homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('Your market,')} highlight={t('one tap away.')} text={t('Log in to pre-order fresh produce, track pickups and manage your favourite farmers, or run your stall if you\'re a farmer.')}>
      <h1 className="mb-1">{t('Welcome back')}</h1>
      <p className="text-muted-2 mb-4">{t('One login for customers, farmers and the MarketLink team.')}</p>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-danger small py-2">{error}</div>}
        <div className="mb-3">
          <label className="form-label" htmlFor="email">{t('E-mail')}</label>
          <input id="email" type="email" className="form-control form-control-lg" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-baseline">
            <label className="form-label" htmlFor="password">{t('Password')}</label>
            <Link to="/forgot-password" className="small">
              {t('Forgot password?')}
            </Link>
          </div>
          <PasswordInput id="password" size="lg" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm" />} {t('Log in')}
        </button>
      </form>
      <div className="demo-box mt-4">
        <div className="fw-bold mb-2">
          <i className="bi bi-magic" /> {t('Demo accounts')}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {DEMO.map((d) => (
            <button key={d.label} type="button" onClick={() => setForm({ email: d.email, password: d.password })}>
              {t('Use {role}', { role: t(d.label) })}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 small text-center">
        {t('New here?')} <Link to="/register">{t('Create a customer account')}</Link> · <Link to="/register/farmer">{t('Register your stall')}</Link>
      </p>
    </AuthLayout>
  );
}
