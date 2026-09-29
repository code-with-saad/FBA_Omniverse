import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { api } from '../../api/client';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { passwordOk } from './Register';
import PasswordInput from '../../components/common/PasswordInput';
import { t } from '../../i18n';

export default function ResetPassword() {
  useDocumentTitle(t('Choose a new password'));
  const { token } = useParams();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!passwordOk(form.password)) return setError(t('Password: at least 8 characters with letters and numbers.'));
    if (form.password !== form.confirm) return setError(t('Passwords do not match.'));
    setBusy(true);
    try {
      const res = await api.post('/auth/reset-password', { token, password: form.password });
      setDone(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <AuthLayout title={t('Fresh start,')} highlight={t('fresh password.')} text={t('Choose a new password for your MarketLink account. Use at least 8 characters with letters and numbers.')}>
      <h1 className="mb-1">{t('Choose a new password')}</h1>
      <p className="text-muted-2 mb-4">{t('After saving, log in with your new password.')}</p>
      {done ? (
        <>
          <div className="alert alert-success rounded-4">
            <i className="bi bi-check-circle" /> {done}
          </div>
          <Link to="/login" className="btn btn-primary btn-lg w-100">
            {t('Log in')}
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {error && (
            <div className="alert alert-danger small py-2">
              {error} {/expired|invalid/.test(error) && <Link to="/forgot-password">{t('Request a new link')}</Link>}
            </div>
          )}
          <label className="form-label" htmlFor="rp-pass">{t('New password')}</label>
          <div className="mb-3">
            <PasswordInput id="rp-pass" size="lg" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" autoFocus />
          </div>
          <label className="form-label" htmlFor="rp-confirm">{t('Confirm new password')}</label>
          <div className="mb-2">
            <PasswordInput id="rp-confirm" size="lg" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="fs-7 text-muted-2 mb-3">{t('At least 8 characters with letters and numbers.')}</div>
          <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm" />} {t('Save new password')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
