import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * New page: start at the top. A link with a #section (e.g. /terms#terms-privacy or /#how-it-works)
 * scrolls to that section once the page has loaded it.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      tries += 1;
      if (el || tries > 40) {
        clearInterval(timer);
        if (el) el.scrollIntoView({ block: 'start' });
        else window.scrollTo(0, 0);
      }
    }, 75);
    return () => clearInterval(timer);
  }, [pathname, hash]);
  return null;
}
