import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts up from 0 to `value` the first time the number scrolls into view. */
export default function CountUp({ value, duration = 1200 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);
  const animate = Number.isFinite(value) && typeof IntersectionObserver !== 'undefined' && !reducedMotion();

  useEffect(() => {
    if (!animate) return undefined;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(Math.round(value * (1 - (1 - t) ** 3))); // ease-out cubic
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [animate, value, duration]);

  if (!Number.isFinite(value)) return <span>-</span>;
  return <span ref={ref}>{(animate ? shown : value).toLocaleString('en-US')}</span>;
}
