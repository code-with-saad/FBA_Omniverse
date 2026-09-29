import { useRef } from 'react';
import useFetch from '../../hooks/useFetch';
import { t } from '../../i18n';

// Real produce photos floating around the market photo in the login / sign-up banner.
// x / y are percentages of the scene: the outer ring is spaced evenly along an ellipse,
// the inner items sit "further back" (smaller, softer, less parallax).
const ITEMS = [
  { img: 'vine-tomatoes', x: 50, y: 11, size: 18, r: 8 },
  { img: 'sweet-carrots', x: 65.1, y: 13.6, size: 17, r: -6 },
  { img: 'strawberries', x: 79.2, y: 21.9, size: 15, r: 10 },
  { img: 'broccoli', x: 90.1, y: 38.3, size: 18, r: -6 },
  { img: 'sindhri-mangoes', x: 90.1, y: 61.7, size: 17, r: 8 },
  { img: 'acacia-honey', x: 79.2, y: 78.1, size: 16, r: -4 },
  { img: 'purple-brinjal', x: 65.1, y: 86.4, size: 17, r: -8 },
  { img: 'watermelon', x: 50, y: 89, size: 18, r: 6 },
  { img: 'cherries', x: 34.9, y: 86.4, size: 15, r: -10 },
  { img: 'country-sourdough-loaf', x: 20.8, y: 78.1, size: 17, r: 8 },
  { img: 'sweet-corn', x: 9.9, y: 61.7, size: 17, r: 6 },
  { img: 'kiwi', x: 9.9, y: 38.3, size: 16, r: -12 },
  { img: 'red-apples', x: 20.8, y: 21.9, size: 17, r: 10 },
  { img: 'capsicum-mix', x: 34.9, y: 13.6, size: 16, r: -8 },
  { img: 'green-peas-matar', x: 22, y: 50, size: 10, r: -10, inner: true },
  { img: 'peaches', x: 78, y: 50, size: 10, r: 0, inner: true },
  { img: 'green-chillies', x: 30, y: 28, size: 10, r: 12, inner: true },
  { img: 'desi-eggs', x: 70, y: 28, size: 10, r: 12, inner: true },
  { img: 'lemons', x: 30, y: 72, size: 10, r: -14, inner: true },
  { img: 'button-mushrooms', x: 70, y: 72, size: 10, r: 8, inner: true },
].map((item, i) => ({ ...item, depth: item.inner ? 6 : 14 + (i % 3) * 7 }));

/** Split screen used by the login / register pages. */
export default function AuthLayout({ title, highlight, text, children, variant = '', wide = false }) {
  const { data: stats } = useFetch('/stats');
  const sceneRef = useRef(null);
  const frame = useRef(0);

  // Gentle parallax: the produce drifts with the mouse (items "closer" to the viewer move more).
  function handleMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - box.left) / box.width - 0.5) * 2;
    const my = ((e.clientY - box.top) / box.height - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      sceneRef.current?.style.setProperty('--mx', mx.toFixed(3));
      sceneRef.current?.style.setProperty('--my', my.toFixed(3));
    });
  }
  function handleLeave() {
    cancelAnimationFrame(frame.current);
    sceneRef.current?.style.setProperty('--mx', '0');
    sceneRef.current?.style.setProperty('--my', '0');
  }

  return (
    <div className="auth-wrap">
      <div className={`auth-art ${variant}`} onMouseMove={handleMove} onMouseLeave={handleLeave}>
        <div className="d-flex align-items-center justify-content-between gap-2 position-relative">
          <span className="chip hero-chip">
            <span className="text-lime">●</span> {t('MarketLink')}
          </span>
          <span className="small" style={{ color: 'rgba(255,255,255,.65)' }}>
            {t('Fresh · Local · Pay at pickup')}
          </span>
        </div>

        <div className="float-scene" ref={sceneRef} aria-hidden="true">
          <span className="scene-glow" />
          <span className="scene-orbit" />
          <span className="scene-orbit inner" />
          {[12, 38, 64, 88].map((x, i) => (
            <span key={x} className="sparkle" style={{ left: `${x}%`, top: `${i % 2 ? 58 : 44}%`, '--delay': `${-i * 0.9}s` }} />
          ))}
          <span className="float-item basket" style={{ left: '50%', top: '50%', '--size': 46, '--depth': 8, '--i': 0 }}>
            <img src="/images/hero/welcome.webp" alt="" style={{ '--r': '-4deg', '--dur': '6.5s' }} />
          </span>
          {ITEMS.map((item, i) => (
            <span
              key={item.img}
              className={`float-item ${item.inner ? 'inner' : ''}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, '--size': item.size, '--depth': item.depth, '--i': i + 1 }}
            >
              <img
                src={`/uploads/photos/thumbs/${item.img}.webp`}
                alt=""
                style={{ '--r': `${item.r}deg`, '--dur': `${4.6 + (i % 5) * 0.7}s`, animationDelay: `${-(i % 7) * 0.8}s` }}
              />
            </span>
          ))}
        </div>

        <div className="position-relative">
          <h2>
            {title} <em>{highlight}</em>
          </h2>
          <p className="mt-2 mb-3">{text}</p>
          <div className="d-flex flex-wrap gap-2">
            <span className="chip hero-chip">
              <i className="bi bi-geo-alt" /> {t('{n} markets', { n: stats?.markets ?? '-' })}
            </span>
            <span className="chip hero-chip">
              <i className="bi bi-shop" /> {t('{n} local farmers', { n: stats?.farmers ?? '-' })}
            </span>
            <span className="chip hero-chip">
              <i className="bi bi-basket" /> {t('{n} products this week', { n: stats?.products ?? '-' })}
            </span>
          </div>
        </div>
      </div>
      <div className="auth-form">
        <div className={`auth-card ${wide ? 'wide' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
