import { useEffect } from 'react';

// Content blocks that fade / rise in the first time they scroll into view.
const SELECTOR = [
  '.section-head',
  '.product-card',
  '.farmer-card',
  '.market-card',
  '.category-tile',
  '.step-card',
  '.quote-card',
  '.value-card',
  '.team-card',
  '.cta-band',
].join(',');

/**
 * Adds a scroll-reveal animation to cards and section headings inside `rootId`.
 * Cards that appear later (after data loads or filters change) are picked up automatically.
 * Nothing is hidden when the browser lacks IntersectionObserver or the user prefers reduced motion.
 */
export default function useScrollReveal(rootId, key) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
    );
    const seen = new WeakSet();
    const scan = () => {
      root.querySelectorAll(SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        // cards in a row that slides sideways (phone rails, the product page carousels) are shown as they are,
        // not faded in one by one: a card off to the side would stay hidden until it scrolled into view
        if (el.closest('.product-rail, .cat-cards, .card-carousel')) return;
        // stagger cards that sit side by side in the same row
        const item = el.parentElement?.className.includes('col') ? el.parentElement : el;
        const index = item.parentElement ? Array.prototype.indexOf.call(item.parentElement.children, item) : 0;
        el.style.setProperty('--reveal-delay', `${(index % 4) * 80}ms`);
        el.classList.add('reveal');
        observer.observe(el);
      });
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [rootId, key]);
}
