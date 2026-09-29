import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';

// Phone numbers are compared by their last 10 digits ("0300…" and "+92300…" are the same number)
const normal = (value) => JSON.stringify(value, (key, v) => (typeof v !== 'string' ? v : /phone/i.test(key) ? v.replace(/\D/g, '').slice(-10) : v.trim()));

/** True when the form differs from what was last saved. */
export const isChanged = (form, saved) => normal(form) !== normal(saved);

/**
 * The save row under a form. With unsaved changes it turns amber ("You have unsaved changes"), the save button
 * lights up, a Cancel button puts the saved values back, and it stays at the bottom of the screen. Leaving the page
 * (a link, reload or closing the tab) asks first. Without changes it reads "All changes saved".
 * Pass `form` (the form's id, the button submits it) or `onSave`.
 */
export default function SaveBar({ dirty, busy = false, onCancel, onSave, form, saveLabel, className = '' }) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(null); // the link someone tried to open with unsaved changes
  const [shake, setShake] = useState(0);
  const [wasDirty, setWasDirty] = useState(dirty);
  if (dirty !== wasDirty) {
    setWasDirty(dirty);
    if (!dirty) setLeaving(null);
  }

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    // links inside the app (menu, sidebar, bottom bar) wait until the changes are saved or discarded
    const onClick = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving(url.pathname + url.search + url.hash);
      setShake((n) => n + 1);
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    document.body.classList.add('has-unsaved-bar');
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
      document.body.classList.remove('has-unsaved-bar');
    };
  }, [dirty]);

  return (
    <div key={shake} className={`save-bar ${dirty ? 'is-dirty' : 'is-saved'} ${shake ? 'is-warn' : ''} ${className}`} data-no-guard>
      <span className="save-bar-text" role="status" aria-live="polite">
        <i className={`bi ${dirty ? 'bi-exclamation-circle-fill' : 'bi-check2-circle'}`} aria-hidden="true" />
        {!dirty ? t('All changes saved') : leaving ? t('Careful, you have unsaved changes') : t('You have unsaved changes')}
      </span>
      <div className="save-bar-actions">
        {dirty && leaving && (
          <button
            type="button"
            className="btn btn-white"
            onClick={() => {
              onCancel?.();
              navigate(leaving);
            }}
          >
            {t('Discard and leave')}
          </button>
        )}
        {dirty && !leaving && (
          <button type="button" className="btn btn-white" onClick={onCancel} disabled={busy}>
            {t('Cancel')}
          </button>
        )}
        <button type={onSave ? 'button' : 'submit'} form={onSave ? undefined : form} onClick={onSave} className="btn btn-primary btn-save" disabled={busy || !dirty}>
          {busy && <span className="spinner-border spinner-border-sm" />} {saveLabel || t('Save changes')}
        </button>
      </div>
    </div>
  );
}
