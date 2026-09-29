const HIRES = new Set([
  '/images/hero/welcome.webp',
  '/images/hero/summer.webp',
  '/images/hero/pickup.webp',
  '/images/hero/farmers.webp',
  '/images/hero/cta-farmer.webp',
  '/images/banners/deal-vegetables.webp',
]);

export const srcSetFor = (src) => (HIRES.has(src) ? `${src} 1024w, ${src.replace(/\.webp$/, '-1920.webp')} 1920w` : undefined);
