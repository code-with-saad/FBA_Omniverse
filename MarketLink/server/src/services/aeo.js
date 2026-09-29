import { Category, Farmer, Market, Product } from '../models/index.js';
import { FAQ_GROUPS } from '../models/Faq.js';
import { publicFaqs } from '../controllers/faqController.js';

/**
 * Answer engine optimisation (AEO): plain, answer-first text for crawlers and AI assistants that do
 * not run JavaScript. Every public page gets its main facts and links in the HTML (see sendPage in
 * seo.js), and /llms.txt + /llms-full.txt describe the whole site in Markdown.
 */

export const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const SITE_SUMMARY =
  'MarketLink is a website for weekly farmers markets in Pakistan (Karachi, Lahore and Islamabad). Customers see what each local farmer has in stock this week, pre-order online, collect the order at the market in a chosen time slot and pay the farmer in cash at the stall. There is no online payment. Farmers join for free.';

export const HOW_IT_WORKS = [
  ['Find fresh produce', 'Browse this week’s stock by category, market, farmer or pickup day.'],
  ['Add to your basket', 'Press Add on a product, choose how many and add it to the basket. One basket can hold several farmers.'],
  ['Pick a pickup slot', 'At checkout choose the market, day and time window for each farmer. No account is needed: guests get one automatically.'],
  ['Collect and pay at the stall', 'Show your order number at the stall on market day and pay the farmer in cash.'],
];

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK')}`;
const time12 = (t = '') => {
  const [h, m] = String(t).split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const days = (list = []) => list.map((d) => DAY[d]).join(', ');
const firstSentence = (s) =>
  (
    String(s || '')
      .split('\n')[0]
      .match(/^.*?[.!?](\s|$)/)?.[0] || String(s || '').split('\n')[0]
  ).trim();
const firstParagraph = (s) =>
  String(s || '')
    .split(/\n{2,}/)[0]
    .replace(/\s+/g, ' ')
    .trim(); // the short, direct answer
const a = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '');
const paragraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

// Main links, so crawlers without JavaScript can follow the site
const SITE_NAV = `<nav aria-label="Main">${list(
  [
    ['/', 'Home'],
    ['/products', 'Shop fresh produce'],
    ['/markets', 'Farmers markets'],
    ['/farmers', 'Local farmers'],
    ['/map', 'Market map'],
    ['/faq', 'FAQs'],
    ['/about', 'About MarketLink'],
    ['/contact', 'Contact us'],
    ['/register/farmer', 'Sell with MarketLink'],
    ['/terms', 'Terms & Conditions'],
  ].map(([href, text]) => a(href, text))
)}</nav>`;

const page = (title, lead, ...sections) =>
  `<header><h1>${esc(title)}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}</header><main>${sections.filter(Boolean).join('')}</main>${SITE_NAV}`;
const section = (heading, html) => (html ? `<section><h2>${esc(heading)}</h2>${html}</section>` : '');

const productLine = (p) =>
  `${a(`/products/${p.slug}`, p.name)}: ${money(p.price)} per ${esc(p.unit)}${p.farmer?.stallName ? ` from ${esc(p.farmer.stallName)}` : ''}${p.status !== 'available' || p.quantityAvailable <= 0 ? ' (sold out this week)' : ''}`;
const marketLine = (m) =>
  `${a(`/markets/${m.slug}`, m.name)}${m.city ? `, ${esc(m.city)}` : ''}${m.operatingDays?.length ? `: open ${esc(days(m.operatingDays))}, ${esc(time12(m.openTime))} to ${esc(time12(m.closeTime))}` : ''}`;
const howItWorks = () => `<ol>${HOW_IT_WORKS.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ol>`;
const faqHtml = (faqs) => faqs.map((f) => `<h3>${esc(f.question)}</h3>${paragraphs(f.answer)}`).join('');

/** HTML text of each kind of public page (written into index.html by the server). */
export const pageBody = {
  home: ({ faqs, categories, markets }) =>
    page(
      'Fresh from local farmers markets',
      SITE_SUMMARY,
      section('How MarketLink works', howItWorks()),
      section('Shop by category', list(categories.map((c) => a(`/products?category=${c.slug}`, c.name)))),
      section('Farmers markets', list(markets.map(marketLine))),
      section('Frequently asked questions', faqHtml(faqs))
    ),

  faq: ({ faqs }) =>
    page(
      'Frequently asked questions',
      'Short answers about ordering, pickup, payment and selling on MarketLink. In one line: you reserve fresh food from local farmers online, collect it at the market and pay the farmer there.',
      ...Object.entries(FAQ_GROUPS).map(([key, label]) => section(label, faqHtml(faqs.filter((f) => f.group === key))))
    ),

  product: ({ product: p, markets, reviews }) => {
    const soldOut = p.status !== 'available' || p.quantityAvailable <= 0;
    const windows = (p.farmer?.pickupWindows || []).map(
      (w) =>
        `${DAY[w.day]} ${time12(w.start)} to ${time12(w.end)}${markets.find((m) => String(m._id) === String(w.market)) ? ` at ${markets.find((m) => String(m._id) === String(w.market)).name}` : ''}`
    );
    return page(
      p.name,
      `${p.name} costs ${money(p.price)} per ${p.unit} from ${p.farmer?.stallName}${p.farmer?.city ? ` (${p.farmer.city})` : ''}. ${soldOut ? 'It is sold out this week.' : `${p.quantityAvailable} ${p.unit} are available this week.`} Pre-order on MarketLink, collect it at the market and pay the farmer at pickup.`,
      p.description ? section('About this product', paragraphs(p.description)) : '',
      section(
        'Quick facts',
        list(
          [
            `Price: ${money(p.price)} per ${esc(p.unit)}`,
            `Category: ${a(`/products?category=${p.category?.slug}`, p.category?.name || 'Produce')}`,
            `Sold by: ${a(`/farmers/${p.farmer?.slug}`, p.farmer?.stallName || 'Farmer')}`,
            `Availability: ${soldOut ? 'sold out' : 'in stock'}`,
            p.ratingCount > 0 ? `Rating: ${p.ratingAvg} out of 5 from ${p.ratingCount} reviews` : '',
            `Payment: cash to the farmer at pickup, no online payment`,
            `Orders close ${p.farmer?.orderCutoffHours ?? 12} hours before the pickup slot`,
          ].filter(Boolean)
        )
      ),
      section('Pickup times', list(windows.map(esc))),
      section('Markets', list(markets.map((m) => a(`/markets/${m.slug}`, m.name)))),
      section('Customer reviews', list(reviews.map((r) => `${r.rating}/5: ${esc(r.comment)}`)))
    );
  },

  farmer: ({ farmer: f, products, markets }) =>
    page(
      f.stallName,
      `${f.stallName} is a local farmer${f.city ? ` in ${f.city}` : ''} selling on MarketLink${markets.length ? ` at ${markets.map((m) => m.name).join(', ')}` : ''}. Pre-order their produce online and pay at the stall when you collect it.`,
      f.bio ? section('About the farm', paragraphs(f.bio)) : '',
      f.tags?.length ? section('Farming practices', list(f.tags.map(esc))) : '',
      section('This week’s products', list(products.map(productLine))),
      section('Where to collect', list(markets.map((m) => a(`/markets/${m.slug}`, m.name)))),
      f.ratingCount > 0 ? section('Rating', `<p>${f.ratingAvg} out of 5 from ${f.ratingCount} reviews.</p>`) : ''
    ),

  market: ({ market: m, farmers }) =>
    page(
      m.name,
      `${m.name} is a farmers market at ${m.address}${m.city ? `, ${m.city}` : ''}. It is open ${days(m.operatingDays) || 'on market days'}, ${time12(m.openTime)} to ${time12(m.closeTime)}. Pre-order from its farmers on MarketLink and collect your order here.`,
      m.description ? section('About the market', paragraphs(m.description)) : '',
      section('Farmers at this market', list(farmers.map((f) => `${a(`/farmers/${f.slug}`, f.stallName)}${f.city ? `, ${esc(f.city)}` : ''}`)))
    ),

  products: ({ products, categories, category, title, description }) =>
    page(
      title || 'Shop fresh produce',
      description,
      section(category ? `${category.name} this week` : 'Popular this week', list(products.map(productLine))),
      section('Categories', list(categories.map((c) => a(`/products?category=${c.slug}`, c.name))))
    ),

  markets: ({ markets, title, description }) =>
    page(title || 'Farmers markets', description, section('All markets', list(markets.map((m) => `${marketLine(m)}. ${esc(m.address)}`)))),

  farmers: ({ farmers, title, description }) =>
    page(
      title || 'Local farmers',
      description,
      section(
        'All farmers',
        list(farmers.map((f) => `${a(`/farmers/${f.slug}`, f.stallName)}${f.city ? ` (${esc(f.city)})` : ''}${f.bio ? `: ${esc(firstSentence(f.bio))}` : ''}`))
      )
    ),

  info: ({ pathname, title, description }) => {
    const extra = {
      '/about':
        section('How MarketLink works', howItWorks()) + section('Who built it', '<p>MarketLink was built by Team Omniverse for the TechWiz 2026 End-to-End Web Solutions challenge.</p>'),
      '/contact': section('Contact details', list(['E-mail: noreplyy.support@gmail.com', 'Phone: +92 335 3132747', 'Address: Aptech Learning Centre, F.B. Area, Karachi, Pakistan'])),
      '/register/farmer': section(
        'Why sell on MarketLink',
        list([
          'Free to join',
          'Customers pre-order before market day, so you harvest the right amount',
          'Customers pay you in cash at your stall',
          'Orders, stock, pickup times and sales reports in one dashboard',
        ])
      ),
    };
    return page(title || 'MarketLink', description, `<p>${esc(SITE_SUMMARY)}</p>`, extra[pathname] || '');
  },
};

// ---------------------------------------------------------------- llms.txt

const cache = new Map();
async function cached(key, build) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.text;
  const text = await build();
  cache.set(key, { at: Date.now(), text });
  return text;
}

async function siteData() {
  const [faqs, categories, markets, farmers] = await Promise.all([
    publicFaqs(),
    Category.find({ isActive: { $ne: false } })
      .select('name slug description')
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    Market.find({ isActive: true }).select('name slug city address operatingDays openTime closeTime description').sort({ city: 1, name: 1 }).lean(),
    Farmer.find({ isActive: true }).select('stallName slug city bio tags').sort({ stallName: 1 }).lean(),
  ]);
  return { faqs, categories, markets, farmers };
}

const mdMarket = (origin, m) =>
  `- [${m.name}](${origin}/markets/${m.slug}): ${m.city ? `${m.city}, ` : ''}${m.address}. Open ${days(m.operatingDays)}, ${time12(m.openTime)} to ${time12(m.closeTime)}.`;

function intro(origin) {
  return [
    '# MarketLink',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    'Key facts:',
    '- Payment: cash to the farmer at pickup. No online payment, no card details.',
    '- Ordering: add products to the basket, choose a market and a pickup time slot per farmer, confirm. Guests get a free account automatically.',
    '- Changes: orders can be changed or cancelled until the farmer’s cut-off time (usually 12 hours before the pickup slot).',
    '- Farmers: registration is free; an administrator approves each stall before it can sell.',
    `- Contact: hello@marketlink.pk, +92 21 3456 7890, Aptech Learning Centre, F.B. Area, Karachi. Contact form: ${origin}/contact`,
    '',
  ];
}

/** llms.txt: a short Markdown guide to the site for AI assistants (llmstxt.org). */
export async function llmsShortText(origin) {
  const { faqs, categories, markets } = await siteData();
  return [
    ...intro(origin),
    '## Main pages',
    `- [Shop fresh produce](${origin}/products): this week’s products from every farmer, with prices and stock`,
    `- [Farmers markets](${origin}/markets): markets with address, opening days and times`,
    `- [Local farmers](${origin}/farmers): farmer profiles, farming practices and weekly stock`,
    `- [FAQs](${origin}/faq): answers about ordering, pickup, payment and selling`,
    `- [About](${origin}/about): how MarketLink works`,
    `- [Sell with MarketLink](${origin}/register/farmer): farmer registration`,
    `- [Terms & Conditions](${origin}/terms)`,
    '',
    '## Categories',
    ...categories.map((c) => `- [${c.name}](${origin}/products?category=${c.slug})${c.description ? `: ${c.description}` : ''}`),
    '',
    '## Markets',
    ...markets.map((m) => mdMarket(origin, m)),
    '',
    '## FAQs',
    ...faqs.map((f) => `- [${f.question}](${origin}/faq): ${firstParagraph(f.answer)}`),
    '',
    '## Optional',
    `- [Full text for AI assistants](${origin}/llms-full.txt): every FAQ answer, market, farmer and product with prices`,
    `- [Sitemap](${origin}/sitemap.xml)`,
    '',
  ].join('\n');
}

/** llms-full.txt: the same guide with every answer, farmer and product (prices of this week). */
export async function llmsFullText(origin) {
  const [{ faqs, categories, markets, farmers }, products] = await Promise.all([
    siteData(),
    Product.find(Product.publicFilter())
      .populate('farmer', 'stallName')
      .populate('category', 'name')
      .select('name slug price unit status quantityAvailable farmer category description')
      .sort({ name: 1 })
      .lean(),
  ]);
  const byCategory = categories
    .map((c) => ({
      c,
      items: products.filter((p) => String(p.category?._id) === String(c._id)),
    }))
    .filter((g) => g.items.length);
  return [
    ...intro(origin),
    '## How it works',
    ...HOW_IT_WORKS.map(([t, d], i) => `${i + 1}. **${t}.** ${d}`),
    '',
    '## Frequently asked questions',
    ...faqs.flatMap((f) => [`### ${f.question}`, '', f.answer, '']),
    '## Markets',
    ...markets.map((m) => mdMarket(origin, m)),
    '',
    '## Farmers',
    ...farmers.map(
      (f) => `- [${f.stallName}](${origin}/farmers/${f.slug})${f.city ? ` (${f.city})` : ''}${f.tags?.length ? ` [${f.tags.join(', ')}]` : ''}: ${firstSentence(f.bio)}`
    ),
    '',
    `## Products this week (prices in Pakistani rupees, updated ${new Date().toISOString().slice(0, 10)})`,
    ...byCategory.flatMap(({ c, items }) => [
      '',
      `### ${c.name}`,
      ...items.map(
        (p) =>
          `- [${p.name}](${origin}/products/${p.slug}): Rs ${p.price} per ${p.unit}, from ${p.farmer?.stallName}${p.status !== 'available' || p.quantityAvailable <= 0 ? ' (sold out)' : ''}`
      ),
    ]),
    '',
  ].join('\n');
}

/** GET /llms.txt (cached for 10 minutes) */
export async function llmsTxt(req, res, origin) {
  const text = await cached(`short:${origin}`, () => llmsShortText(origin));
  res.type('text/markdown; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(text);
}

/** GET /llms-full.txt (cached for 10 minutes) */
export async function llmsFullTxt(req, res, origin) {
  const text = await cached(`full:${origin}`, () => llmsFullText(origin));
  res.type('text/markdown; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(text);
}
