import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';

/**
 * Accessible modal dialog controlled by React state (no Bootstrap JS needed).
 * Unsaved changes: once something was typed or chosen in the dialog (or `dirty` is true), closing it with ×,
 * Escape, the backdrop or a button marked `data-modal-cancel` does not close it. Instead the save button
 * lights up with "Careful, you have unsaved changes" and a "Discard changes" button.
 * `guardChanges={false}` turns this off (dialogs that do not edit anything, like the quick view).
 */
export default function Modal({ open, title, onClose, children, footer, size = '', dirty, guardChanges = true }) {
  const ref = useRef(null);
  const [edited, setEdited] = useState(false);
  const [warn, setWarn] = useState(0); // counts the blocked attempts (restarts the shake)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    // a new opening starts clean
    setWasOpen(open);
    if (open) {
      setEdited(false);
      setWarn(0);
    }
  }

  const isDirty = guardChanges && (dirty ?? edited);
  const requestClose = useCallback(() => {
    if (isDirty) setWarn((n) => n + 1);
    else onClose?.();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    ref.current?.focus({ preventScroll: true });
    // a choice in a SearchSelect counts as a change too
    const el = ref.current;
    const onPick = () => setEdited(true);
    el?.addEventListener('ml-change', onPick);
    return () => {
      document.body.style.overflow = '';
      el?.removeEventListener('ml-change', onPick);
    };
  }, [open]);

  if (!open) return null;
  const markEdited = (e) => {
    if (guardChanges && !e.target.closest?.('[data-no-guard]')) setEdited(true);
  };
  // "Cancel" buttons marked data-modal-cancel ask first too
  const onClickCapture = (e) => {
    if (isDirty && e.target.closest?.('[data-modal-cancel]')) {
      e.preventDefault();
      e.stopPropagation();
      setWarn((n) => n + 1);
    }
  };
  const warning = warn > 0 && isDirty && (
    <div className="unsaved-warn" role="alert" key={warn}>
      <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
      <span className="flex-grow-1">{t('Careful, you have unsaved changes')}</span>
      <button type="button" className="btn btn-sm btn-white" onClick={() => onClose?.()}>
        {t('Discard changes')}
      </button>
      <button type="button" className="btn btn-sm btn-link" onClick={() => setWarn(0)}>
        {t('Keep editing')}
      </button>
    </div>
  );
  return createPortal(
    <div className="ml-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        className={`ml-modal ${size} ${warning ? 'has-unsaved' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onInput={markEdited}
        onChange={markEdited}
        onClickCapture={onClickCapture}
      >
        <div className="ml-modal-header">
          <h5>{title}</h5>
          <button type="button" className="btn-close" onClick={requestClose} aria-label={t('Close')} />
        </div>
        <div className="ml-modal-body">
          {!footer && warning}
          {children}
        </div>
        {footer && (
          <div className="ml-modal-footer-wrap">
            {warning}
            <div className="ml-modal-footer">{footer}</div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmModal({ open, title = t('Are you sure?'), message, confirmLabel = t('Confirm'), danger, busy, confirmDisabled = false, onConfirm, onClose, children }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy && <span className="spinner-border spinner-border-sm" />} {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="mb-2 text-muted-2">{message}</p>}
      {children}
    </Modal>
  );
}
