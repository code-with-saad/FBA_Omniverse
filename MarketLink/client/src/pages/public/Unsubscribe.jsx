import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { t } from '../../i18n';

export default function Unsubscribe() {
  useDocumentTitle(t('Unsubscribe'));
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState({ status: token ? 'working' : 'error', message: token ? '' : t('This unsubscribe link is not complete.') });

  useEffect(() => {
    if (!token) return;
    api
      .post('/newsletter/unsubscribe', { token })
      .then((res) => setState({ status: 'done', message: res.message, email: res.email }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [token]);

  return (
    <div className="container py-5">
      <div className="panel text-center mx-auto" style={{ maxWidth: 520 }}>
        {state.status === 'working' && (
          <>
            <div className="spinner-border text-success mb-3" aria-hidden="true" />
            <p className="mb-0">{t('Unsubscribing…')}</p>
          </>
        )}
        {state.status === 'done' && (
          <>
            <i className="bi bi-envelope-check display-5 text-success" aria-hidden="true" />
            <h1 className="h3 mt-3">{t('You are unsubscribed')}</h1>
            <p className="text-muted-2">
              {state.message}
              {state.email && <span className="d-block small mt-1">{state.email}</span>}
            </p>
            <p className="small mb-4">{t('Changed your mind? You can sign up again at the bottom of any page.')}</p>
            <Link to="/" className="btn btn-primary">
              {t('Back to the home page')}
            </Link>
          </>
        )}
        {state.status === 'error' && (
          <>
            <i className="bi bi-exclamation-circle display-5 text-danger" aria-hidden="true" />
            <h1 className="h3 mt-3">{t('Could not unsubscribe')}</h1>
            <p className="text-muted-2 mb-4">{state.message}</p>
            <Link to="/contact" className="btn btn-white">
              {t('Contact us')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
