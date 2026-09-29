import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';

/**
 * A row of cards that slides: arrows on both sides (they fade out at the ends), swipe on phones,
 * one card at a time snaps into place. `children` are the cards.
 */
export default function CardCarousel({ children, ariaLabel, className = '' }) {
  const track = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const update = () => {
      const pos = Math.abs(el.scrollLeft); // negative in RTL
      const maxPos = el.scrollWidth - el.clientWidth;
      setEdge({ start: pos <= 2, end: pos >= maxPos - 2 || maxPos <= 0 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [children]);

  const slide = (dir) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const card = el.querySelector(':scope > *');
    const by = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * Math.max(by, el.clientWidth * 0.5), behavior: 'smooth' });
  };

  return (
    <div className={`card-carousel ${className}`}>
      <button type="button" className="cc-arrow cc-prev" onClick={() => slide(-1)} disabled={edge.start} aria-label={t('Previous')}>
        <i className="bi bi-chevron-left" aria-hidden="true" />
      </button>
      <div className="cc-track" ref={track} role="list" aria-label={ariaLabel}>
        {children}
      </div>
      <button type="button" className="cc-arrow cc-next" onClick={() => slide(1)} disabled={edge.end} aria-label={t('Next')}>
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>
    </div>
  );
}
