import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';

const ToastContext = createContext(null);
let nextId = 1;

// Four kinds of message: what happened (success), what went wrong (error), what to look out for
// (warning) and plain information (info). Errors and warnings stay a little longer.
const KINDS = {
  success: { icon: 'bi-check-circle-fill', title: 'Done', duration: 4000 },
  error: { icon: 'bi-x-circle-fill', title: 'Something went wrong', duration: 6500 },
  warning: { icon: 'bi-exclamation-triangle-fill', title: 'Please note', duration: 5500 },
  info: { icon: 'bi-info-circle-fill', title: 'Good to know', duration: 4500 },
};

function Toast({ toast, onDismiss }) {
  const kind = KINDS[toast.type] || KINDS.success;
  const { id } = toast;
  const onClose = useCallback(() => onDismiss(id), [onDismiss, id]);
  const [paused, setPaused] = useState(false);
  const left = useRef(toast.duration || kind.duration);
  const started = useRef(0);

  // Closes itself when its time is up; the time stops while the pointer is on it
  useEffect(() => {
    if (paused) return undefined;
    started.current = Date.now();
    const timer = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started.current;
    };
  }, [paused, onClose]);

  return (
    <div
      className={`ml-toast is-${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ '--toast-time': `${toast.duration || kind.duration}ms` }}
    >
      <span className="ml-toast-icon" aria-hidden="true">
        <i className={`bi ${kind.icon}`} />
      </span>
      <div className="ml-toast-body">
        <strong>{toast.title ? t(toast.title) : t(kind.title)}</strong>
        <span>{t(toast.message)}</span>
        {toast.action && (
          <button
            type="button"
            className="ml-toast-action"
            onClick={() => {
              toast.action.onClick();
              onClose();
            }}
          >
            {t(toast.action.label)}
          </button>
        )}
      </div>
      <button type="button" className="ml-toast-close" onClick={onClose} aria-label={t('Dismiss')}>
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
      <span className={`ml-toast-time ${paused ? 'is-paused' : ''}`} aria-hidden="true" />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((tx) => tx.id !== id)), []);

  /** toast(message, type = 'success', { title, duration, action: { label, onClick } }) */
  const toast = useCallback((message, type = 'success', options = {}) => {
    if (!message) return;
    const id = nextId++;
    const kind = KINDS[type] ? type : 'success';
    setToasts((list) => [...list.filter((tx) => tx.message !== message).slice(-2), { id, message, type: kind, ...options }]);
  }, []);

  const value = useMemo(
    () => ({
      toast,
      success: (m, o) => toast(m, 'success', o),
      error: (m, o) => toast(m, 'error', o),
      warning: (m, o) => toast(m, 'warning', o),
      info: (m, o) => toast(m, 'info', o),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((tx) => (
          <Toast key={tx.id} toast={tx} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
