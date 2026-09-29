import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ProduceImage from './ProduceImage';
import { productName, t } from '../../i18n';

/** Full-screen photo viewer (opened by clicking the main photo). */
function Lightbox({ photos, index, setIndex, name, onClose }) {
  const count = photos.length;
  const go = (step) => setIndex((i) => (i + step + count) % count);
  const closeRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (count > 1 && e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (count > 1 && e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [count, onClose, setIndex]);
  return createPortal(
    <div className="pd-lightbox" role="dialog" aria-modal="true" aria-label={t('{name} photos', { name })} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="pd-lightbox-close" onClick={onClose} aria-label={t('Close')} ref={closeRef}>
        <i className="bi bi-x-lg" />
      </button>
      <img src={photos[index].url} alt={t('{name}, photo {v2} of {count}', { name, v2: index + 1, count })} />
      {count > 1 && (
        <>
          <button type="button" className="pd-arrow prev" onClick={() => go(-1)} aria-label={t('Previous photo')}>
            <i className="bi bi-chevron-left" />
          </button>
          <button type="button" className="pd-arrow next" onClick={() => go(1)} aria-label={t('Next photo')}>
            <i className="bi bi-chevron-right" />
          </button>
          <span className="pd-count">
            <bdi dir="ltr">
              {index + 1} / {count}
            </bdi>
          </span>
        </>
      )}
    </div>,
    document.body
  );
}


/**
 * Product photos: the main image plus the farmer's extra pictures. Thumbnails, arrows,
 * keyboard arrows and swipe on phones; the credit line follows the photo on screen.
 * With `zoom` the photo is magnified under the mouse, and a click opens it full screen.
 */
export default function ProductGallery({ product, children, zoom = true }) {
  const photos = [{ url: product.image, credit: product.imageCredit }, ...(product.gallery || [])].filter((p) => p.url);
  const [index, setIndex] = useState(0);
  const touch = useRef(null);
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [viewer, setViewer] = useState(false);
  const closeViewer = useCallback(() => setViewer(false), []);
  const count = photos.length;
  const current = photos[Math.min(index, Math.max(count - 1, 0))] || { url: product.image };
  const go = (step) => setIndex((i) => (i + step + count) % count);

  function onKey(e) {
    if (count < 2) return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  }
  function onMouseMove(e) {
    if (!zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }
  function onTouchEnd(e) {
    if (touch.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touch.current = null;
  }

  return (
    <div className="pd-gallery">
      <div
        className={`pd-visual position-relative ${zoom ? 'can-zoom' : ''} ${zooming ? 'is-zooming' : ''}`}
        style={zoom ? { '--zoom-origin': origin } : undefined}
        role={count > 1 ? 'region' : undefined}
        aria-roledescription={count > 1 ? 'carousel' : undefined}
        aria-label={count > 1 ? t('{name} photos', { name: productName(product) }) : undefined}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={onKey}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => zoom && window.matchMedia('(hover: hover)').matches && setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={onMouseMove}
        onClick={(e) => zoom && !e.target.closest('button') && setViewer(true)}
      >
        <ProduceImage key={current.url} src={current.url} alt={count > 1 ? t('{name}, photo {v2} of {count}', { name: productName(product), v2: index + 1, count }) : productName(product)} color={product.category?.color} className="pd-main" />
        {zoom && (
          <button type="button" className="pd-zoom-btn" onClick={() => setViewer(true)} aria-label={t('View the photo full screen')} title={t('Full screen')}>
            <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
          </button>
        )}
        {count > 1 && (
          <>
            <button type="button" className="pd-arrow prev" onClick={() => go(-1)} aria-label={t('Previous photo')}>
              <i className="bi bi-chevron-left" />
            </button>
            <button type="button" className="pd-arrow next" onClick={() => go(1)} aria-label={t('Next photo')}>
              <i className="bi bi-chevron-right" />
            </button>
            <span className="pd-count" aria-live="polite">
              <bdi dir="ltr">
              {index + 1} / {count}
            </bdi>
            </span>
          </>
        )}
        {children}
      </div>
      {count > 1 && (
        <div className="pd-thumbs" role="tablist" aria-label={t('Choose a photo')}>
          {photos.map((p, i) => (
            <button key={p.url} type="button" role="tab" aria-selected={i === index} aria-label={t('Photo {v1}', { v1: i + 1 })} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}>
              <ProduceImage src={p.url} alt="" color={product.category?.color} />
            </button>
          ))}
        </div>
      )}
      {viewer && <Lightbox photos={photos} index={Math.min(index, count - 1)} setIndex={setIndex} name={productName(product)} onClose={closeViewer} />}
    </div>
  );
}
