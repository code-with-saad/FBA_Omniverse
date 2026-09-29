/**
 * MarketLink Assistant - a lightweight rule-based chatbot.
 *
 * It does not call any external AI service. Instead it:
 *  1. normalises the question,
 *  2. detects the intent with keyword rules (timings, pickup, availability, products ...),
 *  3. recognises markets, farmers, categories and days mentioned in the text,
 *  4. answers from live data in the database.
 *
 * Memory: the answer also returns a small "memory" object (the market / farmer / product the
 * conversation is about, the last intent, and what the user told it such as their name and city).
 * It is sent back with the next question, so follow-ups like "which farmers are there?" or
 * "how much is it?" are understood. Signed-in users' memory and history are saved in AssistantChat.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import env from '../config/env.js';
import { Category, Farmer, Market, Order, Product } from '../models/index.js';
import { DAY_NAMES, OPEN_ORDER_STATUSES, PRODUCT_STATUS, ROLES } from '../utils/constants.js';
import { escapeRegex } from '../utils/helpers.js';
import { timeToMinutes, toDateKey } from '../utils/dates.js';
import { CATEGORY_UR, CITY_UR, DAY_UR, STATUS_UR, UNIT_UR, isUrduText, urduToEnglish } from './assistantUrdu.js';
import { ROMAN_STOP_WORDS, romanToEnglish } from './assistantRoman.js';

const STOP_WORDS = new Set(
  'a an the is are was were be do does did i you me my we our it its of for to in on at by with and or can could would should will what when where which who how any some there here have has get buy find need want show tell about please price cost much many available availability today tomorrow this week market markets bazaar farmer farmers farm stall stalls vendor sell sells selling fresh open time timing timings hours pickup slot slots window windows day days is are im looking near me from have got anyone somebody kg per rate it they them there that those these same more also else stock left still wahan wahaan iska uska unka'
    .split(' ')
    .concat(ROMAN_STOP_WORDS)
);

const NAME_NOISE = new Set(['market', 'farmers', 'farmer', 'farm', 'farms', 'the', 'bazaar', 'fresh', 'weekend', 'sunday', 'friday', 'saturday', 'green', 'organic', 'and', 'co', 'stall', 'fields', 'garden', 'gardens']);

const has = (text, words) => words.some((w) => new RegExp(`\\b${w}`, 'i').test(text));
// The language of the answer ('en' or 'ur'), kept per request so answers given at the same time do not mix
const language = new AsyncLocalStorage();
const L = (en, ur) => (language.getStore() === 'ur' ? ur : en);
const dayName = (d) => L(DAY_NAMES[d], DAY_UR[d]);
const list = (items) => items.join(L(', ', '، '));
const fmtDays = (days = []) => (days.length ? list(days.map(dayName)) : L('no fixed days yet', 'ابھی کوئی دن مقرر نہیں'));
const closedNote = (farmer) =>
  farmer.blockedDates?.length ? `\n{{icon:exclamation-triangle}} ${L('Not at the market on:', 'ان دنوں مارکیٹ میں نہیں:')} ${list(farmer.blockedDates.slice(0, 5))}${L('.', '۔')}` : '';
const money = (n) => L(`${env.currency} ${Number(n).toLocaleString('en-US')}`, `${Number(n).toLocaleString('en-US')} روپے`);
const unitName = (u) => L(u, UNIT_UR[u] || u);
const productName = (p) => L(p.name, p.nameUr || p.name);
const categoryName = (c) => L(c?.name, c?.nameUr || CATEGORY_UR[c?.slug] || c?.name);
const cityName = (c) => L(c, CITY_UR[c] || c);
const hours = (a, b) => L(`${a}-${b}`, `${a} تا ${b}`);

// Words that point back to something said earlier ("is it in stock?", "which farmers are there?", "iska price?")
const FOLLOW_UP = /\b(it|its|there|them|they|their|that|those|these|same|this one|that one|him|her|more|wahan|wahaan|iska|uska|unka|inka)\b|^(and|also|what about|how about|and what about|aur)\b/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const clip = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Keeps only the memory fields the assistant understands (guests send their memory back with every message). */
export function cleanMemory(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of ['marketId', 'farmerId', 'productId']) if (typeof m[key] === 'string' && OBJECT_ID.test(m[key])) out[key] = m[key];
  for (const [key, max] of [['marketName', 120], ['farmerName', 120], ['productName', 120], ['city', 40], ['name', 30], ['lastIntent', 30]]) {
    const value = clip(m[key], max);
    if (value) out[key] = value;
  }
  if (Number.isInteger(m.day) && m.day >= 0 && m.day <= 6) out.day = m.day;
  return out;
}

function tokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Finds the entity whose distinctive name words appear in the question. */
function matchEntity(text, list, getName) {
  let best = null;
  let bestScore = 0;
  const lower = text.toLowerCase();
  for (const item of list) {
    const name = getName(item).toLowerCase();
    if (lower.includes(name)) return { ...item, matchScore: 99 }; // full name typed
    const words = tokens(name).filter((w) => w.length >= 4 && !NAME_NOISE.has(w));
    const score = words.filter((w) => new RegExp(`\\b${escapeRegex(w)}`).test(lower)).length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best ? { ...best, matchScore: bestScore } : null;
}

function detectDay(text) {
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) return new Date().getDay();
  if (/\btomorrow\b/.test(lower)) return (new Date().getDay() + 1) % 7;
  const index = DAY_NAMES.findIndex((d) => lower.includes(d.toLowerCase()) || new RegExp(`\\b${d.slice(0, 3).toLowerCase()}\\b`).test(lower));
  return index === -1 ? null : index;
}

const productCard = (p) => ({
  kind: 'product',
  id: String(p._id),
  title: productName(p),
  subtitle: `${money(p.price)} / ${unitName(p.unit)} · ${p.farmer?.stallName || ''}${p.status === PRODUCT_STATUS.AVAILABLE ? L(` · ${p.quantityAvailable} left`, ` · ${p.quantityAvailable} باقی`) : L(' · sold out', ' · ختم')}`,
  image: p.image,
  link: `/products/${p.slug || p._id}`,
});
const marketCard = (m) => ({
  kind: 'market',
  id: String(m._id),
  title: m.name,
  subtitle: `${fmtDays(m.operatingDays)} · ${hours(m.openTime, m.closeTime)}`,
  image: m.image,
  link: `/markets/${m.slug}`,
});
const farmerCard = (f) => ({
  kind: 'farmer',
  id: String(f._id),
  title: f.stallName,
  subtitle: `${fmtDays(f.operatingDays)}${f.ratingCount ? L(` · rated ${f.ratingAvg}/5`, ` · ریٹنگ ${f.ratingAvg}/5`) : ''}`,
  image: f.logo,
  link: `/farmers/${f.slug}`,
});

/** Products whose name starts with the searched word rank first ("mango" -> Mangoes before Mango Chutney). */
function nameScore(product, words) {
  const name = product.name.toLowerCase();
  return words.reduce((score, w) => {
    const stem = w.replace(/(es|s)$/, '');
    if (new RegExp(`\\b${escapeRegex(stem)}(e?s)?$`).test(name)) return score + 2;
    return name.includes(stem) ? score + 1 : score;
  }, product.status === PRODUCT_STATUS.AVAILABLE ? 0.5 : 0);
}

const DEFAULT_SUGGESTIONS = ['Top rated farmers', 'Markets open now', 'Where can I buy tomatoes?', 'How do I pay?'];

function reply(text, extra = {}) {
  return { reply: String(text).trim(), cards: extra.cards || [], suggestions: extra.suggestions || DEFAULT_SUGGESTIONS };
}

async function searchProducts(words, categoryId, farmerId) {
  const filter = { ...Product.publicFilter() };
  if (categoryId) filter.category = categoryId;
  if (farmerId) filter.farmer = farmerId;
  if (words.length) filter.$or = words.map((w) => ({ name: { $regex: escapeRegex(w.replace(/(es|s)$/, '')), $options: 'i' } }));
  return Product.find(filter).populate('farmer', 'stallName slug').sort({ status: 1, totalSold: -1 }).limit(5).lean();
}

/** Full details of one product (price, stock, rating, pickup days); remembers it for follow-ups. */
async function productDetails(productId, focus, mode = 'full') {
  const product = await Product.findOne({ ...Product.publicFilter(), _id: productId })
    .populate({ path: 'farmer', select: 'stallName slug pickupWindows orderCutoffHours', populate: { path: 'pickupWindows.market', select: 'name' } })
    .populate('category', 'name nameUr slug')
    .lean();
  if (!product?.farmer) return null;
  Object.assign(focus, { product, farmer: product.farmer, intent: 'product' });
  const days = [...new Set(product.farmer.pickupWindows.map((w) => L(`${DAY_NAMES[w.day]} at ${w.market?.name}`, `${DAY_UR[w.day]} کو ${w.market?.name}`)))];
  const name = productName(product);
  const unit = unitName(product.unit);
  const inStock = product.status === PRODUCT_STATUS.AVAILABLE;
  const stock = inStock
    ? L(`${product.quantityAvailable} ${product.unit} available this week`, `اس ہفتے ${product.quantityAvailable} ${unit} دستیاب`)
    : L('sold out right now (add it to favourites for a restock alert)', 'اس وقت ختم ہے (دوبارہ آنے کی اطلاع کے لیے اسے پسندیدہ میں شامل کریں)');
  const card = { cards: [productCard(product)], suggestions: [`Pickup windows for ${product.farmer.stallName}`, 'How much is it?', 'How do I pay?'] };
  if (mode === 'stock') {
    if (inStock) return reply(L(`Yes, **${name}** from ${product.farmer.stallName} has ${stock}.`, `جی ہاں، ${product.farmer.stallName} کے پاس **${name}** ${stock} ہے۔`), card);
    return reply(L(`**${name}** is ${stock}.`, `**${name}** ${stock}۔`), card);
  }
  if (mode === 'price') return reply(L(`**${name}** costs ${money(product.price)} per ${unit} at ${product.farmer.stallName}. You pay at pickup.`, `${product.farmer.stallName} پر **${name}** کی قیمت ${money(product.price)} فی ${unit} ہے۔ ادائیگی وصولی پر ہوتی ہے۔`), card);
  const rating = product.ratingCount ? L(`\nRating: {{icon:star-fill}} ${product.ratingAvg} from ${product.ratingCount} review(s).`, `\nریٹنگ: {{icon:star-fill}} ${product.ratingAvg} (${product.ratingCount} جائزے)۔`) : '';
  const pickup = days.join(L('; ', '؛ ')) || L('no pickup windows yet', 'ابھی وصولی کے اوقات مقرر نہیں');
  return reply(
    L(
      `**${name}** (${categoryName(product.category)}): ${money(product.price)} per ${unit} from **${product.farmer.stallName}**.\n${product.description || ''}\nStock: ${stock}.${rating}\nPickup: ${pickup} (order ${product.farmer.orderCutoffHours} h before your slot).`,
      `**${name}** (${categoryName(product.category)}): ${money(product.price)} فی ${unit}، **${product.farmer.stallName}** سے۔\nاسٹاک: ${stock}۔${rating}\nوصولی: ${pickup} (وصولی کے وقت سے ${product.farmer.orderCutoffHours} گھنٹے پہلے تک آرڈر دیں)۔`
    ),
    { cards: [productCard(product)], suggestions: ['Is it in stock?', `Pickup windows for ${product.farmer.stallName}`, 'How do I pay?'] }
  );
}

// --- questions about the site itself: rankings, best sellers, prices, offers, counts, help ------------
// Words that only say what kind of list is wanted ("top rated", "cheapest"); what is left names the product
const ASK_WORDS = new Set(
  'all best top rated rating ratings highest highly most selling seller sellers bestseller bestsellers sold popular trending cheapest cheap cheaper lowest low budget affordable expensive costliest priciest offer offers discount discounts deal deals sale new newest latest recent recently product products item items thing things list show rank ranked ranking number one reviewed reviews review stars star liked good great which what whats'.split(
    ' '
  )
);
const FARMER_WORDS = /\b(farmers?|stalls?|vendors?|sellers?|growers?)\b/;
const MARKET_WORDS = /\b(markets?|bazaars?)\b/;
const stars = (f) => (f.ratingCount ? L(`{{icon:star-fill}} ${f.ratingAvg} (${f.ratingCount} review${f.ratingCount === 1 ? '' : 's'})`, `{{icon:star-fill}} ${f.ratingAvg} (${f.ratingCount} جائزے)`) : L('no reviews yet', 'ابھی کوئی جائزہ نہیں'));
const topN = (text, fallback = 5) => Math.min(Math.max(Number(text.match(/\btop (\d{1,2})\b/)?.[1]) || fallback, 1), 10);

/** Is the farmer at the market today? { state: here | later | done | away | off, windows } */
function farmerToday(farmer, marketId) {
  const now = new Date();
  const day = now.getDay();
  if ((farmer.blockedDates || []).includes(toDateKey(now))) return { state: 'away', windows: [] };
  const windows = (farmer.pickupWindows || []).filter((w) => w.day === day && (!marketId || String(w.market?._id || w.market) === String(marketId)));
  if (!windows.length) return { state: 'off', windows };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = Math.min(...windows.map((w) => timeToMinutes(w.start)));
  const end = Math.max(...windows.map((w) => timeToMinutes(w.end)));
  if (farmer.checkIn?.date === toDateKey(now) && nowMin <= end) return { state: 'here', windows, checkedIn: true }; // "I'm at the market"
  return { state: nowMin < start ? 'later' : nowMin <= end ? 'here' : 'done', windows };
}
function nextMarketDay(farmer) {
  const today = new Date().getDay();
  for (let i = 1; i <= 7; i += 1) {
    const d = (today + i) % 7;
    if ((farmer.operatingDays || []).includes(d)) return i === 1 ? L('tomorrow', 'کل') : dayName(d);
  }
  return null;
}
/** Is the market open right now? */
function marketNow(m) {
  const now = new Date();
  if (!m.operatingDays.includes(now.getDay())) return 'closed';
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < timeToMinutes(m.openTime)) return 'later';
  return nowMin <= timeToMinutes(m.closeTime) ? 'open' : 'done';
}

async function siteAnswer(ctx) {
  const { text, rest, markets, farmers, categories, market, farmer, category, city, user, focus } = ctx;
  // Words naming the category or city are filters, not product names
  const named = new Set([...tokens(category?.name || ''), ...tokens(city || ''), 'city', 'cities', 'category', 'categories', 'week', 'here', 'now']);
  const words = tokens(rest).filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !ASK_WORDS.has(w) && !named.has(w) && !named.has(w.replace(/s$/, '')) && !DAY_NAMES.some((d) => d.toLowerCase().startsWith(w)));
  const scope = { ...Product.publicFilter() };
  if (category) scope.category = category._id;
  if (farmer) scope.farmer = farmer._id;
  if (market) scope.markets = market._id;
  else if (city) scope.markets = { $in: markets.filter((m) => m.city === city).map((m) => m._id) };
  if (words.length) scope.$or = words.map((w) => ({ name: { $regex: escapeRegex(w.replace(/(es|s)$/, '')), $options: 'i' } }));
  const where = market ? L(` at ${market.name}`, ` ${market.name} میں`) : city ? L(` in ${city}`, ` ${cityName(city)} میں`) : '';
  const what = category ? L(category.name.toLowerCase(), categoryName(category)) : L('products', 'اشیاء');
  const findProducts = (sort, limit = 5, extra = {}) =>
    Product.find({ ...scope, ...extra })
      .populate('farmer', 'stallName slug')
      .sort(sort)
      .limit(limit)
      .lean();
  const productLines = (items, detail) => items.map((p, i) => `${i + 1}. **${productName(p)}** (${p.farmer?.stallName}): ${detail(p)}`).join('\n');
  const localFarmers = () => {
    let pool = farmers;
    if (market) pool = pool.filter((f) => f.markets.some((m) => String(m) === String(market._id)));
    else if (city) {
      const ids = markets.filter((m) => m.city === city).map((m) => String(m._id));
      pool = pool.filter((f) => f.markets.some((m) => ids.includes(String(m))));
    }
    return pool;
  };

  // About MarketLink and the assistant
  if (/\b(about marketlink|what is marketlink|marketlink kya|about (this|the|your) (site|website|app|platform)|who are you|what (can|do) you do|what are you|how can you help)\b/.test(text)) {
    return reply(
      L(
        `**MarketLink** connects you with the farmers at ${markets.length} local farmers markets. You pre-order this week's fresh produce online, choose a pickup slot, and collect and pay at the farmer's stall.\nI can tell you market timings, which farmer is at the market today, the top rated farmers, best sellers, the cheapest ${'products'}, offers, pickup windows and your order status. I understand English, اردو and Roman Urdu.`,
        `**MarketLink** آپ کو ${markets.length} مقامی کسان منڈیوں کے کسانوں سے ملاتا ہے۔ آپ اس ہفتے کی تازہ پیداوار آن لائن پیشگی آرڈر کرتے ہیں، وصولی کا وقت چنتے ہیں اور کسان کے اسٹال سے آرڈر لے کر وہیں ادائیگی کرتے ہیں۔\nمیں مارکیٹ کے اوقات، آج کون سا کسان مارکیٹ میں ہے، سب سے اچھی ریٹنگ والے کسان، سب سے زیادہ بکنے والی اشیاء، سستی چیزیں، رعایتیں، وصولی کے اوقات اور آپ کے آرڈر کی صورتحال بتا سکتا ہوں۔ میں انگریزی، اردو اور رومن اردو سمجھتا ہوں۔`
      ),
      { suggestions: ['Top rated farmers', 'Best sellers', 'Markets open now', 'Offers this week'] }
    );
  }

  // Contact, complaints and market requests
  if (/\b(contact|complain|complaint|complaints|support|customer care|customer service|helpline|report a problem|request a market|suggest a market|talk to (a )?(human|person|someone)|email you|call you)\b/.test(text)) {
    return reply(
      L(
        'You can reach the MarketLink team from the **Contact** page. Choose a topic (for example *Complaint about a market*, *Complaint about a farmer*, *Request a new market* or *Help with an order*) so your message reaches the right person. We usually reply within one working day.\nFor a problem with a pre-order, you can also open the order in **My Orders**.',
        'MarketLink ٹیم سے **رابطہ** کے صفحے سے بات کریں۔ ایک موضوع چنیں (مثلاً *مارکیٹ کی شکایت*، *کسان کی شکایت*، *نئی مارکیٹ کی درخواست* یا *آرڈر میں مدد*) تاکہ آپ کا پیغام صحیح شخص تک پہنچے۔ ہم عموماً ایک کاروباری دن میں جواب دیتے ہیں۔\nکسی پیشگی آرڈر کے مسئلے کے لیے آپ **میرے آرڈر** میں آرڈر بھی کھول سکتے ہیں۔'
      ),
      { cards: [{ kind: 'link', id: 'contact', title: L('Contact us', 'ہم سے رابطہ'), subtitle: L('Questions, complaints and market requests', 'سوالات، شکایات اور مارکیٹ کی درخواستیں'), link: '/contact' }], suggestions: ['Track my order', 'How do I pay?', 'Market timings'] }
    );
  }

  // Farmer help: giving an offer, and telling customers about a market day
  // (Roman Urdu "kaise" has already become "how"; "how much" / "how many" are questions about prices and counts)
  const howTo = /\bhow\b(?!\s+(much|many|long|far|old)\b)|\bwhere (do|can) i\b|\bkis tarah\b/.test(text);
  if (howTo && /\b(offer|offers|discount|discounts|sale|percent off|% off)\b/.test(text) && /\b(give|put|add|set|make|create|start|run|laga\w*|lagao|dun|doon|dena|den|my|farmer|farmers|product|products|stall)\b/.test(text)) {
    return reply(
      L(
        'Farmers: open **Products & Pricing** and press **Offer** next to the product. Choose 10%, 20%, 25%, 30%, 40% or 50% off (or type any 5-90%), see the new price, and pick a last day if you like (3 days, 1 week, 2 weeks or a date). After the last day the usual price comes back by itself. Customers who saved the product are told, and the product shows the usual price crossed out with "N% off". The product form also has **Put this product on offer**.',
        'کسان: **اشیاء اور قیمتیں** کھولیں اور پروڈکٹ کے ساتھ **آفر** دبائیں۔ 10%، 20%، 25%، 30%، 40% یا 50% رعایت چنیں (یا 5 سے 90% تک کوئی بھی لکھیں)، نئی قیمت دیکھیں، اور چاہیں تو آخری دن چنیں (3 دن، 1 ہفتہ، 2 ہفتے یا کوئی تاریخ)۔ آخری دن کے بعد عام قیمت خود واپس آ جاتی ہے۔ جن گاہکوں نے پروڈکٹ محفوظ کی ہو انہیں اطلاع ملتی ہے۔ پروڈکٹ کے فارم میں بھی **اس پروڈکٹ پر آفر لگائیں** موجود ہے۔'
      ),
      { cards: [{ kind: 'link', id: 'farmer-offers', title: L('Products & Pricing', 'اشیاء اور قیمتیں'), subtitle: L('For farmers', 'کسانوں کے لیے'), link: '/farmer/products' }] }
    );
  }
  if (howTo && /\b(not coming|can'?t come|cannot come|could not come|won'?t come|absent|check ?in|checked in|attendance|present|haazri|hazri|nahi aa|nahin aa|nahi aaya|at the market|in the market|market today|there today)\b/.test(text) && /\b(i|we|farmer|farmers|tell|show|say|mark|customers?|bataun|batayen|bata)\b/.test(text)) {
    return reply(
      L(
        'Farmers: the dashboard has **Your market day**. When you reach your stall press **I\'m at the market**: customers see "At the market now, checked in at 8:10 am". If you cannot come, press **I cannot come to the market today** (or **I had to leave** after checking in); for a coming market day switch it to **Not coming**. Customers with a pickup that day get a notification and an e-mail, and nobody can book a pickup for that day.',
        'کسان: ڈیش بورڈ پر **آپ کا مارکیٹ کا دن** موجود ہے۔ اسٹال پر پہنچ کر **میں مارکیٹ میں ہوں** دبائیں: گاہک دیکھتے ہیں "ابھی مارکیٹ میں، صبح 8:10 پر حاضری لگائی"۔ اگر نہیں آ سکتے تو **میں آج مارکیٹ نہیں آ سکتا** دبائیں (یا حاضری کے بعد **مجھے جانا پڑا**)؛ آنے والے دن کے لیے اسے **نہیں آ رہے** کر دیں۔ اس دن وصولی والے گاہکوں کو اطلاع اور ای میل ملتی ہے اور اس دن کوئی نئی وصولی بک نہیں ہو سکتی۔'
      ),
      { cards: [{ kind: 'link', id: 'farmer-market-day', title: L('Your market day', 'آپ کا مارکیٹ کا دن'), subtitle: L('Farmer dashboard', 'کسان کا ڈیش بورڈ'), link: '/farmer' }] }
    );
  }

  // Account help
  if (/\bpassword\b/.test(text)) {
    return reply(
      L(
        'Forgot your password? On the **Log in** page press **Forgot password?**, type your email and we will send you a link to choose a new one. If you checked out as a guest, your password was emailed to you when the account was made.',
        'پاس ورڈ بھول گئے؟ **لاگ اِن** کے صفحے پر **پاس ورڈ بھول گئے؟** دبائیں، اپنی ای میل لکھیں اور ہم آپ کو نیا پاس ورڈ بنانے کا لنک بھیج دیں گے۔ اگر آپ نے مہمان کے طور پر آرڈر دیا تھا تو اکاؤنٹ بنتے وقت آپ کا پاس ورڈ ای میل کر دیا گیا تھا۔'
      ),
      { cards: [{ kind: 'link', id: 'forgot', title: L('Reset your password', 'پاس ورڈ دوبارہ بنائیں'), subtitle: L('We email you a link', 'ہم آپ کو لنک ای میل کریں گے'), link: '/forgot-password' }] }
    );
  }
  if (/\b(create|make|open|new) (an |a |my )?account\b|\bsign ?up\b|\bcreate account\b|\bregister\b/.test(text) && !/\b(farmer|farm|stall|sell|vendor)\b/.test(text)) {
    return reply(
      L(
        'Press **Sign up** at the top of the page, or simply check out as a guest: we make your account for you and email your password. With an account you can track pre-orders, save favourite farmers and get restock reminders.',
        'صفحے کے اوپر **سائن اپ** دبائیں، یا مہمان کے طور پر آرڈر مکمل کریں: ہم آپ کا اکاؤنٹ خود بنا کر پاس ورڈ ای میل کر دیتے ہیں۔ اکاؤنٹ سے آپ آرڈر دیکھ سکتے ہیں، پسندیدہ کسان محفوظ کر سکتے ہیں اور دوبارہ دستیابی کی اطلاع لے سکتے ہیں۔'
      ),
      { cards: [{ kind: 'link', id: 'register', title: L('Create an account', 'اکاؤنٹ بنائیں'), subtitle: L('Free for customers', 'گاہکوں کے لیے مفت'), link: '/register' }], suggestions: ['How do I order?', 'How do I pay?'] }
    );
  }

  // "I did not receive my order"
  if (/\bnot received\b|\b(didn'?t|did not|never) (receive|get|got|collect)\b|\bmissing order\b/.test(text)) {
    focus.intent = 'orders';
    const help = L(
      'Sorry about that. Open the order in **My Orders** and answer **No, I did not** when we ask whether you received it (you can add a note). The farmer and the MarketLink team are told straight away.',
      'اس کے لیے معذرت۔ **میرے آرڈر** میں آرڈر کھولیں اور جب ہم پوچھیں کہ کیا آپ کو آرڈر مل گیا تو **نہیں، مجھے نہیں ملا** دبائیں (آپ نوٹ بھی لکھ سکتے ہیں)۔ کسان اور MarketLink ٹیم کو فوراً اطلاع ہو جاتی ہے۔'
    );
    if (user?.role === ROLES.CUSTOMER) {
      const orders = await Order.find({ customer: user._id, status: 'completed', 'receipt.status': { $exists: false } })
        .populate('farmer', 'stallName')
        .sort({ completedAt: -1 })
        .limit(3)
        .lean();
      if (orders.length) {
        return reply(`${help}\n${L('These pickups are waiting for your answer:', 'ان آرڈرز پر آپ کا جواب باقی ہے:')}`, {
          cards: orders.map((o) => ({ kind: 'order', id: String(o._id), title: o.orderNumber, subtitle: `${o.farmer?.stallName || ''} · ${money(o.totalAmount)}`, link: `/account/orders/${o._id}` })),
        });
      }
    }
    return reply(help, { suggestions: ['Track my order', 'Contact support'] });
  }

  // Restock reminders
  if (/\b(remind|reminder|notify|alert)\b|\bback in stock\b|\brestock|\bwhen (will|is|does) .*\b(available|back)\b/.test(text)) {
    const soldOut = words.length ? await findProducts({ totalSold: -1 }, 3, { status: PRODUCT_STATUS.SOLD_OUT }) : [];
    const inStock = words.length && !soldOut.length ? await findProducts({ totalSold: -1 }, 3, { status: PRODUCT_STATUS.AVAILABLE }) : [];
    return reply(
      L(
        'When a product is sold out, press **Remind me** on it (in the shop, quick view or product page). We send you a notification and an email as soon as the farmer restocks it. Guests just type their email.',
        'جب کوئی چیز ختم ہو جائے تو اس پر **مجھے یاد دلائیں** دبائیں (دکان، فوری جھلک یا چیز کے صفحے پر)۔ کسان کے دوبارہ اسٹاک کرتے ہی ہم آپ کو اطلاع اور ای میل بھیج دیں گے۔ مہمان صرف اپنی ای میل لکھیں۔'
      ) + (soldOut.length ? `\n${L('Sold out right now:', 'اس وقت ختم:')}` : inStock.length ? `\n${L('Good news: these are in stock now.', 'خوشخبری: یہ اس وقت اسٹاک میں ہیں۔')}` : ''),
      { cards: [...soldOut, ...inStock].map(productCard) }
    );
  }

  // How to leave a review
  if (/\b(how (to|do i|can i) (review|rate|leave a review|write a review|give)|leave a review|write a review|give (a )?(review|rating)|add a review|how to review)\b/.test(text)) {
    return reply(
      L(
        'After the farmer marks your pre-order as picked up, we ask **Did you receive your order?** Press **Yes** and the review form opens: rate the farmer from 1 to 5 stars and add a comment. You can also review products you have bought from **My Orders**. Only real buyers can review, so the ratings are honest.',
        'جب کسان آپ کا آرڈر “وصول ہو گیا” کر دے تو ہم پوچھتے ہیں **کیا آپ کو آرڈر مل گیا؟** **جی ہاں** دبائیں تو جائزے کا فارم کھل جاتا ہے: کسان کو 1 سے 5 ستارے دیں اور تبصرہ لکھیں۔ خریدی ہوئی اشیاء کا جائزہ **میرے آرڈر** سے بھی دے سکتے ہیں۔ صرف اصل خریدار جائزہ دے سکتے ہیں، اس لیے ریٹنگ سچی ہوتی ہے۔'
      ),
      { suggestions: ['Top rated farmers', 'Track my order'] }
    );
  }

  // Counts: "how many farmers / markets / products are there?"
  const count = text.match(/\bhow many (farmers?|stalls?|vendors?|markets?|bazaars?|products?|items?|categor(?:y|ies)|cit(?:y|ies))\b/);
  if (count) {
    const kind = count[1];
    if (/^(farmer|stall|vendor)/.test(kind)) {
      const pool = localFarmers();
      return reply(L(`There are **${pool.length}** approved farmers${where} on MarketLink.`, `MarketLink پر${where} **${pool.length}** منظور شدہ کسان ہیں۔`), { cards: [...pool].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 4).map(farmerCard), suggestions: ['Top rated farmers', 'New farmers'] });
    }
    if (/^(market|bazaar)/.test(kind)) {
      const pool = city ? markets.filter((m) => m.city === city) : markets;
      return reply(L(`There are **${pool.length}** farmers markets${where}.`, `${where ? `${where} ` : ''}**${pool.length}** کسان منڈیاں ہیں۔`), { cards: pool.slice(0, 4).map(marketCard), suggestions: ['Markets open now', 'Which cities?'] });
    }
    if (/^(product|item)/.test(kind)) {
      const [total, inStock] = await Promise.all([Product.countDocuments(scope), Product.countDocuments({ ...scope, status: PRODUCT_STATUS.AVAILABLE })]);
      return reply(L(`There are **${total}** ${what}${where} on MarketLink, and **${inStock}** are in stock this week.`, `MarketLink پر${where} **${total}** ${what} ہیں، جن میں سے **${inStock}** اس ہفتے اسٹاک میں ہیں۔`), { suggestions: ['Best sellers', 'Offers this week'] });
    }
    if (/^categor/.test(kind)) return reply(L(`There are **${categories.length}** categories: ${list(categories.map(categoryName))}.`, `**${categories.length}** زمرے ہیں: ${list(categories.map(categoryName))}۔`));
    const cities = [...new Set(markets.map((m) => m.city).filter(Boolean))];
    return reply(L(`MarketLink has markets in **${cities.length}** cities: ${list(cities)}.`, `MarketLink کی مارکیٹیں **${cities.length}** شہروں میں ہیں: ${list(cities.map(cityName))}۔`));
  }

  // Cities
  if (/\b(which|what|all|kaun|konse) cit(y|ies)\b|\bcities\b/.test(text)) {
    const cities = [...new Set(markets.map((m) => m.city).filter(Boolean))];
    const lines = cities.map((c) => {
      const n = markets.filter((m) => m.city === c).length;
      return L(`• **${c}**: ${n} market${n === 1 ? '' : 's'}`, `• **${cityName(c)}**: ${n} مارکیٹ`);
    });
    return reply(L(`MarketLink markets are in these cities:\n${lines.join('\n')}`, `MarketLink کی مارکیٹیں ان شہروں میں ہیں:\n${lines.join('\n')}`), { suggestions: cities.slice(0, 3).map((c) => `Market timings in ${c}`) });
  }

  // Farmer at the market today / now
  if (farmer && /\b(today|now|right now|here|come|coming|there today|at the market)\b/.test(text) && !words.length) {
    Object.assign(focus, { farmer, intent: 'farmer' });
    const status = farmerToday(farmer, market?._id);
    const place = list([...new Set(status.windows.map((w) => w.market?.name).filter(Boolean))]) || market?.name || L('the market', 'مارکیٹ');
    const from = status.windows.length ? status.windows.map((w) => w.start).sort()[0] : '';
    const until = status.windows.length ? status.windows.map((w) => w.end).sort().at(-1) : '';
    const next = nextMarketDay(farmer);
    const nextText = next ? L(` Next market day: ${next}.`, ` اگلا دن: ${next}۔`) : '';
    const answers = {
      here: status.checkedIn
        ? L(`Yes, **${farmer.stallName}** is at ${place} right now (they checked in at the stall), until ${until}.`, `جی ہاں، **${farmer.stallName}** اس وقت ${place} میں ہے (اسٹال پر حاضری لگا دی ہے)، ${until} تک۔`)
        : L(`Yes, **${farmer.stallName}** is at ${place} right now, until ${until}.`, `جی ہاں، **${farmer.stallName}** اس وقت ${place} میں ہے، ${until} تک۔`),
      later: L(`**${farmer.stallName}** will be at ${place} today from ${from} to ${until}.`, `**${farmer.stallName}** آج ${from} سے ${until} تک ${place} میں ہوگا۔`),
      done: L(`**${farmer.stallName}** was at ${place} today (${from}-${until}) and has packed up.${nextText}`, `**${farmer.stallName}** آج ${place} میں تھا (${hours(from, until)}) اور اب جا چکا ہے۔${nextText}`),
      away: L(`**${farmer.stallName}** is not at the market today: they told us they cannot come.${nextText}`, `**${farmer.stallName}** آج مارکیٹ میں نہیں ہے: انہوں نے بتایا ہے کہ وہ نہیں آ سکتے۔${nextText}`),
      off: L(`**${farmer.stallName}** is not at a market today. They sell on ${fmtDays(farmer.operatingDays)}.${nextText}`, `**${farmer.stallName}** آج کسی مارکیٹ میں نہیں ہے۔ فروخت کے دن: ${fmtDays(farmer.operatingDays)}۔${nextText}`),
    };
    return reply(answers[status.state], { cards: [farmerCard(farmer)], suggestions: [`Pickup windows for ${farmer.stallName}`, 'Markets open now'] });
  }

  // Markets open right now
  if (/\bopen now\b|\b(open|live) (right )?now\b|\bnow open\b|\bmarkets? (open )?(right )?now\b/.test(text) || (/\bnow\b/.test(text) && MARKET_WORDS.test(text) && !market)) {
    focus.intent = 'markets_list';
    const pool = city ? markets.filter((m) => m.city === city) : markets;
    const open = pool.filter((m) => marketNow(m) === 'open');
    const later = pool.filter((m) => marketNow(m) === 'later');
    if (open.length) {
      return reply(L(`Open right now${where}:\n`, `اس وقت${where} کھلی مارکیٹیں:\n`) + open.map((m) => L(`• **${m.name}** until ${m.closeTime}`, `• **${m.name}** ${m.closeTime} تک`)).join('\n'), { cards: open.slice(0, 6).map(marketCard) });
    }
    if (later.length) {
      return reply(L(`No market is open right now${where}. Opening later today:\n`, `اس وقت${where} کوئی مارکیٹ نہیں کھلی۔ آج بعد میں کھلنے والی:\n`) + later.map((m) => L(`• **${m.name}** from ${m.openTime}`, `• **${m.name}** ${m.openTime} سے`)).join('\n'), { cards: later.slice(0, 6).map(marketCard) });
    }
    return reply(L(`No market is open right now${where}. Ask me "markets open tomorrow" to plan ahead.`, `اس وقت${where} کوئی مارکیٹ نہیں کھلی۔ آگے کا پروگرام بنانے کے لیے “کل کون سی مارکیٹ کھلی ہے” پوچھیں۔`), { suggestions: ['Markets open tomorrow', 'Market timings'] });
  }

  // Best sellers
  if (/\bbest ?-?sell|\bbestsellers?\b|\bmost (sold|popular|ordered|bought|selling)\b|\bpopular\b|\btrending\b|\bsells? (the )?most\b/.test(text)) {
    focus.intent = 'products_list';
    const n = topN(text);
    const items = (await findProducts({ totalSold: -1, ratingAvg: -1 }, n)).filter((p) => p.totalSold > 0);
    if (!items.length) return reply(L(`Nothing has sold${where} yet.`, `${where ? `${where} ` : ''}ابھی کچھ نہیں بکا۔`));
    return reply(L(`Top ${items.length} best-selling ${what}${where}:\n`, `${where ? `${where} ` : ''}سب سے زیادہ بکنے والی ${items.length} ${what}:\n`) + productLines(items, (p) => L(`${p.totalSold} sold`, `${p.totalSold} فروخت`)), {
      cards: [...items.slice(0, 5).map(productCard), { kind: 'link', id: 'best-sellers', title: L('All best sellers', 'تمام بیسٹ سیلر'), subtitle: L('Top 5, 10 and 20 per market', 'ہر مارکیٹ کے ٹاپ 5، 10 اور 20'), link: '/best-sellers' }],
      suggestions: ['Top rated farmers', 'Cheapest vegetables', 'Offers this week'],
    });
  }

  // Top rated farmers / products / markets
  const rated = /\b(top|best|highest|highly|most) ?-?(rated|rating|reviewed|liked|loved)\b|\btop rated\b/.test(text);
  if (rated || /\b(best|top|number one|no 1|finest)\b/.test(text)) {
    const productAsk = (category || words.length || /\b(products?|items?|things?)\b/.test(text)) && !FARMER_WORDS.test(text);
    if (productAsk) {
      focus.intent = 'products_list';
      const n = topN(text);
      const items = await findProducts({ ratingAvg: -1, ratingCount: -1, totalSold: -1 }, n, { ratingCount: { $gt: 0 } });
      if (items.length) {
        return reply(L(`Top rated ${what}${where}:\n`, `${where ? `${where} ` : ''}سب سے اچھی ریٹنگ والی ${what}:\n`) + productLines(items, stars), { cards: items.slice(0, 5).map(productCard), suggestions: ['Best sellers', 'Top rated farmers'] });
      }
      if (!rated) return null; // "best mangoes" without reviews: the product search answers
    } else if (FARMER_WORDS.test(text) || rated || !MARKET_WORDS.test(text)) {
      focus.intent = 'farmers_list';
      const n = topN(text);
      const pool = localFarmers()
        .filter((f) => f.ratingCount > 0)
        .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount)
        .slice(0, n);
      if (!pool.length) return reply(L(`No farmer${where} has reviews yet.`, `${where ? `${where} ` : ''}ابھی کسی کسان کا جائزہ نہیں۔`));
      const lines = pool.map((f, i) => `${i + 1}. **${f.stallName}**: ${stars(f)}`).join('\n');
      const best = pool[0];
      return reply(
        L(`The highest rated farmer${where} is **${best.stallName}** with ${best.ratingAvg}/5 from ${best.ratingCount} reviews.\n${lines}`, `${where ? `${where} ` : ''}سب سے اچھی ریٹنگ والا کسان **${best.stallName}** ہے، ${best.ratingCount} جائزوں میں ${best.ratingAvg}/5۔\n${lines}`),
        { cards: pool.slice(0, 5).map(farmerCard), suggestions: [`Is ${best.stallName} at the market today?`, 'Best sellers', 'New farmers'] }
      );
    } else {
      // "Best market": the markets with the most farmers
      focus.intent = 'markets_list';
      const ranked = (city ? markets.filter((m) => m.city === city) : markets)
        .map((m) => ({ m, n: farmers.filter((f) => f.markets.some((id) => String(id) === String(m._id))).length }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5);
      return reply(L(`The biggest markets${where} (most farmers):\n`, `${where ? `${where} ` : ''}سب سے بڑی مارکیٹیں (سب سے زیادہ کسان):\n`) + ranked.map(({ m, n }, i) => L(`${i + 1}. **${m.name}**: ${n} farmers`, `${i + 1}. **${m.name}**: ${n} کسان`)).join('\n'), { cards: ranked.map(({ m }) => marketCard(m)) });
    }
  }

  // Cheapest / most expensive
  const cheap = /\b(cheap|cheapest|cheaper|lowest price|low price|budget|affordable|least expensive|sasta|sasti)\b/.test(text);
  const dear = /\b(most expensive|costliest|priciest|highest price|expensive)\b/.test(text);
  if (cheap || dear) {
    focus.intent = 'products_list';
    const items = await findProducts({ price: cheap ? 1 : -1 }, topN(text), { status: PRODUCT_STATUS.AVAILABLE });
    if (!items.length) return reply(L(`I couldn't find ${what} in stock${where}.`, `${where ? `${where} ` : ''}اسٹاک میں ${what} نہیں ملیں۔`));
    const head = cheap ? L(`Cheapest ${what} in stock${where}:\n`, `${where ? `${where} ` : ''}اسٹاک میں سب سے سستی ${what}:\n`) : L(`Most expensive ${what}${where}:\n`, `${where ? `${where} ` : ''}سب سے مہنگی ${what}:\n`);
    return reply(head + productLines(items, (p) => `${money(p.price)} / ${unitName(p.unit)}`), { cards: items.slice(0, 5).map(productCard), suggestions: ['Offers this week', 'Best sellers'] });
  }

  // Offers and discounts
  if (/\b(offer|offers|discount|discounts|deal|deals|sale|promo|promotion|coupon|percent off|% off)\b/.test(text)) {
    focus.intent = 'products_list';
    const items = await Product.aggregate([
      { $match: { ...scope, status: PRODUCT_STATUS.AVAILABLE, $expr: { $gt: ['$compareAtPrice', '$price'] } } },
      { $addFields: { off: { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$compareAtPrice', '$price'] }, '$compareAtPrice'] }, 100] }, 0] } } },
      { $sort: { off: -1, totalSold: -1 } },
      { $limit: 5 },
    ]);
    await Product.populate(items, { path: 'farmer', select: 'stallName slug' });
    if (!items.length) return reply(L(`There are no discounts${where} this week. Farmers set their own prices, so check back after the weekly restock.`, `اس ہفتے${where} کوئی رعایت نہیں۔ کسان اپنی قیمت خود رکھتے ہیں، ہفتہ وار اسٹاک کے بعد دوبارہ دیکھیں۔`), { suggestions: ['Cheapest vegetables', 'Best sellers'] });
    return reply(L(`This week's offers${where}:\n`, `اس ہفتے${where} کی رعایتیں:\n`) + productLines(items, (p) => L(`${p.off}% off, ${money(p.price)} instead of ${money(p.compareAtPrice)}`, `${p.off}% کم، ${money(p.compareAtPrice)} کے بجائے ${money(p.price)}`)), {
      cards: items.map(productCard),
      suggestions: ['Best sellers', 'Cheapest fruits'],
    });
  }

  // New farmers and new products
  const newAsk = /\b(new|newest|latest|recent|recently|just)\b/.test(text);
  if (newAsk && (FARMER_WORDS.test(text) || /\bjoined\b/.test(text))) {
    focus.intent = 'farmers_list';
    const pool = await Farmer.find({ isActive: true, ...(market ? { markets: market._id } : {}) })
      .select('stallName slug logo operatingDays ratingAvg ratingCount createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    const joined = (f) => f.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const lines = pool.map((f) => L(`• **${f.stallName}**: joined ${joined(f)}`, `• **${f.stallName}**: ${joined(f)} کو شامل ہوا`)).join('\n');
    return reply(L(`The newest farmers${where}:\n${lines}`, `${where ? `${where} ` : ''}نئے کسان:\n${lines}`), { cards: pool.map(farmerCard), suggestions: ['Top rated farmers', 'How many farmers are there?'] });
  }
  if (newAsk && (!MARKET_WORDS.test(text) || /\b(products?|items?|arrivals?)\b/.test(text))) {
    focus.intent = 'products_list';
    const items = await findProducts({ createdAt: -1 }, 5, { status: PRODUCT_STATUS.AVAILABLE });
    if (items.length) return reply(L(`Newly added ${what}${where}:\n`, `${where ? `${where} ` : ''}نئی شامل ہونے والی ${what}:\n`) + productLines(items, (p) => `${money(p.price)} / ${unitName(p.unit)}`), { cards: items.map(productCard) });
  }

  // Categories: "what can I buy?"
  if (/\bcategor(y|ies)\b|\bwhat (can i buy|do you sell|do they sell|is sold)\b|\b(kinds?|types?) of (products?|things|food)\b/.test(text) && !words.length) {
    const counts = await Product.aggregate([{ $match: { ...Product.publicFilter(), status: PRODUCT_STATUS.AVAILABLE } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
    const n = (c) => counts.find((x) => String(x._id) === String(c._id))?.n || 0;
    const lines = categories.map((c) => L(`• **${categoryName(c)}**: ${n(c)} in stock`, `• **${categoryName(c)}**: ${n(c)} اسٹاک میں`)).join('\n');
    return reply(L(`You can pre-order from these categories:\n${lines}`, `آپ ان زمروں سے پیشگی آرڈر دے سکتے ہیں:\n${lines}`), {
      cards: categories.slice(0, 6).map((c) => ({ kind: 'link', id: String(c._id), title: categoryName(c), subtitle: L(`${n(c)} in stock`, `${n(c)} اسٹاک میں`), link: `/products?category=${c.slug}` })),
      suggestions: ['Best sellers', 'Offers this week'],
    });
  }
  return null;
}

/** Answers one message. Returns { reply, cards, suggestions, memory }. */
export async function answer(rawMessage, user, rawMemory = {}, options = {}) {
  const memory = cleanMemory(rawMemory);
  const message = String(rawMessage || '').trim().slice(0, 300);
  // Answers in Urdu when the site is in Urdu or the question is written in Urdu
  const lang = options.lang === 'ur' || isUrduText(message) ? 'ur' : 'en';
  return language.run(lang, () => answerIn(message, user, memory));
}

async function answerIn(rawMessage, user, memory) {
  let message = rawMessage;
  if (!message) return { ...reply(L('Please type a question, for example "When is the Clifton market open?"', 'براہِ کرم اپنا سوال لکھیں، مثلاً “کلفٹن مارکیٹ کب کھلتی ہے؟”')), memory };
  if (isUrduText(message)) {
    const products = await Product.find({ ...Product.publicFilter(), nameUr: { $exists: true, $ne: '' } }).select('name nameUr').lean();
    message = urduToEnglish(message, products) || message;
  }
  // Roman Urdu / Hinglish words ("sab se acha kisan kaunsa hai") become the English keywords the rules read
  message = romanToEnglish(message) || message;
  const focus = {}; // what this answer is about - becomes the memory for the next question
  const result = await respond(message, user, memory, focus);
  const next = focus.forget ? {} : { ...memory };
  if (!focus.forget) {
    if (focus.market) Object.assign(next, { marketId: String(focus.market._id), marketName: focus.market.name });
    if (focus.farmer) Object.assign(next, { farmerId: String(focus.farmer._id), farmerName: focus.farmer.stallName });
    if (focus.product) Object.assign(next, { productId: String(focus.product._id), productName: focus.product.name });
    if (focus.day !== undefined && focus.day !== null) next.day = focus.day;
    if (focus.city) next.city = focus.city;
    if (focus.name) next.name = focus.name;
    if (focus.intent) next.lastIntent = focus.intent;
  }
  return { ...result, memory: cleanMemory(next) };
}

async function respond(message, user, memory, focus) {
  const text = message.toLowerCase();

  const [markets, farmers, categories] = await Promise.all([
    Market.find({ isActive: true }).select('name slug city address operatingDays openTime closeTime image').lean(),
    Farmer.find({ isActive: true }).select('stallName slug logo operatingDays pickupWindows markets blockedDates checkIn ratingAvg ratingCount orderCutoffHours').populate('pickupWindows.market', 'name').lean(),
    Category.find({ isActive: true }).select('name nameUr slug').lean(),
  ]);
  let market = matchEntity(text, markets, (m) => m.name);
  let farmer = matchEntity(text, farmers, (f) => f.stallName);
  // "where can I buy honey" is a product question even though a farmer is called "... Honey ..."
  const shopping = /\b(buy|where|find|price|cost|get)\b/.test(text) && !/\b(farmer|farm|stall|vendor)\b/.test(text);
  if (farmer && farmer.matchScore === 1 && shopping) farmer = null;
  // Remove the recognised names so "Thatta Dairy" is not also read as the "Dairy" category
  let rest = text;
  for (const name of [farmer?.stallName, market?.name].filter(Boolean)) {
    for (const w of tokens(name)) rest = rest.replace(new RegExp(`\\b${escapeRegex(w)}\\b`, 'g'), ' ');
  }
  const category = categories.find((c) => rest.includes(c.name.toLowerCase()) || tokens(c.name).some((w) => w.length > 4 && rest.includes(w)));
  const day = detectDay(text);
  const cities = [...new Set(markets.map((m) => m.city).filter(Boolean))];
  const city = cities.find((c) => new RegExp(`\\b${escapeRegex(c.toLowerCase())}\\b`).test(text));
  if (city) focus.city = city;
  // "top rated fruits in Karachi" is about the city, not the farmer called "Karachi Artisan Bakehouse"
  if (farmer && farmer.matchScore === 1 && city && tokens(farmer.stallName).includes(city.toLowerCase())) farmer = null;
  const firstName = memory.name || (user ? user.name.split(' ')[0] : '');

  // --- memory: what the user tells the assistant about themselves ----------
  const nameMatch = message.match(/\b(?:my name is|my name's|call me|mera naam)\s+([a-z\u0600-\u06ff][a-z\u0600-\u06ff'-]{1,20}(?:\s[a-z\u0600-\u06ff][a-z\u0600-\u06ff'-]{1,20})?)/i);
  if (nameMatch) {
    focus.name = title(nameMatch[1].replace(/\s+(hai|he|and|aur)$/i, ''));
    focus.intent = 'memory';
    return reply(L(`Nice to meet you, ${focus.name}! I'll remember your name while we chat.`, `آپ سے مل کر خوشی ہوئی، ${focus.name}! بات چیت کے دوران مجھے آپ کا نام یاد رہے گا۔`), { suggestions: ['Market timings', 'What do you remember?'] });
  }
  if (/\b(what('| i)?s my name|do you know my name|who am i)\b/.test(text)) {
    return reply(firstName ? L(`You're ${firstName}.`, `آپ ${firstName} ہیں۔`) : L("You haven't told me your name yet. Say \"My name is ...\" and I'll remember it.", 'آپ نے ابھی تک اپنا نام نہیں بتایا۔ “میرا نام ... ہے” لکھیں، مجھے یاد رہے گا۔'));
  }
  if (/\b(forget (everything|me|it all|what i said)|clear (your )?memory|reset (your )?memory)\b/.test(text)) {
    focus.forget = true;
    return reply(L("Done. I've forgotten what we talked about. Your chat history stays until you press Clear chat.", 'ٹھیک ہے، ہماری باتیں میں بھول گیا ہوں۔ آپ کی چیٹ تب تک رہے گی جب تک آپ “چیٹ صاف کریں” نہ دبائیں۔'));
  }
  if (/\bwhat (do|did) you (remember|know about me)\b|\byour memory\b/.test(text)) {
    const facts = [
      firstName && L(`your name is **${firstName}**`, `آپ کا نام **${firstName}** ہے`),
      memory.city && L(`you are in **${memory.city}**`, `آپ **${cityName(memory.city)}** میں ہیں`),
      memory.marketName && L(`we talked about **${memory.marketName}**`, `ہم نے **${memory.marketName}** کی بات کی`),
      memory.farmerName && L(`the farmer **${memory.farmerName}**`, `کسان **${memory.farmerName}**`),
      memory.productName && L(`the product **${memory.productName}**`, `چیز **${memory.productName}**`),
    ].filter(Boolean);
    if (!facts.length) return reply(L("I don't remember anything yet. Ask me about a market, farmer or product and I'll keep track of it.", 'مجھے ابھی کچھ یاد نہیں۔ کسی مارکیٹ، کسان یا چیز کے بارے میں پوچھیں، میں یاد رکھوں گا۔'));
    return reply(L(`Here is what I remember: ${facts.join(', ')}. Say "forget everything" to clear it.`, `مجھے یہ یاد ہے: ${facts.join('، ')}۔ سب مٹانے کے لیے “سب بھول جاؤ” لکھیں۔`));
  }
  if (city && /\b(i live|i am in|i'm in|im in|i stay|i am from|i'm from|rehta|rehti)\b/.test(text)) {
    const local = markets.filter((m) => m.city === city);
    focus.intent = 'markets_list';
    const lines = local.map((m) => `• **${m.name}**: ${fmtDays(m.operatingDays)}${L(', ', '، ')}${hours(m.openTime, m.closeTime)}`).join('\n');
    return reply(L(`Got it, I'll remember that you're in ${city}. Markets in ${city}:\n${lines}`, `ٹھیک ہے، مجھے یاد رہے گا کہ آپ ${cityName(city)} میں ہیں۔ ${cityName(city)} کی مارکیٹیں:\n${lines}`), {
      cards: local.slice(0, 6).map(marketCard),
    });
  }

  // --- follow-up questions use what the conversation was about -------------
  const followUp = FOLLOW_UP.test(text);
  const mentioned = Boolean(market || farmer); // named in this message (before memory fills anything in)
  const byId = (list, id) => (id ? list.find((x) => String(x._id) === id) : null);
  if (followUp && !market && !farmer) {
    if (['market', 'farmers_list'].includes(memory.lastIntent)) market = byId(markets, memory.marketId);
    if (['farmer', 'pickup', 'product'].includes(memory.lastIntent)) farmer = byId(farmers, memory.farmerId);
  }
  const productFocus = followUp && memory.lastIntent === 'product' && memory.productId ? memory.productId : null;

  // "What about Sunday?" repeats the last question for another day
  const onlyDay = day !== null && !mentioned && tokens(rest).filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !DAY_NAMES.some((d) => d.toLowerCase().startsWith(w))).length === 0;
  if (onlyDay && memory.lastIntent) {
    const lastMarket = byId(markets, memory.marketId);
    const lastFarmer = byId(farmers, memory.farmerId);
    if (memory.lastIntent === 'market' && lastMarket) {
      Object.assign(focus, { market: lastMarket, day, intent: 'market' });
      const open = lastMarket.operatingDays.includes(day);
      const text = open
        ? L(`**${lastMarket.name}** is open on ${DAY_NAMES[day]} from ${lastMarket.openTime} to ${lastMarket.closeTime}.`, `**${lastMarket.name}** ${DAY_UR[day]} کو ${lastMarket.openTime} سے ${lastMarket.closeTime} تک کھلی ہے۔`)
        : L(`**${lastMarket.name}** is closed on ${DAY_NAMES[day]}. It opens on ${fmtDays(lastMarket.operatingDays)}.`, `**${lastMarket.name}** ${DAY_UR[day]} کو بند ہے۔ یہ ان دنوں کھلتی ہے: ${fmtDays(lastMarket.operatingDays)}۔`);
      return reply(text, { cards: [marketCard(lastMarket)] });
    }
    if (memory.lastIntent === 'farmer' && lastFarmer) {
      Object.assign(focus, { farmer: lastFarmer, day, intent: 'farmer' });
      const there = lastFarmer.pickupWindows.filter((w) => w.day === day);
      const where = list(there.map((w) => `${w.market?.name} (${hours(w.start, w.end)})`));
      const text = there.length
        ? L(`Yes, **${lastFarmer.stallName}** is at ${where} on ${DAY_NAMES[day]}.`, `جی ہاں، **${lastFarmer.stallName}** ${DAY_UR[day]} کو ${where} میں ہوتا ہے۔`) + closedNote(lastFarmer)
        : L(`**${lastFarmer.stallName}** is not at a market on ${DAY_NAMES[day]}. They sell on ${fmtDays(lastFarmer.operatingDays)}.`, `**${lastFarmer.stallName}** ${DAY_UR[day]} کو کسی مارکیٹ میں نہیں ہوتا۔ فروخت کے دن: ${fmtDays(lastFarmer.operatingDays)}۔`);
      return reply(text, { cards: [farmerCard(lastFarmer)] });
    }
    if (memory.lastIntent === 'farmers_list' && lastMarket) market = lastMarket;
  }

  // --- small talk & FAQs -------------------------------------------------
  if (/^(hi|hello|hey|salam|assalam|aoa|good (morning|afternoon|evening))\b/.test(text)) {
    return reply(L(`Hello${firstName ? ` ${firstName}` : ''}! I'm the MarketLink assistant. Ask me about market timings, farmer availability, pickup windows or where to find a product.`, `السلام علیکم${firstName ? ` ${firstName}` : ''}! میں MarketLink کا اسسٹنٹ ہوں۔ مجھ سے مارکیٹ کے اوقات، کسانوں کی دستیابی، وصولی کے اوقات یا کسی چیز کے ملنے کی جگہ کے بارے میں پوچھیں۔`));
  }
  if (has(text, ['thank', 'thanks', 'shukriya'])) return reply(L('You are welcome! Happy shopping at the market.', 'کوئی بات نہیں! مارکیٹ میں خریداری مبارک ہو۔'));
  // --- site knowledge: rankings, best sellers, prices, offers, counts, account help ---
  const site = await siteAnswer({ text, rest, markets, farmers, categories, market, farmer, category, city, user, focus });
  if (site) return site;

  if (has(text, ['pay', 'payment', 'cash', 'card', 'online payment'])) {
    return reply(L('MarketLink has no online payment. You pre-order here and pay the farmer in person when you pick up your order at the market (cash or whatever the farmer accepts).', 'MarketLink پر آن لائن ادائیگی نہیں ہوتی۔ آپ یہاں پیشگی آرڈر دیتے ہیں اور مارکیٹ سے آرڈر وصول کرتے وقت کسان کو خود ادائیگی کرتے ہیں (نقد یا جو طریقہ کسان قبول کرے)۔'));
  }
  if (has(text, ['deliver', 'delivery', 'shipping', 'courier', 'home delivery'])) {
    return reply(L('We do not deliver. MarketLink is pickup-only: choose a pickup date and time slot at checkout and collect your order at the farmer\'s stall.', 'ہم ڈیلیوری نہیں کرتے۔ MarketLink پر صرف وصولی کی سہولت ہے: آرڈر مکمل کرتے وقت وصولی کی تاریخ اور وقت چنیں اور کسان کے اسٹال سے اپنا آرڈر وصول کریں۔'));
  }
  if (has(text, ['cancel', 'modify', 'change my order', 'edit my order', 'edit order'])) {
    return reply(L('You can modify or cancel a pre-order from **My Orders** until the farmer\'s cut-off time (usually a few hours before your pickup slot). After the cut-off the order is locked.', 'کسان کے آخری وقت تک (عموماً وصولی سے چند گھنٹے پہلے) آپ **میرے آرڈر** سے پیشگی آرڈر بدل یا منسوخ کر سکتے ہیں۔ آخری وقت کے بعد آرڈر میں تبدیلی نہیں ہو سکتی۔'), {
      suggestions: ['Track my order', 'Pickup windows', 'How do I pay?'],
    });
  }
  if (has(text, ['sell', 'become a farmer', 'register my stall', 'vendor account', 'list my'])) {
    return reply(L('Farmers can register from **Sell on MarketLink** (Register as Farmer). After an admin approves your stall you can publish weekly stock, set pickup windows and manage pre-orders.', 'کسان **ہمارے ساتھ فروخت کریں** سے رجسٹر ہو سکتے ہیں۔ ایڈمن کی منظوری کے بعد آپ ہفتہ وار اسٹاک شائع کر سکتے ہیں، وصولی کے اوقات مقرر کر سکتے ہیں اور پیشگی آرڈر سنبھال سکتے ہیں۔'));
  }
  if (/how (do|can|to) (i )?(order|pre-?order|buy|shop)/.test(text) || has(text, ['how does it work', 'how it works'])) {
    return reply(L('1. Browse products or farmers and add items to your cart.\n2. At checkout pick a pickup date & time slot for each farmer.\n3. The farmer accepts your order and marks it ready.\n4. Collect it at the market and pay at pickup.', '1۔ اشیاء یا کسان دیکھیں اور چیزیں اپنی ٹوکری میں ڈالیں۔\n2۔ آرڈر مکمل کرتے وقت ہر کسان کے لیے وصولی کی تاریخ اور وقت چنیں۔\n3۔ کسان آپ کا آرڈر منظور کر کے تیار کرتا ہے۔\n4۔ مارکیٹ سے آرڈر وصول کریں اور وہیں ادائیگی کریں۔'));
  }

  // --- my orders -----------------------------------------------------------
  if (has(text, ['my order', 'my orders', 'order status', 'track', 'where is my order'])) {
    if (!user || user.role !== ROLES.CUSTOMER) return reply(L('Please log in as a customer to see your orders. After logging in, open **My Orders** from your account menu.', 'اپنے آرڈر دیکھنے کے لیے براہِ کرم گاہک کے طور پر لاگ اِن کریں۔ لاگ اِن کے بعد اکاؤنٹ مینو سے **میرے آرڈر** کھولیں۔'));
    const orders = await Order.find({ customer: user._id, status: { $in: OPEN_ORDER_STATUSES } }).populate('farmer', 'stallName').sort({ pickupAt: 1 }).limit(5).lean();
    if (!orders.length) return reply(L('You have no active pre-orders right now. Browse the shop to place one!', 'اس وقت آپ کا کوئی جاری پیشگی آرڈر نہیں۔ دکان دیکھیں اور آرڈر دیں!'));
    const status = (o) => L(o.status, STATUS_UR[o.status] || o.status);
    const lines = orders.map((o) => L(`• **${o.orderNumber}**: ${o.farmer?.stallName}: *${o.status}*, pickup ${o.pickupDate} at ${o.pickupSlot.start}`, `• **${o.orderNumber}**: ${o.farmer?.stallName}: *${status(o)}*، وصولی ${o.pickupDate} کو ${o.pickupSlot.start} بجے`));
    return reply(L(`Here are your active pre-orders:\n${lines.join('\n')}`, `آپ کے جاری پیشگی آرڈر یہ ہیں:\n${lines.join('\n')}`), {
      cards: orders.map((o) => ({ kind: 'order', id: String(o._id), title: o.orderNumber, subtitle: `${status(o)} · ${o.pickupDate} ${o.pickupSlot.start}`, link: `/account/orders/${o._id}` })),
    });
  }

  // --- market timings ------------------------------------------------------
  const repeatList = onlyDay && memory.lastIntent === 'markets_list';
  const asksTiming = has(text, ['time', 'timing', 'open', 'close', 'hours', 'when', 'schedule', 'days']) || repeatList;
  if (asksTiming && (market || has(text, ['market', 'bazaar']) || repeatList)) {
    if (market) {
      Object.assign(focus, { market, intent: 'market' });
      return reply(L(`**${market.name}** is open on ${fmtDays(market.operatingDays)} from ${market.openTime} to ${market.closeTime}.`, `**${market.name}** ان دنوں ${market.openTime} سے ${market.closeTime} تک کھلی ہے: ${fmtDays(market.operatingDays)}۔`) + `\n{{icon:geo-alt}} ${market.address}`, {
        cards: [marketCard(market)],
        suggestions: ['Which farmers are there?', 'What about Sunday?', 'Market timings'],
      });
    }
    // Use the city the user mentioned now or earlier (unless they ask for "all" markets)
    let where = city || (has(text, ['all']) ? null : memory.city);
    let pool = where ? markets.filter((m) => m.city === where) : markets;
    if (!pool.length) {
      pool = markets;
      where = null;
    }
    Object.assign(focus, { intent: 'markets_list', day });
    const open = (day !== null ? pool.filter((m) => m.operatingDays.includes(day)) : pool).slice(0, 6);
    if (!open.length) return reply(L(`No market${where ? ` in ${where}` : ''} is open on ${DAY_NAMES[day]}.`, `${DAY_UR[day]} کو ${where ? `${cityName(where)} میں ` : ''}کوئی مارکیٹ نہیں کھلتی۔`));
    const heading =
      day !== null
        ? L(`Markets open on ${DAY_NAMES[day]}${where ? ` in ${where}` : ''}`, `${where ? `${cityName(where)} میں ` : ''}${DAY_UR[day]} کو کھلنے والی مارکیٹیں`)
        : L(`Market timings${where ? ` in ${where}` : ''}`, `${where ? `${cityName(where)} کی ` : ''}مارکیٹوں کے اوقات`);
    return reply(`${heading}:\n${open.map((m) => `• **${m.name}**: ${fmtDays(m.operatingDays)}${L(', ', '، ')}${hours(m.openTime, m.closeTime)}`).join('\n')}`, {
      cards: open.map(marketCard),
    });
  }

  // --- pickup windows ------------------------------------------------------
  if (has(text, ['pickup', 'pick up', 'collect', 'slot', 'window']) || /\bpick\s+(it|them|this|that|these|those)\s+up\b/.test(text)) {
    if (farmer) {
      Object.assign(focus, { farmer, intent: 'pickup' });
      const lines = farmer.pickupWindows.map((w) => L(`• ${DAY_NAMES[w.day]} ${w.start}-${w.end} at ${w.market?.name || 'market'}`, `• ${DAY_UR[w.day]} ${hours(w.start, w.end)}، ${w.market?.name || 'مارکیٹ'}`));
      const none = L('No pickup windows published yet.', 'ابھی وصولی کے اوقات شائع نہیں ہوئے۔');
      return reply(
        L(
          `Pickup windows for **${farmer.stallName}**:\n${lines.join('\n') || none}\nOrders close ${farmer.orderCutoffHours} hour(s) before the slot starts.`,
          `**${farmer.stallName}** کے وصولی کے اوقات:\n${lines.join('\n') || none}\nآرڈر وصولی کا وقت شروع ہونے سے ${farmer.orderCutoffHours} گھنٹے پہلے بند ہو جاتے ہیں۔`
        ) + closedNote(farmer),
        { cards: [farmerCard(farmer)] }
      );
    }
    return reply(L('Each farmer publishes pickup windows (for example Saturday 08:00-12:00) split into short time slots. You choose a slot at checkout, and can change it until the cut-off time. Ask me "pickup windows for <farmer name>" for details.', 'ہر کسان وصولی کے اوقات شائع کرتا ہے (مثلاً ہفتہ 08:00 تا 12:00) جو چھوٹے وقت کے خانوں میں تقسیم ہوتے ہیں۔ آرڈر مکمل کرتے وقت آپ ایک وقت چنتے ہیں اور آخری وقت تک اسے بدل سکتے ہیں۔ تفصیل کے لیے کسی کسان کا نام لے کر اس کے وصولی کے اوقات پوچھیں۔'), {
      suggestions: farmers.slice(0, 3).map((f) => `Pickup windows for ${f.stallName}`),
    });
  }

  // --- follow-up about the product we just talked about ("how much is it?") ---
  const productWords = tokens(rest).filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !DAY_NAMES.some((d) => d.toLowerCase().startsWith(w)));
  if (productFocus && !productWords.length && !category) {
    const mode = has(text, ['stock', 'left', 'available', 'sold out']) ? 'stock' : has(text, ['price', 'cost', 'how much', 'rate']) ? 'price' : 'full';
    const details = await productDetails(productFocus, focus, mode);
    if (details) return details;
  }

  // --- farmer availability -------------------------------------------------
  if (farmer && (category || productWords.length)) {
    const found = await searchProducts(productWords, category?._id, farmer._id);
    if (found.length) {
      Object.assign(focus, { farmer, intent: 'farmer' });
      const lines = found.map((p) => `• **${productName(p)}**: ${money(p.price)}/${unitName(p.unit)}${p.status === PRODUCT_STATUS.AVAILABLE ? L(` (${p.quantityAvailable} left)`, ` (${p.quantityAvailable} باقی)`) : L(' (sold out)', ' (ختم)')}`).join('\n');
      return reply(L(`${farmer.stallName} has:\n${lines}`, `${farmer.stallName} کے پاس یہ ہے:\n${lines}`), {
        cards: found.map(productCard),
      });
    }
  }
  if (farmer) {
    Object.assign(focus, { farmer, intent: 'farmer' });
    const inStock = await Product.countDocuments({ ...Product.publicFilter(), farmer: farmer._id, status: PRODUCT_STATUS.AVAILABLE });
    const marketNames = [...new Set(farmer.pickupWindows.map((w) => w.market?.name).filter(Boolean))];
    return reply(
      L(
        `**${farmer.stallName}** sells on ${fmtDays(farmer.operatingDays)}${marketNames.length ? ` at ${marketNames.join(', ')}` : ''}. They currently have ${inStock} product(s) in stock.`,
        `**${farmer.stallName}** ${marketNames.length ? `${list(marketNames)} میں ` : ''}ان دنوں فروخت کرتا ہے: ${fmtDays(farmer.operatingDays)}۔ اس وقت ${inStock} اشیاء اسٹاک میں ہیں۔`
      ) + closedNote(farmer),
      { cards: [farmerCard(farmer)], suggestions: [`Pickup windows for ${farmer.stallName}`, 'Market timings'] }
    );
  }
  const repeatFarmers = onlyDay && memory.lastIntent === 'farmers_list';
  if ((has(text, ['farmer', 'farmers', 'stall', 'vendor', 'who', 'which']) || repeatFarmers) && (market || day !== null)) {
    Object.assign(focus, { market, day, intent: 'farmers_list' });
    let sellers = farmers;
    if (market) sellers = sellers.filter((f) => f.markets.some((m) => String(m) === String(market._id)));
    if (day !== null) sellers = sellers.filter((f) => f.operatingDays.includes(day));
    // Today: leave out the farmers who said they cannot come
    if (day === new Date().getDay()) sellers = sellers.filter((f) => !(f.blockedDates || []).includes(toDateKey()));
    const where = L(
      [market ? `at ${market.name}` : '', day !== null ? `on ${DAY_NAMES[day]}` : ''].filter(Boolean).join(' '),
      [market ? `${market.name} میں` : '', day !== null ? `${DAY_UR[day]} کو` : ''].filter(Boolean).join(' ')
    );
    if (!sellers.length) return reply(L(`I couldn't find farmers ${where}.`, `${where} کوئی کسان نہیں ملا۔`));
    const lines = sellers.slice(0, 6).map((f) => `• **${f.stallName}**: ${fmtDays(f.operatingDays)}`).join('\n');
    return reply(L(`Farmers ${where}:\n${lines}`, `${where} کسان:\n${lines}`), { cards: sellers.slice(0, 6).map(farmerCard) });
  }

  // --- product search ------------------------------------------------------
  const words = tokens(text).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const marketAnswer = () => {
    Object.assign(focus, { market, intent: 'market' });
    return reply(`**${market.name}**: ${fmtDays(market.operatingDays)}${L(', ', '، ')}${hours(market.openTime, market.closeTime)}${L('.', '۔')} {{icon:geo-alt}} ${market.address}`, {
      cards: [marketCard(market)],
      suggestions: ['Which farmers are there?', 'Market timings', 'How do I pay?'],
    });
  };
  // A follow-up such as "tell me more about it" about a market should not turn into a product search
  if (market && !words.length && !category) return marketAnswer();
  const products = (await searchProducts(words, category?._id)).sort((a, b) => nameScore(b, words) - nameScore(a, words));

  // Product details: "tell me about Sindhri mangoes" or a single clear match
  const wantsDetails = /\b(about|detail|details|describe|info|information|what is|tell me)\b/.test(text);
  const top = products[0];
  if (top && (products.length === 1 || (wantsDetails && nameScore(top, words) >= 2))) {
    const details = await productDetails(top._id, focus);
    if (details) return details;
  }

  if (products.length) {
    focus.intent = 'products_list';
    const lines = products.map((p) => L(`• **${p.name}**: ${money(p.price)}/${p.unit} from ${p.farmer?.stallName}`, `• **${productName(p)}**: ${money(p.price)}/${unitName(p.unit)}، ${p.farmer?.stallName} سے`) + (p.status === PRODUCT_STATUS.AVAILABLE ? L(` (${p.quantityAvailable} left)`, ` (${p.quantityAvailable} باقی)`) : L(' (sold out)', ' (ختم)')));
    return reply(L(`Here is what I found${category ? ` in ${category.name}` : ''}:\n${lines.join('\n')}`, `${category ? `${categoryName(category)} میں ` : ''}مجھے یہ ملا:\n${lines.join('\n')}`), { cards: products.map(productCard) });
  }
  if (market) return marketAnswer();

  return reply(L("Sorry, I couldn't find an answer for that. Try asking about market timings, a farmer's availability, pickup windows, or a product such as \"mangoes\" or \"honey\".", 'معذرت، مجھے اس کا جواب نہیں ملا۔ مارکیٹ کے اوقات، کسان کی دستیابی، وصولی کے اوقات یا کسی چیز (جیسے “آم” یا “شہد”) کے بارے میں پوچھ کر دیکھیں۔'));
}
