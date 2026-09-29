import env from '../config/env.js';
import { Category, Farmer, Product } from '../models/index.js';
import { produceInfo } from './describe.js';

/**
 * Product schema (schema.org structured data) written by AI.
 *
 * Every product gets a short answer-first summary, its season in Pakistan, a storage tip, what it is
 * best for and an Urdu name. With ANTHROPIC_API_KEY these are written by Claude; without a key (or when
 * the API cannot be reached) a built-in writer uses the produce knowledge base, so it always works.
 * The fields are saved on the product (`aiSchema`) and become the Product JSON-LD on the product page.
 */

// Keyword -> harvest season in Pakistan and the Urdu name (longest / last match wins)
const PRODUCE = [
  { k: /mango/, season: 'May to August', ur: 'آم' },
  { k: /kinnow|orange|malta/, season: 'December to February', ur: 'کینو' },
  { k: /apple/, season: 'August to November', ur: 'سیب' },
  { k: /pear/, season: 'August to October', ur: 'ناشپاتی' },
  { k: /peach/, season: 'June to August', ur: 'آڑو' },
  { k: /cherr/, season: 'May to June', ur: 'چیری' },
  { k: /strawberr/, season: 'January to March', ur: 'اسٹرابیری' },
  { k: /kiwi/, season: 'October to December', ur: 'کیوی' },
  { k: /banana/, season: 'All year', ur: 'کیلا' },
  { k: /watermelon/, season: 'May to July', ur: 'تربوز' },
  { k: /melon|cantaloupe/, season: 'May to July', ur: 'خربوزہ' },
  { k: /coconut/, season: 'All year', ur: 'ناریل' },
  { k: /lemon|lime/, season: 'All year', ur: 'لیموں' },
  { k: /tomato/, season: 'All year', ur: 'ٹماٹر' },
  { k: /carrot/, season: 'November to February', ur: 'گاجر' },
  { k: /potato/, season: 'All year', ur: 'آلو' },
  { k: /sweet potato/, season: 'November to February', ur: 'شکر قندی' },
  { k: /onion/, season: 'All year', ur: 'پیاز' },
  { k: /cucumber/, season: 'April to September', ur: 'کھیرا' },
  { k: /brinjal|eggplant|aubergine/, season: 'All year', ur: 'بینگن' },
  { k: /capsicum|bell pepper/, season: 'All year', ur: 'شملہ مرچ' },
  { k: /chilli|chili/, season: 'All year', ur: 'ہری مرچ' },
  { k: /spinach|palak/, season: 'November to March', ur: 'پالک' },
  { k: /mint|podina/, season: 'All year', ur: 'پودینہ' },
  { k: /coriander|dhania/, season: 'All year', ur: 'ہرا دھنیا' },
  { k: /lettuce/, season: 'November to March', ur: 'سلاد' },
  { k: /broccoli/, season: 'November to February', ur: 'بروکلی' },
  { k: /mushroom/, season: 'All year', ur: 'مشروم' },
  { k: /peas|matar/, season: 'December to February', ur: 'مٹر' },
  { k: /corn/, season: 'July to October', ur: 'مکئی' },
  { k: /garlic/, season: 'All year', ur: 'لہسن' },
  { k: /ginger/, season: 'All year', ur: 'ادرک' },
  { k: /milk/, season: 'All year', ur: 'دودھ' },
  { k: /paneer/, season: 'All year', ur: 'پنیر' },
  { k: /egg/, season: 'All year', ur: 'انڈے' },
  { k: /butter/, season: 'All year', ur: 'مکھن' },
  { k: /yogurt|yoghurt|dahi/, season: 'All year', ur: 'دہی' },
  { k: /bread|loaf|sourdough|baguette/, season: 'All year', ur: 'ڈبل روٹی' },
  { k: /naan/, season: 'All year', ur: 'نان' },
  { k: /croissant/, season: 'All year', ur: 'کروسان' },
  { k: /bagel/, season: 'All year', ur: 'بیگل' },
  { k: /cookie|biscuit/, season: 'All year', ur: 'بسکٹ' },
  { k: /pie/, season: 'All year', ur: 'پائی' },
  { k: /honey/, season: 'All year', ur: 'شہد' },
  { k: /jam/, season: 'All year', ur: 'جام' },
  { k: /chutney/, season: 'All year', ur: 'چٹنی' },
  { k: /olive/, season: 'All year', ur: 'زیتون' },
  { k: /atta|flour/, season: 'All year', ur: 'آٹا' },
  { k: /rice|basmati/, season: 'All year', ur: 'چاول' },
  { k: /bean|rajma/, season: 'All year', ur: 'لوبیا' },
  { k: /peanut/, season: 'All year', ur: 'مونگ پھلی' },
  { k: /sunflower/, season: 'All year', ur: 'سورج مکھی' },
  { k: /rose/, season: 'All year', ur: 'گلاب' },
  { k: /tulip/, season: 'January to March', ur: 'ٹیولپ' },
  { k: /cactus/, season: 'All year', ur: 'کیکٹس' },
  { k: /hibiscus/, season: 'All year', ur: 'گڑہل' },
  { k: /money plant|plant/, season: 'All year', ur: 'پودا' },
];

/** The match that ends last (the main word of the name) and, when two end together, the longer one. */
function findProduce(name) {
  const text = String(name || '').toLowerCase();
  let best = null;
  for (const entry of PRODUCE) {
    const m = entry.k.exec(text);
    if (!m) continue;
    const end = m.index + m[0].length;
    if (!best || end > best.end || (end === best.end && m[0].length > best.len)) best = { entry, end, len: m[0].length };
  }
  return best?.entry || null;
}

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t;
};
const firstUpper = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK')}`;

/** Built-in writer (no API key needed). */
export function builtinSchema({ name, category = '', unit = '', price, stallName = 'a local farmer', city = '', practices = [] }) {
  const info = produceInfo(name, category);
  const produce = findProduce(name);
  const where = city ? ` in ${city}` : '';
  const priceText = price ? `, sold per ${unit || 'unit'} for ${money(price)}` : unit ? `, sold per ${unit}` : '';
  const practice = practices.length ? ` (${practices.slice(0, 2).join(', ').toLowerCase()})` : '';
  const catWord = String(category || 'produce').toLowerCase();
  return {
    summary: clip(`${name} from ${stallName}${where}${practice}: ${info.taste}${priceText}. Pre-order on MarketLink and collect it at the market.`, 300),
    season: produce?.season || 'All year',
    storage: clip(info.keep, 200),
    uses: clip(firstUpper(info.use), 200),
    storageUr: clip(info.keepUr, 250),
    usesUr: clip(info.useUr, 250),
    nameUr: produce?.ur || '',
    metaTitle: clip(`${name}, fresh ${catWord} from ${stallName}`, 70),
    metaDescription: clip(`${name} from ${stallName}${where}: ${info.taste}. Pre-order online and pay at the stall when you pick it up.`, 170),
    keywords: [...new Set([name.toLowerCase(), `fresh ${name.toLowerCase()}`, catWord, city && `${catWord} ${city.toLowerCase()}`, produce?.ur, 'local farmer'].filter(Boolean))].slice(0, 12),
  };
}

/** Asks Claude for the same fields as JSON (only when ANTHROPIC_API_KEY is set). */
async function claudeSchema(details) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', 'x-api-key': env.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.anthropic.model,
      max_tokens: 600,
      system:
        'You write structured product data for MarketLink, a farmers market pre-order website in Pakistan (customers pay the farmer in cash at pickup). Answer with one JSON object only, no other text, with these keys: ' +
        '"summary" (one answer-first sentence, max 40 words, what it is, who sells it, price and unit if given), "season" (harvest months in Pakistan like "May to August", or "All year"), ' +
        '"storage" (one short storage tip), "uses" (short list of dishes or uses popular in Pakistan), "nameUr" (the product name in correct Urdu script using Urdu letters such as ک ی ہ ے), ' +
        '"storageUr" and "usesUr" (the storage tip and the uses in correct, natural Urdu script with Urdu punctuation such as ، and ۔), ' +
        '"metaTitle" (max 60 characters), "metaDescription" (max 155 characters), "keywords" (array of up to 10 lowercase search phrases, English and Roman Urdu). No emoji, no health claims.',
      messages: [
        {
          role: 'user',
          content: [
            `Product: ${details.name}`,
            `Category: ${details.category || 'unknown'}`,
            details.unit && `Sold per: ${details.unit}`,
            details.price && `Price: ${money(details.price)}`,
            `Farm / stall: ${details.stallName}${details.city ? ` (${details.city})` : ''}`,
            details.practices?.length && `Farming practices: ${details.practices.join(', ')}`,
            details.description && `Farmer's description: ${details.description}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const text = data.content?.find((c) => c.type === 'text')?.text || '';
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const str = (v, n) => clip(typeof v === 'string' ? v : '', n);
  const out = {
    summary: str(json.summary, 300),
    season: str(json.season, 80),
    storage: str(json.storage, 200),
    uses: str(json.uses, 200),
    storageUr: str(json.storageUr, 250),
    usesUr: str(json.usesUr, 250),
    nameUr: str(json.nameUr, 100),
    metaTitle: str(json.metaTitle, 70),
    metaDescription: str(json.metaDescription, 170),
    keywords: (Array.isArray(json.keywords) ? json.keywords : []).map((k) => String(k).toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 12),
  };
  if (!out.summary) throw new Error('Empty answer');
  return out;
}

/** AI fields for a product: Claude when a key is set, the built-in writer otherwise. */
export async function generateProductSchema(details) {
  if (env.anthropic.apiKey) {
    try {
      const ai = await claudeSchema(details);
      // Urdu tips from the built-in writer when Claude left them out
      const local = builtinSchema(details);
      return { ...ai, storageUr: ai.storageUr || local.storageUr, usesUr: ai.usesUr || local.usesUr, source: 'claude' };
    } catch (err) {
      console.warn('[ai] Claude product schema failed, using the built-in writer:', err.message);
    }
  }
  return { ...builtinSchema(details), source: 'builtin' };
}

/** Details of a saved product for the writers. */
async function detailsOf(product) {
  const [category, farmer] = await Promise.all([
    Category.findById(product.category).select('name').lean(),
    Farmer.findById(product.farmer).select('stallName city tags').lean(),
  ]);
  return {
    name: product.name,
    category: category?.name || '',
    unit: product.unit,
    price: product.price,
    description: product.description,
    stallName: farmer?.stallName || 'a local farmer',
    city: farmer?.city || '',
    practices: farmer?.tags || [],
  };
}

/**
 * Writes the AI schema of a saved product. Fields the farmer typed themselves are kept unless
 * `force` is set; an empty Urdu name is filled in too. Returns the updated product.
 */
export async function refreshProductSchema(product, { force = false } = {}) {
  if (!force && product.aiSchema?.source === 'farmer' && product.aiSchema?.summary) return product;
  const ai = await generateProductSchema(await detailsOf(product));
  product.aiSchema = { summary: ai.summary, season: ai.season, storage: ai.storage, uses: ai.uses, storageUr: ai.storageUr, usesUr: ai.usesUr, source: ai.source, generatedAt: new Date() };
  if (!product.nameUr && ai.nameUr) product.nameUr = ai.nameUr;
  await product.save();
  return product;
}

/**
 * After a product is saved: write the schema straight away with the built-in writer when it is
 * missing or out of date, then let Claude improve it in the background (when a key is set), so
 * saving a product never waits for the AI.
 */
export async function ensureProductSchema(product, { changed = false, background = true } = {}) {
  const missing = !product.aiSchema?.summary;
  if (!missing && !changed) return product;
  if (product.aiSchema?.source === 'farmer' && !missing) return product;
  const details = await detailsOf(product);
  const quick = builtinSchema(details);
  product.aiSchema = { summary: quick.summary, season: quick.season, storage: quick.storage, uses: quick.uses, storageUr: quick.storageUr, usesUr: quick.usesUr, source: 'builtin', generatedAt: new Date() };
  if (!product.nameUr && quick.nameUr) product.nameUr = quick.nameUr;
  await product.save();
  if (background && env.anthropic.apiKey) {
    const id = product._id;
    setImmediate(async () => {
      try {
        const fresh = await Product.findById(id);
        if (fresh && fresh.aiSchema?.source !== 'farmer') await refreshProductSchema(fresh, { force: true });
      } catch (err) {
        console.warn('[ai] background product schema failed:', err.message);
      }
    });
  }
  return product;
}

/** schema.org Product for a product page (absolute URLs). `farmer` and `category` are populated. */
export function productJsonLd(p, origin, { reviews = [] } = {}) {
  const url = `${origin}/products/${p.slug}`;
  const abs = (u) => (/^https?:\/\//.test(u) ? u : `${origin}${u.startsWith('/') ? '' : '/'}${u}`);
  const images = [p.image, ...(p.gallery || []).map((g) => g.url)].filter(Boolean).map(abs);
  const inStock = p.status === 'available' && p.quantityAvailable > 0;
  const ai = p.aiSchema || {};
  const until = new Date();
  const priceValidUntil = new Date(until.getFullYear(), until.getMonth() + 2, 0).toISOString().slice(0, 10);
  const prop = (name, value) => (value ? { '@type': 'PropertyValue', name, value } : null);
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    alternateName: p.nameUr || undefined,
    description: p.description || ai.summary || undefined,
    disambiguatingDescription: ai.summary || undefined,
    image: images,
    sku: String(p._id),
    category: p.category?.name ? `Fresh food > ${p.category.name}` : undefined,
    keywords: p.keywords?.length ? p.keywords.join(', ') : undefined,
    url,
    brand: { '@type': 'Brand', name: p.farmer?.stallName },
    countryOfOrigin: { '@type': 'Country', name: 'Pakistan' },
    additionalProperty: [
      prop('Season', ai.season),
      prop('Storage', ai.storage),
      prop('Best for', ai.uses),
      prop('Grown in', p.farmer?.city),
      prop('Farming practice', p.farmer?.tags?.length ? p.farmer.tags.join(', ') : ''),
      prop('Sold per', p.unit),
      prop('Payment', 'Cash to the farmer at pickup'),
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      url,
      price: p.price,
      priceCurrency: 'PKR',
      priceValidUntil,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      availableDeliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp',
      eligibleQuantity: { '@type': 'QuantitativeValue', unitText: p.unit },
      seller: { '@type': 'Organization', name: p.farmer?.stallName, url: `${origin}/farmers/${p.farmer?.slug}` },
    },
    ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount, bestRating: 5, worstRating: 1 } } : {}),
    review: reviews.length
      ? reviews.map((r) => ({
          '@type': 'Review',
          reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          author: { '@type': 'Person', name: String(r.customer?.name || 'Customer').split(' ')[0] },
          datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
          reviewBody: r.comment,
        }))
      : undefined,
  };
}
