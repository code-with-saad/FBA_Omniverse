import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';

/** "Subscribe to our newsletter": the strip just above the footer on every public page. */
export default function NewsletterCta({ source = 'home' }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, done: '', error: '' });
  const id = 'newsletter-email';

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: '', error: '' });
    try {
      const res = await api.post('/newsletter', { email: email || user?.email, name: user?.name, source });
      setState({ busy: false, done: res.message, error: '' });
      setEmail('');
    } catch (err) {
      setState({ busy: false, done: '', error: err.message });
    }
  }

  const form = (
    <form className="nl-form" onSubmit={submit} noValidate={false}>
      <label htmlFor={id} className="visually-hidden">
        {t('Your e-mail address')}
      </label>
      <div className="nl-field">
        <i className="bi bi-envelope" aria-hidden="true" />
        <input id={id} type="email" required={!user} placeholder={user?.email || t('Your e-mail address')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} />
        <button type="submit" className="btn btn-lime" disabled={state.busy}>
          {state.busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : t('Subscribe')}
        </button>
      </div>
      <div aria-live="polite" className="nl-status">
        {state.done && (
          <span className="nl-ok">
            <i className="bi bi-check-circle-fill" aria-hidden="true" /> {state.done}
          </span>
        )}
        {state.error && (
          <span className="nl-error">
            <i className="bi bi-exclamation-circle" aria-hidden="true" /> {state.error}
          </span>
        )}
      </div>
    </form>
  );

  return (
    <section className="nl-strip-wrap" aria-labelledby="nl-title">
      <div className="container">
        <div className="nl-strip">
          <img className="nl-strip-photo" src="/images/banners/fruit-basket.webp" alt={t('A basket of fresh fruit')} loading="lazy" width="640" height="640" />
          <div className="nl-strip-copy">
            <span className="eyebrow">{t('Newsletter')}</span>
            <h2 id="nl-title">{t('Get the weekly harvest list in your inbox')}</h2>
            <p className="mb-0">{t('Once a week: what the markets will have, seasonal picks and new farmers. Unsubscribe with one click.')}</p>
          </div>
          <div className="nl-strip-form">{form}</div>
        </div>
      </div>
    </section>
  );
}
