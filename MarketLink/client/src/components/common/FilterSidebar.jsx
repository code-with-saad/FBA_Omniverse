import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';

/**
 * Filters on phones and tablets: a panel that slides in from the right (from the left in Urdu) over a
 * dimmed page. Escape, the backdrop, the close button and "Show results" close it; "Clear all" resets.
 */
export default function FilterSidebar({ open, ...props }) {
  // The panel is created each time it opens, so it slides in every time
  return open ? createPortal(<Sheet {...props} />, document.body) : null;
}

function Sheet({ onClose, title = 'Filters', onClear, clearDisabled = false, children }) {
  const panel = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className={`filter-sheet ${shown ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={t(title)}>
      <button type="button" className="filter-sheet-backdrop" onClick={onClose} aria-label={t('Close')} tabIndex={-1} />
      <div className="filter-sheet-panel" ref={panel} tabIndex={-1}>
        <div className="filter-sheet-head">
          <h2>
            <i className="bi bi-sliders" aria-hidden="true" /> {t(title)}
          </h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label={t('Close')} />
        </div>
        <div className="filter-sheet-body">{children}</div>
        <div className="filter-sheet-foot">
          {onClear && (
            <button type="button" className="btn btn-white" onClick={onClear} disabled={clearDisabled}>
              {t('Clear all')}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-grow-1" onClick={onClose}>
            {t('Show results')}
          </button>
        </div>
      </div>
    </div>
  );
}
