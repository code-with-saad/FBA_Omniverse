import { useEffect } from 'react';
import { APP_NAME } from '../config';
import { isUrdu, t } from '../i18n';

// Texts in the language in use (English is the default)
const defaultTitle = () => `${APP_NAME} | ${t('Fresh from local farmers markets')}`;
const DEFAULT_KEYWORDS = ['farmers market', 'fresh produce', 'local farmers', 'pre-order vegetables', 'fresh fruit', 'organic food', 'Karachi farmers market', 'Pakistan', 'pickup', 'MarketLink'];

/** Page keywords first, then the site keywords (no duplicates, 20 at most). */
function keywordList(extra = []) {
  const seen = new Set();
  return [...extra, ...DEFAULT_KEYWORDS.map((k) => t(k))]
    .map((k) => String(k || '').trim())
    .filter((k) => k && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()))
    .slice(0, 20)
    .join(', ');
}
const DEFAULT_DESCRIPTION =
  'MarketLink connects local farmers markets with customers: see what each farmer has in stock this week, pre-order fresh produce and pick it up at the market. Pay at the stall.';

// hreflang links: the English page, the Urdu page (?lang=ur) and the default
function setAlternates(href) {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  if (!href) return;
  const urdu = `${href}${href.includes('?') ? '&' : '?'}lang=ur`;
  for (const [lang, url] of [['en-PK', href], ['ur-PK', urdu], ['x-default', href]]) {
    const el = document.createElement('link');
    el.rel = 'alternate';
    el.hreflang = lang;
    el.href = url;
    document.head.appendChild(el);
  }
}

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(data) {
  let el = document.getElementById('ld-page');
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'ld-page';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

const absolute = (url) => (!url ? `${window.location.origin}/brand/og-image.jpg` : /^https?:\/\//.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`);

/**
 * Title, description, social preview (Open Graph / X) and structured data of the current page.
 * The server writes the same tags into the HTML of the first page (server/src/services/seo.js);
 * this hook keeps them right while the visitor browses inside the app.
 */
export default function useSeo({ title, description, image, type = 'website', noindex = false, jsonLd, canonicalPath, keywords } = {}) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';
  const words = keywordList(keywords || []);
  useEffect(() => {
    const fullTitle = title ? `${title} · ${APP_NAME}` : defaultTitle();
    const desc = String(description || t(DEFAULT_DESCRIPTION)).replace(/\s+/g, ' ').trim().slice(0, 170);
    const base = `${window.location.origin}${canonicalPath || window.location.pathname}`;
    // Each language version is its own page for search engines: the Urdu one ends in ?lang=ur
    const url = isUrdu() ? `${base}${base.includes('?') ? '&' : '?'}lang=ur` : base;
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'keywords', words);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1');
    setCanonical(noindex ? null : url);
    setAlternates(noindex ? null : base);
    setMeta('property', 'og:locale', isUrdu() ? 'ur_PK' : 'en_PK');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', absolute(image));
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', absolute(image));
    setJsonLd(ld ? JSON.parse(ld) : null);
  }, [title, description, image, type, noindex, ld, canonicalPath, words]);
}
