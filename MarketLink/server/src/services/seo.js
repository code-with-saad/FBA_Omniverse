import fs from 'node:fs';
import path from 'node:path';
import { Category, Farmer, Market, Product, Review } from '../models/index.js';
import { CLIENT_DIST } from '../utils/paths.js';
import env from '../config/env.js';
import { publicFaqs } from '../controllers/faqController.js';
import { DAY, HOW_IT_WORKS, SITE_SUMMARY, esc, pageBody } from './aeo.js';
import { productJsonLd } from './productSchema.js';
import { DEFAULT_DESCRIPTION_UR, DEFAULT_TITLE_UR, STATIC_PAGES_UR, categoryPageUr, farmerUr, marketUr, pageLang, productUr } from './urdu.js';

/**
 * Search engines, AI assistants and link previews (WhatsApp, Facebook, X ...) read the HTML before
 * any JavaScript runs. The server therefore writes the right title, description, Open Graph tags,
 * JSON-LD structured data and the page's main text (with its links) into index.html for every
 * public page; the React app updates the head tags while browsing and replaces the text.
 */

const SITE = 'MarketLink';
const DEFAULT_TITLE = 'MarketLink | Fresh from local farmers markets';
const DEFAULT_KEYWORDS = ['farmers market', 'fresh produce', 'local farmers', 'pre-order vegetables', 'fresh fruit', 'organic food', 'Karachi farmers market', 'Pakistan', 'pickup', 'MarketLink'];
const DEFAULT_DESCRIPTION = 'MarketLink connects local farmers markets with customers: see what each farmer has in stock this week, pre-order fresh produce and pick it up at the market. Pay at the stall.';
const OG_IMAGE = '/brand/og-image.jpg'; // 1200 x 630 share picture for pages without their own photo

// Pages that are only useful after logging in (or are personal) are kept out of search results
const PRIVATE = /^\/(account|farmer(\/|$)|admin|checkout|cart|reset-password|forgot-password|unsubscribe)/;
// Every address the React app has (client/src/App.jsx). Anything else is answered with a 404 page,
// so search engines do not index made-up addresses as copies of the home page. The signed-in areas
// show their own "page not found" inside.
const APP_PAGES = /^\/($|about$|terms$|faq$|contact$|map$|cart$|login$|register(\/farmer)?$|forgot-password$|reset-password\/[^/]+$|unsubscribe$|checkout(\/[A-Za-z0-9+-]+)?$|products$|best-sellers$|categories$|credits$|markets$|farmers$|account(\/|$)|farmer(\/|$)|admin(\/|$))/;

const STATIC_PAGES = {
  '/': { title: null, description: DEFAULT_DESCRIPTION },
  '/products': { title: 'Shop fresh produce', description: 'Browse this week’s vegetables, fruit, dairy, honey, baked goods and more from local farmers. Filter by market, day, city and price, then pre-order for pickup.', keywords: ['buy fresh vegetables', 'buy fruit online', 'dairy', 'honey', 'bakery', 'farm produce'] },
  '/markets': { title: 'Farmers markets', description: 'Find farmers markets near you: opening days and times, location on the map and the farmers selling at each market.', keywords: ['farmers markets near me', 'market timings', 'weekly bazaar'] },
  '/farmers': { title: 'Local farmers', description: 'Meet the local farmers and stalls on MarketLink: what they grow, where they sell, ratings and their weekly stock.', keywords: ['local growers', 'farm stalls', 'organic farms'] },
  '/map': { title: 'Market map', description: 'All farmers markets and farmer stalls on one map, with directions and opening days.' },
  '/about': { title: 'About MarketLink', description: 'MarketLink brings local farmers markets online so families can reserve fresh food before market day and farmers waste less. Built by Team Omniverse.' },
  '/categories': { title: 'Shop by category', description: 'Vegetables, fruit, dairy, bakery, honey, grains and more from local farmers. Pick a category to see this week\'s produce.', keywords: ['vegetables', 'fruit', 'dairy', 'farm produce categories'] },
  '/credits': { title: 'Photo credits', description: 'The photographers of the stock photos used on MarketLink and their licences.', keywords: ['photo credits'] },
  '/best-sellers': { title: 'Best sellers', description: 'The products customers pre-order most at the farmers markets: the top 5, top 10 and the best sellers at every market.', keywords: ['best selling vegetables', 'popular fruit', 'top products farmers market'] },
  '/faq': { title: 'Frequently asked questions', description: 'Answers about pre-ordering from local farmers on MarketLink: how ordering works, pickup at the market, paying the farmer in cash, changing an order and selling as a farmer.', keywords: ['MarketLink FAQ', 'how to pre-order vegetables', 'farmers market pickup', 'pay at pickup', 'sell produce online Pakistan'] },
  '/contact': { title: 'Contact us', description: 'Questions about an order, joining as a farmer or partnering with a market? Contact the MarketLink team.' },
  '/terms': { title: 'Terms & Conditions', description: 'The terms for using MarketLink as a customer or farmer, and how your personal data is handled.' },
  '/login': { title: 'Log in', description: 'Log in to MarketLink as a customer, farmer or administrator.' },
  '/register': { title: 'Create an account', description: 'Create a free MarketLink account to pre-order from local farmers, save favourites and get restock alerts.' },
  '/register/farmer': { title: 'Sell with MarketLink', description: 'Register your farm stall on MarketLink: list your weekly stock, take pre-orders and set your pickup times.' },
};

const clip = (s, n = 160) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t;
};

/**
 * Meta description of a product page: the farmer's own SEO description, else the product description.
 * A short description alone ("Cleaned rajma beans.") makes a thin search result, so the seller, price and
 * how to buy are added to it.
 */
export function productDescription(p) {
  if (p.metaDescription) return clip(p.metaDescription);
  const howToBuy = 'Pre-order on MarketLink and pay at the stall when you pick it up.';
  const text = String(p.description || '').replace(/\s+/g, ' ').trim();
  if (!text) return clip(`${p.name} (${p.category?.name}) from ${p.farmer?.stallName}. ${howToBuy}`);
  if (text.length >= 70) return clip(text);
  return clip(`${/[.!?]$/.test(text) ? text : `${text}.`} ${p.name} from ${p.farmer?.stallName}, Rs ${p.price} per ${p.unit}. ${howToBuy}`);
}

/** The site's own address, e.g. https://marketlink.onrender.com (APP_URL, or the address of this request). */
export function siteOrigin(req) {
  if (process.env.APP_URL) return env.appUrl;
  return `${req.protocol}://${req.get('host')}`;
}

let template = null;
let templateTime = 0;
function readTemplate() {
  const file = path.join(CLIENT_DIST, 'index.html');
  const time = fs.statSync(file).mtimeMs;
  if (!template || time !== templateTime) {
    template = fs.readFileSync(file, 'utf8');
    templateTime = time;
  }
  return template;
}

const absolute = (origin, url) => (!url ? `${origin}${OG_IMAGE}` : /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`);
const rating = (x) => (x.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: x.ratingAvg, reviewCount: x.ratingCount, bestRating: 5, worstRating: 1 } } : {});

/** BreadcrumbList from the home page down: [[name, path], ...]. */
function breadcrumbs(origin, trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'], ...trail].map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${origin}${p}` })),
  };
}

/** Several structured-data objects in one script. */
const graph = (...items) => ({ '@context': 'https://schema.org', '@graph': items.filter(Boolean) });

const faqPage = (faqs) =>
  faqs.length
    ? {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer.replace(/\n{2,}/g, '\n') } })),
      }
    : null;

async function productMeta(slug, origin) {
  const product = await Product.findOne({ slug: slug.toLowerCase(), isRemoved: false, farmerActive: true })
    .populate('category', 'name nameUr slug')
    .populate('farmer', 'stallName slug city tags pickupWindows markets orderCutoffHours')
    .lean();
  if (!product) return null;
  const [reviews, markets] = await Promise.all([
    Review.find({ product: product._id, isRemoved: false, comment: { $exists: true, $ne: '' } }).populate('customer', 'name').sort({ createdAt: -1 }).limit(3).lean(),
    Market.find({ _id: { $in: product.farmer?.markets || [] }, isActive: true }).select('name slug city').lean(),
  ]);
  const images = [product.image, ...(product.gallery || []).map((g) => g.url)].filter(Boolean).map((u) => absolute(origin, u));
  return {
    // The farmer's own SEO title, description and keywords win; otherwise they are built from the product
    title: product.metaTitle || `${product.name}, Rs ${product.price} per ${product.unit} from ${product.farmer?.stallName}`,
    description: productDescription(product),
    keywords: [...(product.keywords || []), product.name, product.category?.name, product.farmer?.stallName, product.farmer?.city && `${product.category?.name} in ${product.farmer.city}`],
    image: images[0] || absolute(origin),
    imageAlt: product.name,
    ur: productUr(product),
    type: 'product',
    jsonLd: graph(
      productJsonLd(product, origin, { reviews }),
      breadcrumbs(origin, [
        ['Shop', '/products'],
        [product.category?.name || 'Products', `/products?category=${product.category?.slug || ''}`],
        [product.name, `/products/${product.slug}`],
      ])
    ),
    body: pageBody.product({ product, markets, reviews }),
  };
}

async function farmerMeta(slug, origin) {
  const farmer = await Farmer.findOne({ slug: slug.toLowerCase(), isActive: true }).lean();
  if (!farmer) return null;
  const [products, markets] = await Promise.all([
    Product.find({ ...Product.publicFilter(), farmer: farmer._id }).populate('category', 'name slug').select('name slug price unit status quantityAvailable category').sort({ name: 1 }).limit(60).lean(),
    Market.find({ _id: { $in: farmer.markets || [] }, isActive: true }).select('name slug city').lean(),
  ]);
  const url = `${origin}/farmers/${farmer.slug}`;
  return {
    title: `${farmer.stallName}, local farmer${farmer.city ? ` in ${farmer.city}` : ''}`,
    keywords: [farmer.stallName, ...(farmer.tags || []), farmer.city && `farmer in ${farmer.city}`],
    description: clip(farmer.bio || `${farmer.stallName} sells fresh produce on MarketLink. See this week's stock, pickup times and reviews.`),
    image: absolute(origin, farmer.coverImage || farmer.logo),
    imageAlt: farmer.stallName,
    ur: farmerUr(farmer),
    type: 'profile',
    jsonLd: graph(
      {
        '@type': 'LocalBusiness',
        '@id': `${url}#business`,
        name: farmer.stallName,
        description: farmer.bio || undefined,
        image: [farmer.coverImage, farmer.logo].filter(Boolean).map((u) => absolute(origin, u)),
        logo: farmer.logo ? absolute(origin, farmer.logo) : undefined,
        url,
        telephone: farmer.phone || undefined,
        email: farmer.email || undefined,
        priceRange: '₨',
        paymentAccepted: 'Cash',
        currenciesAccepted: 'PKR',
        address: { '@type': 'PostalAddress', streetAddress: farmer.address, addressLocality: farmer.city || undefined, addressCountry: 'PK' },
        ...(farmer.latitude ? { geo: { '@type': 'GeoCoordinates', latitude: farmer.latitude, longitude: farmer.longitude } } : {}),
        knowsAbout: farmer.tags?.length ? farmer.tags : undefined,
        makesOffer: products.slice(0, 20).map((p) => ({ '@type': 'Offer', price: p.price, priceCurrency: 'PKR', itemOffered: { '@type': 'Product', name: p.name, url: `${origin}/products/${p.slug}` } })),
        ...rating(farmer),
      },
      breadcrumbs(origin, [
        ['Farmers', '/farmers'],
        [farmer.stallName, `/farmers/${farmer.slug}`],
      ])
    ),
    body: pageBody.farmer({ farmer, products, markets }),
  };
}

async function marketMeta(slug, origin) {
  const market = await Market.findOne({ slug: slug.toLowerCase(), isActive: true }).lean();
  if (!market) return null;
  const farmers = await Farmer.find({ markets: market._id, isActive: true }).select('stallName slug city bio').sort({ stallName: 1 }).lean();
  const days = (market.operatingDays || []).map((d) => DAY[d]);
  const url = `${origin}/markets/${market.slug}`;
  return {
    title: `${market.name}, farmers market${market.city ? ` in ${market.city}` : ''}`,
    description: clip(market.description || `${market.name}, ${market.address}. Open ${days.join(', ')}, ${market.openTime} to ${market.closeTime}. See the farmers and pre-order on MarketLink.`),
    keywords: [market.name, market.city && `farmers market ${market.city}`, 'weekly market'],
    image: absolute(origin, market.image),
    imageAlt: market.name,
    ur: marketUr(market),
    type: 'website',
    jsonLd: graph(
      {
        '@type': ['Place', 'LocalBusiness'],
        '@id': `${url}#market`,
        name: market.name,
        description: market.description || undefined,
        image: absolute(origin, market.image),
        url,
        address: { '@type': 'PostalAddress', streetAddress: market.address, addressLocality: market.city || undefined, addressCountry: 'PK' },
        geo: { '@type': 'GeoCoordinates', latitude: market.latitude, longitude: market.longitude },
        hasMap: market.mapLink || `https://www.openstreetmap.org/?mlat=${market.latitude}&mlon=${market.longitude}#map=17/${market.latitude}/${market.longitude}`,
        openingHoursSpecification: days.length ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: market.openTime, closes: market.closeTime }] : undefined,
        containsPlace: farmers.map((f) => ({ '@type': 'LocalBusiness', name: f.stallName, url: `${origin}/farmers/${f.slug}` })),
      },
      breadcrumbs(origin, [
        ['Markets', '/markets'],
        [market.name, `/markets/${market.slug}`],
      ])
    ),
    body: pageBody.market({ market, farmers }),
  };
}

const itemList = (origin, name, items) => ({
  '@type': 'ItemList',
  name,
  numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: `${origin}${it.path}` })),
});

/** Structured data and page text for the listing and information pages. */
async function staticExtras(pathname, req, origin, meta) {
  switch (pathname) {
    case '/': {
      const [faqs, categories, markets] = await Promise.all([publicFaqs({ homeOnly: true }), Category.find({ isActive: { $ne: false } }).select('name slug').sort({ sortOrder: 1, name: 1 }).lean(), Market.find({ isActive: true }).select('name slug city operatingDays openTime closeTime').sort({ city: 1, name: 1 }).lean()]);
      return {
        jsonLd: graph(
          faqPage(faqs),
          {
            '@type': 'HowTo',
            name: 'How to pre-order fresh produce on MarketLink',
            description: SITE_SUMMARY,
            totalTime: 'PT5M',
            estimatedCost: { '@type': 'MonetaryAmount', currency: 'PKR', value: 0 },
            step: HOW_IT_WORKS.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })),
          },
          itemList(origin, 'Farmers markets on MarketLink', markets.map((m) => ({ name: m.name, path: `/markets/${m.slug}` }))),
          {
            '@type': 'VideoObject',
            name: 'How MarketLink works',
            description: 'A 30-second tour: find fresh produce, pre-order, pick a pickup time and pay the farmer at the market.',
            thumbnailUrl: `${origin}/media/how-it-works.jpg`,
            contentUrl: `${origin}/media/how-it-works.mp4`,
            uploadDate: '2026-09-25',
            duration: 'PT29S',
            inLanguage: 'en',
          }
        ),
        body: pageBody.home({ faqs, categories, markets }),
      };
    }
    case '/faq': {
      const faqs = await publicFaqs();
      return { jsonLd: graph(faqPage(faqs), breadcrumbs(origin, [['FAQs', '/faq']])), body: pageBody.faq({ faqs }) };
    }
    case '/products': {
      const category = req.query.category ? await Category.findOne({ slug: String(req.query.category).toLowerCase() }).select('name nameUr slug description').lean().catch(() => null) : null;
      const filter = { ...Product.publicFilter(), ...(category ? { category: category._id } : {}) };
      const [products, categories] = await Promise.all([
        Product.find(filter).populate('farmer', 'stallName slug').populate('category', 'name slug').select('name slug price unit status quantityAvailable farmer category').sort({ totalSold: -1 }).limit(48).lean(),
        Category.find({ isActive: { $ne: false } }).select('name slug').sort({ sortOrder: 1, name: 1 }).lean(),
      ]);
      const listName = category ? `${category.name} from local farmers` : 'Fresh produce this week';
      const extra = category
        ? { ur: categoryPageUr(category), title: `${category.name} from local farmers`, description: clip(category.description || `Fresh ${category.name.toLowerCase()} from local farmers. Pre-order and pick up at the market.`), keywords: [`fresh ${category.name.toLowerCase()}`, `buy ${category.name.toLowerCase()}`] }
        : {};
      const trail = [['Shop', '/products'], ...(category ? [[category.name, `/products?category=${category.slug}`]] : [])];
      return {
        ...extra,
        jsonLd: graph(itemList(origin, listName, products.map((p) => ({ name: p.name, path: `/products/${p.slug}` }))), breadcrumbs(origin, trail)),
        body: pageBody.products({ products, categories, category, title: extra.title || meta.title, description: extra.description || meta.description }),
      };
    }
    case '/markets':
    case '/map': {
      const markets = await Market.find({ isActive: true }).sort({ city: 1, name: 1 }).lean();
      return {
        jsonLd: graph(itemList(origin, 'Farmers markets on MarketLink', markets.map((m) => ({ name: m.name, path: `/markets/${m.slug}` }))), breadcrumbs(origin, [[meta.title, pathname]])),
        body: pageBody.markets({ markets, title: meta.title, description: meta.description }),
      };
    }
    case '/farmers': {
      const farmers = await Farmer.find({ isActive: true }).select('stallName slug city bio tags').sort({ stallName: 1 }).lean();
      return {
        jsonLd: graph(itemList(origin, 'Local farmers on MarketLink', farmers.map((f) => ({ name: f.stallName, path: `/farmers/${f.slug}` }))), breadcrumbs(origin, [['Farmers', '/farmers']])),
        body: pageBody.farmers({ farmers, title: meta.title, description: meta.description }),
      };
    }
    default:
      return {
        jsonLd: pathname === '/login' || pathname.startsWith('/register') ? undefined : graph(breadcrumbs(origin, [[meta.title, pathname]])),
        body: pageBody.info({ pathname, title: meta.title, description: meta.description }),
      };
  }
}

/** Title, description, image, structured data and page text for a URL. `notFound` for unknown addresses, products, farmers or markets. */
export async function pageMeta(req) {
  const origin = siteOrigin(req);
  const lang = pageLang(req);
  const pathname = decodeURIComponent(req.path).replace(/\/+$/, '') || '/';
  const notFound = () => ({ origin, pathname, lang, notFound: true, title: lang === 'ur' ? 'صفحہ نہیں ملا' : 'Page not found', description: lang === 'ur' ? DEFAULT_DESCRIPTION_UR : DEFAULT_DESCRIPTION, noindex: true });
  const detail = pathname.match(/^\/(products|farmers|markets)\/([^/]+)$/);
  let meta = null;
  if (detail) {
    const [, kind, slug] = detail;
    meta = await (kind === 'products' ? productMeta : kind === 'farmers' ? farmerMeta : marketMeta)(slug, origin).catch(() => null);
    if (!meta) return notFound();
  } else if (STATIC_PAGES[pathname]) {
    meta = { ...STATIC_PAGES[pathname] };
    Object.assign(meta, await staticExtras(pathname, req, origin, meta).catch(() => ({})));
  } else if (APP_PAGES.test(pathname)) {
    meta = { title: null, description: DEFAULT_DESCRIPTION, noindex: PRIVATE.test(pathname) };
  } else {
    return notFound();
  }
  if (PRIVATE.test(pathname)) meta.noindex = true;
  // Urdu: the page's own Urdu title and description (the structured data and page text stay English)
  if (lang === 'ur') {
    const ur = meta.ur || STATIC_PAGES_UR[pathname] || {};
    meta.title = ur.title !== undefined ? ur.title : null;
    meta.description = ur.description || DEFAULT_DESCRIPTION_UR;
    if (ur.imageAlt) meta.imageAlt = ur.imageAlt;
  }
  // Filtered and paged shop pages point search engines to the main page (or the category page)
  const canonicalPath = pathname === '/products' && req.query.category ? `/products?category=${encodeURIComponent(String(req.query.category).toLowerCase())}` : pathname;
  const canonical = `${origin}${canonicalPath === '/' ? '/' : canonicalPath}`;
  // Each language is its own address for search engines: the Urdu page ends in ?lang=ur
  const urduUrl = `${canonical}${canonical.includes('?') ? '&' : '?'}lang=ur`;
  return { origin, pathname, lang, canonical: lang === 'ur' ? urduUrl : canonical, alternates: { en: canonical, ur: urduUrl }, ...meta };
}

// Who runs the site and the site search, on every page (absolute URLs as search engines expect)
const SOCIAL = ['https://www.facebook.com/marketlinkpk', 'https://www.instagram.com/marketlinkpk', 'https://x.com/marketlinkpk', 'https://www.youtube.com/@marketlinkpk', 'https://www.linkedin.com/company/marketlinkpk'];
function siteJsonLd(origin) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: SITE,
        alternateName: 'MarketLink',
        url: `${origin}/`,
        logo: { '@type': 'ImageObject', url: `${origin}/brand/icon-512.png`, width: 512, height: 512 },
        image: `${origin}${OG_IMAGE}`,
        description: SITE_SUMMARY,
        slogan: 'Fresh from local farmers markets',
        email: 'hello@marketlink.pk',
        telephone: '+92 21 3456 7890',
        address: { '@type': 'PostalAddress', streetAddress: 'Aptech Learning Centre, F.B. Area', addressLocality: 'Karachi', addressRegion: 'Sindh', addressCountry: 'PK' },
        areaServed: ['Karachi', 'Lahore', 'Islamabad'].map((name) => ({ '@type': 'City', name })),
        contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'hello@marketlink.pk', telephone: '+92 21 3456 7890', availableLanguage: ['English', 'Urdu'], areaServed: 'PK' }],
        knowsAbout: ['farmers markets', 'fresh produce', 'local food', 'pre-orders', 'Pakistani seasonal fruit and vegetables'],
        sameAs: SOCIAL,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: SITE,
        url: `${origin}/`,
        inLanguage: ['en-PK', 'ur-PK'],
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': `${origin}/#organization` },
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${origin}/products?search={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      },
    ],
  };
}

/** Page keywords first, then the site keywords (no duplicates, 20 at most). */
export function keywordList(extra = []) {
  const seen = new Set();
  const out = [];
  for (const k of [...(extra || []), ...DEFAULT_KEYWORDS]) {
    const word = String(k || '').trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    out.push(word);
  }
  return out.slice(0, 20).join(', ');
}

const ldScript = (id, data) => `<script type="application/ld+json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function headTags(meta) {
  const ur = meta.lang === 'ur';
  const title = meta.title ? `${meta.title} · ${SITE}` : ur ? DEFAULT_TITLE_UR : DEFAULT_TITLE;
  const description = meta.description || (ur ? DEFAULT_DESCRIPTION_UR : DEFAULT_DESCRIPTION);
  const image = meta.image || `${meta.origin}${OG_IMAGE}`;
  const brandImage = image.endsWith(OG_IMAGE);
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="keywords" content="${esc(keywordList(meta.keywords))}" />`,
    `<meta name="robots" content="${meta.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`,
    meta.noindex ? '' : `<link rel="canonical" href="${esc(meta.canonical)}" />`,
    meta.noindex ? '' : `<link rel="alternate" hreflang="en-PK" href="${esc(meta.alternates?.en || meta.canonical)}" />`,
    meta.noindex || !meta.alternates ? '' : `<link rel="alternate" hreflang="ur-PK" href="${esc(meta.alternates.ur)}" />`,
    meta.noindex || !meta.alternates ? '' : `<link rel="alternate" hreflang="x-default" href="${esc(meta.alternates.en)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:type" content="${esc(meta.type || 'website')}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:alt" content="${esc(meta.imageAlt || 'MarketLink: fresh from local farmers markets')}" />`,
    brandImage ? '<meta property="og:image:width" content="1200" />' : '',
    brandImage ? '<meta property="og:image:height" content="630" />' : '',
    `<meta property="og:url" content="${esc(meta.canonical || meta.origin + meta.pathname)}" />`,
    `<meta property="og:locale" content="${ur ? 'ur_PK' : 'en_PK'}" />`,
    `<meta property="og:locale:alternate" content="${ur ? 'en_PK' : 'ur_PK'}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ldScript('ld-site', siteJsonLd(meta.origin)),
    meta.jsonLd ? ldScript('ld-page', meta.jsonLd) : '',
  ];
  return tags.filter(Boolean).join('\n    ');
}

/** Sends index.html with the page's own head tags and text (SPA fallback for every non-API URL). */
export async function sendPage(req, res) {
  const meta = await pageMeta(req);
  let html = readTemplate().replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n    ${headTags(meta)}\n    <!--seo:end-->`);
  // Urdu pages are right to left from the first paint; the page text written below stays English
  if (meta.lang === 'ur') html = html.replace(/<html lang="en"[^>]*>/, '<html lang="ur" dir="rtl">').replace('title="MarketLink for AI assistants"', 'title="اے آئی اسسٹنٹس کے لیے MarketLink"');
  const textLang = meta.lang === 'ur' ? ' lang="en" dir="ltr"' : '';
  if (meta.body && !meta.noindex) html = html.replace(/<!--prerender:start-->[\s\S]*?<!--prerender:end-->/, `<!--prerender:start--><div class="prerender" id="prerender"${textLang}>${meta.body}</div><!--prerender:end-->`);
  res.status(meta.notFound ? 404 : 200).set('Cache-Control', 'no-cache').set('Vary', 'Cookie').type('html').send(html);
}

let sitemapCache = { at: 0, origin: '', xml: '' };

/** sitemap.xml text: every public page, product, farmer and market with their photos. */
export async function buildSitemap(origin) {
  const [products, farmers, markets, categories] = await Promise.all([
    Product.find(Product.publicFilter()).select('slug name image gallery updatedAt').lean(),
    Farmer.find({ isActive: true }).select('slug stallName logo coverImage updatedAt').lean(),
    Market.find({ isActive: true }).select('slug name image updatedAt').lean(),
    Category.find({ isActive: { $ne: false } }).select('slug updatedAt').lean(),
  ]);
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
  const photos = (title, ...urls) => urls.flat().filter(Boolean).map((u) => ({ loc: absolute(origin, u), title }));
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily', images: [{ loc: `${origin}${OG_IMAGE}`, title: 'MarketLink' }] },
    { loc: '/products', priority: '0.9', changefreq: 'daily' },
    { loc: '/markets', priority: '0.8', changefreq: 'weekly' },
    { loc: '/farmers', priority: '0.8', changefreq: 'weekly' },
    { loc: '/best-sellers', priority: '0.7', changefreq: 'weekly' },
    { loc: '/categories', priority: '0.7', changefreq: 'weekly' },
    { loc: '/credits', priority: '0.2', changefreq: 'monthly' },
    { loc: '/faq', priority: '0.7', changefreq: 'monthly' },
    { loc: '/map', priority: '0.6', changefreq: 'weekly' },
    { loc: '/about', priority: '0.5', changefreq: 'monthly' },
    { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
    { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
    { loc: '/register/farmer', priority: '0.5', changefreq: 'monthly' },
    ...categories.map((c) => ({ loc: `/products?category=${c.slug}`, lastmod: day(c.updatedAt), priority: '0.7', changefreq: 'daily' })),
    ...products.map((p) => ({ loc: `/products/${p.slug}`, lastmod: day(p.updatedAt), priority: '0.8', changefreq: 'daily', images: photos(p.name, p.image, (p.gallery || []).map((g) => g.url)) })),
    ...farmers.map((f) => ({ loc: `/farmers/${f.slug}`, lastmod: day(f.updatedAt), priority: '0.7', changefreq: 'weekly', images: photos(f.stallName, f.coverImage, f.logo) })),
    ...markets.map((m) => ({ loc: `/markets/${m.slug}`, lastmod: day(m.updatedAt), priority: '0.7', changefreq: 'weekly', images: photos(m.name, m.image) })),
  ];
  const imageTags = (images = []) => images.map((i) => `<image:image><image:loc>${esc(i.loc)}</image:loc><image:title>${esc(i.title)}</image:title></image:image>`).join('');
  // Every page in English and in Urdu (?lang=ur), each listing both language versions (hreflang)
  const urdu = (loc) => `${loc}${loc.includes('?') ? '&' : '?'}lang=ur`;
  const langLinks = (loc) =>
    [['en-PK', loc], ['ur-PK', urdu(loc)], ['x-default', loc]].map(([l, href]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(origin + href)}"/>`).join('');
  const entry = (u, loc, images) =>
    `  <url><loc>${esc(origin + loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority>${langLinks(u.loc)}${imageTags(images)}</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls
    .flatMap((u) => [entry(u, u.loc, u.images), entry(u, urdu(u.loc))])
    .join('\n')}\n</urlset>\n`;
}

/** GET /sitemap.xml (cached for 10 minutes). */
export async function sitemap(req, res) {
  const origin = siteOrigin(req);
  if (!sitemapCache.xml || sitemapCache.origin !== origin || Date.now() - sitemapCache.at > 10 * 60 * 1000) {
    sitemapCache = { at: Date.now(), origin, xml: await buildSitemap(origin) };
  }
  res.type('application/xml').send(sitemapCache.xml);
}

// Search engines and AI assistants that may read the public pages (answer engines quote MarketLink)
const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'CCBot'];
const DISALLOW = ['/api/', '/account', '/farmer/', '/farmer$', '/admin', '/checkout', '/cart', '/reset-password/', '/unsubscribe'];

/** robots.txt text: public pages open to search engines and AI assistants, private pages closed. */
export function robotsText(origin) {
  const group = (agents) => [...agents.map((a) => `User-agent: ${a}`), 'Allow: /', ...DISALLOW.map((d) => `Disallow: ${d}`), ''];
  return [
    '# MarketLink: local farmers markets online. Public pages may be crawled, indexed and quoted.',
    `# Summary for AI assistants: ${origin}/llms.txt (full text: ${origin}/llms-full.txt)`,
    '',
    ...group(['*']),
    ...group(AI_CRAWLERS),
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

/** GET /robots.txt */
export function robots(req, res) {
  res.type('text/plain').send(robotsText(siteOrigin(req)));
}
