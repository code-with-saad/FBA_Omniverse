import { Category, Farmer, Market, MarketDayLog, Order, Product, Review, User } from '../models/index.js';
import { ABSENCE_REASONS } from '../models/MarketDayLog.js';
import AppError from '../utils/AppError.js';
import { checkQuantityRules } from '../utils/quantity.js';
import { ORDER_STATUS, OPEN_ORDER_STATUSES, PRODUCT_STATUS, UNITS, USER_STATUS } from '../utils/constants.js';
import { assertId, containsRegex, getPagination, isValidId, pick, round2, toBool, toNumber } from '../utils/helpers.js';
import { addDays, isDateKey, isTime, startOfDay, timeToMinutes, toDateKey } from '../utils/dates.js';
import { uniqueSlug } from '../utils/slug.js';
import { fileUrl } from '../middleware/upload.js';
import { applyWeeklyTemplate, notifyRestock, releaseItems, syncFarmerProducts } from '../services/stock.js';
import { notify, notifyMany } from '../services/notify.js';
import { pickupDetails, pushStatus } from '../services/orders.js';
import { readFarmDetails } from './helpers/farmDetails.js';
import { resolveCity } from './adminToolsController.js';
import { checkLowStock, orderMovements, recordMovements } from '../services/inventory.js';
import { ensureProductSchema, generateProductSchema, refreshProductSchema } from '../services/productSchema.js';

// ---------------------------------------------------------------- profile

// GET /api/farmer/me
export async function getMyFarm(req, res) {
  await req.farmer.populate([
    { path: 'markets', select: 'name slug address latitude longitude operatingDays openTime closeTime' },
    { path: 'pickupWindows.market', select: 'name slug' },
    { path: 'categories', select: 'name slug icon color' },
  ]);
  res.json({ farmer: req.farmer, status: req.user.status });
}

// PUT /api/farmer/profile  (multipart: logo, coverImage)
export async function updateFarmProfile(req, res) {
  const farmer = req.farmer;
  const body = pick(req.body, ['stallName', 'contactPerson', 'phone', 'address', 'city']);
  for (const key of ['stallName', 'contactPerson', 'phone', 'address']) {
    if (key in body && !String(body[key]).trim()) throw new AppError(`${key} cannot be empty`, 400);
  }
  if ('city' in body) body.city = await resolveCity(body.city); // from the cities table
  if (body.stallName && body.stallName !== farmer.stallName) farmer.slug = await uniqueSlug(Farmer, body.stallName, farmer._id);
  Object.assign(farmer, body);

  // bio, practices, categories grown, markets and map pin
  const details = await readFarmDetails(req.body);
  if (details.markets) delete details.markets; // markets are managed on the pickup page
  Object.assign(farmer, details);
  if (req.files?.logo?.[0]) farmer.logo = fileUrl('farmers', req.files.logo[0]);
  if (req.files?.coverImage?.[0]) farmer.coverImage = fileUrl('farmers', req.files.coverImage[0]);
  await farmer.save();

  // Keep the user's display name / phone in sync with the stall contact details
  if (body.contactPerson) req.user.name = body.contactPerson;
  if (body.phone) req.user.phone = body.phone;
  if (body.address) req.user.address = body.address;
  await req.user.save();

  return getMyFarm(req, res);
}

// PUT /api/farmer/pickup  { markets, pickupWindows, slotMinutes, slotCapacity, orderCutoffHours, blockedDates }
export async function updatePickupSettings(req, res) {
  const farmer = req.farmer;
  const marketIds = (Array.isArray(req.body.markets) ? req.body.markets : []).map(String).filter(isValidId);
  const windows = Array.isArray(req.body.pickupWindows) ? req.body.pickupWindows : [];

  const allMarketIds = [...new Set([...marketIds, ...windows.map((w) => String(w.market))])];
  const found = await Market.find({ _id: { $in: allMarketIds.filter(isValidId) }, isActive: true }).select('_id').lean();
  if (found.length !== allMarketIds.length) throw new AppError('One of the selected markets does not exist', 400);

  const cleanWindows = windows.map((w) => {
    const day = Number(w.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new AppError('Invalid day in pickup window', 400);
    if (!isTime(w.start) || !isTime(w.end) || timeToMinutes(w.end) <= timeToMinutes(w.start)) {
      throw new AppError('Each pickup window needs a valid start and end time (end after start)', 400);
    }
    return { market: String(w.market), day, start: w.start, end: w.end };
  });

  farmer.markets = allMarketIds;
  farmer.pickupWindows = cleanWindows;
  const slotMinutes = toNumber(req.body.slotMinutes);
  const slotCapacity = toNumber(req.body.slotCapacity);
  const cutoff = toNumber(req.body.orderCutoffHours);
  if (slotMinutes !== undefined) farmer.slotMinutes = slotMinutes;
  if (slotCapacity !== undefined) farmer.slotCapacity = slotCapacity;
  if (cutoff !== undefined) farmer.orderCutoffHours = cutoff;

  // Dates the farmer will not be at any market ("closed this week")
  if (Array.isArray(req.body.blockedDates)) {
    const dates = req.body.blockedDates.map(String);
    if (dates.some((d) => !isDateKey(d))) throw new AppError('Closed dates must be valid dates', 400);
    if (dates.length > 60) throw new AppError('You can block at most 60 dates', 400);
    const before = new Set(farmer.blockedDates || []);
    farmer.blockedDates = dates;
    // closed dates are absences in the admin's attendance report (the reason is "closed date")
    const added = dates.filter((d) => !before.has(d));
    const removed = [...before].filter((d) => !dates.includes(d));
    for (const d of added) await MarketDayLog.updateOne({ farmer: farmer._id, date: d }, { $setOnInsert: { status: 'away', reason: 'closed_date', at: new Date() } }, { upsert: true });
    if (removed.length) await MarketDayLog.deleteMany({ farmer: farmer._id, date: { $in: removed }, status: 'away', reason: 'closed_date' });
  }
  await farmer.save();
  await syncFarmerProducts(farmer);

  // Open pre-orders that fall on a closed date must be handled by the farmer
  const clashes = farmer.blockedDates.length
    ? await Order.countDocuments({ farmer: farmer._id, status: { $in: OPEN_ORDER_STATUSES }, pickupDate: { $in: farmer.blockedDates } })
    : 0;
  await farmer.populate([
    { path: 'markets', select: 'name slug address latitude longitude operatingDays openTime closeTime' },
    { path: 'pickupWindows.market', select: 'name slug' },
  ]);
  res.json({ farmer, status: req.user.status, clashes });
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// POST /api/farmer/market-day  { date: 'YYYY-MM-DD', status: 'here' | 'away' | 'normal' }
// The farmer tells customers about a market day:
//  - here:   "I'm at the market" (today only), customers see "At the market now, checked in at 8:10 am"
//  - away:   "I cannot come" (today or a coming day), the date is closed and customers with a pickup that day are told
//  - normal: undo either of them
export async function setMarketDay(req, res) {
  const farmer = req.farmer;
  const today = toDateKey();
  const date = req.body.date ? String(req.body.date) : today;
  const { status } = req.body;
  if (!isDateKey(date)) throw new AppError('Please choose a valid date', 400);
  if (!['here', 'away', 'normal'].includes(status)) throw new AppError('Choose here, away or normal', 400);
  if (date < today) throw new AppError('This day is already over', 400);
  if (date > toDateKey(addDays(new Date(), 60))) throw new AppError('You can plan 60 days ahead at most', 400);
  if (status === 'here' && date !== today) throw new AppError('You can only check in on the day itself, at the market', 400);
  const reason = status === 'away' ? String(req.body.reason || '') : undefined;
  if (status === 'away' && !ABSENCE_REASONS.includes(reason)) throw new AppError('Please choose why you cannot come', 400);
  const reasonNote = String(req.body.note || '').trim().slice(0, 300) || undefined;

  const dates = new Set(farmer.blockedDates || []);
  const wasAway = dates.has(date);
  if (status === 'away') dates.add(date);
  else dates.delete(date);
  farmer.blockedDates = [...dates];
  if (status === 'here') farmer.checkIn = { date: today, at: new Date() };
  else if (farmer.checkIn?.date === date) farmer.checkIn = undefined;
  await farmer.save();

  let told = 0;
  if (status === 'away' && !wasAway) {
    const orders = await Order.find({ farmer: farmer._id, status: { $in: OPEN_ORDER_STATUSES }, pickupDate: date }).select('customer orderNumber').lean();
    const day = new Date(`${date}T12:00:00`);
    const when = date === today ? 'today' : `on ${DAY_NAMES[day.getDay()]}, ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}`; // "on Monday, 29 September"
    for (const o of orders) {
      await notify(
        o.customer,
        { type: 'order', title: `${farmer.stallName} is not at the market ${when}`, message: `${farmer.stallName} cannot be at the market ${when}. They will contact you about pre-order ${o.orderNumber}, or you can change the pickup day.`, link: `/account/orders/${o._id}` },
        { email: true }
      );
      told += 1;
    }
  }
  // The attendance record the admin sees (a "normal" day again removes it)
  if (status === 'normal') await MarketDayLog.deleteOne({ farmer: farmer._id, date });
  else {
    const booked = status === 'away' ? await Order.countDocuments({ farmer: farmer._id, status: { $in: OPEN_ORDER_STATUSES }, pickupDate: date }) : 0;
    await MarketDayLog.findOneAndUpdate(
      { farmer: farmer._id, date },
      { $set: { status, reason: status === 'away' ? reason : undefined, note: status === 'away' ? reasonNote : undefined, at: new Date(), ordersAffected: booked } },
      { upsert: true }
    );
  }
  const messages = {
    here: 'Checked in. Customers see that you are at the market now',
    away: told ? `Customers told: ${told}` : date === today ? 'Customers now see that you are not at the market today' : 'Customers now see that you are not coming that day',
    normal: date === today ? 'You are back at the market today' : 'That day is a normal market day again',
  };
  res.json({ date, status, blockedDates: farmer.blockedDates, checkIn: farmer.checkIn?.date ? farmer.checkIn : null, told, message: messages[status] });
}

// POST /api/farmer/away-today  { away: true|false }  (older name, kept for the mobile page and tests)
export async function setAwayToday(req, res) {
  req.body = { date: toDateKey(), status: req.body.away === true || req.body.away === 'true' ? 'away' : 'normal', reason: req.body.reason || 'other', note: req.body.note };
  const json = res.json.bind(res);
  res.json = (body) => json({ ...body, away: body.status === 'away' });
  return setMarketDay(req, res);
}

// ---------------------------------------------------------------- products

/** "fresh mangoes, sindhri" (or an array) -> ['fresh mangoes', 'sindhri']: unique, at most 12. */
export function readKeywords(value) {
  const list = (Array.isArray(value) ? value : String(value ?? '').split(','))
    .map((k) => String(k).trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
  const unique = [...new Set(list)];
  if (unique.some((k) => k.length > 40)) throw new AppError('Each keyword can be 40 characters at most', 400);
  if (unique.length > 12) throw new AppError('Please use 12 keywords at most', 400);
  return unique;
}

// Product schema fields in the form (flat, so they also work in multipart uploads)
const SCHEMA_FIELDS = { schemaSummary: ['summary', 300], schemaSeason: ['season', 80], schemaStorage: ['storage', 200], schemaUses: ['uses', 200] };

/** The farmer's own product schema text; `null` when the form did not send any. */
function readSchemaFields(body) {
  if (!Object.keys(SCHEMA_FIELDS).some((k) => body[k] !== undefined)) return null;
  const out = {};
  for (const [key, [field, max]] of Object.entries(SCHEMA_FIELDS)) {
    const value = String(body[key] ?? '').replace(/\s+/g, ' ').trim();
    if (value.length > max) throw new AppError(`The product schema ${field} can be ${max} characters at most`, 400);
    out[field] = value;
  }
  // Text the form got from "Write with AI" and saved unchanged keeps its AI source
  out.source = ['claude', 'builtin'].includes(body.schemaSource) ? body.schemaSource : 'farmer';
  return out;
}

/** "2026-10-05" -> the end of that day; empty -> no end date. The day must be today or within 90 days. */
function readOfferEnd(value) {
  if (value === '' || value === null || value === 'null') return null;
  if (!isDateKey(String(value))) throw new AppError('Please choose a valid end date for the offer', 400);
  const end = new Date(`${value}T23:59:59`);
  if (String(value) < toDateKey()) throw new AppError('The offer cannot end in the past', 400);
  if (end - Date.now() > 90 * 24 * 3600 * 1000) throw new AppError('An offer can run for 90 days at most', 400);
  return end;
}

function readProductBody(body, { partial = false } = {}) {
  const data = pick(body, ['name', 'nameUr', 'description', 'descriptionUr', 'unit', 'metaTitle', 'metaDescription']);
  if (data.descriptionUr !== undefined && String(data.descriptionUr).length > 1800) throw new AppError('The Urdu description can be 1800 characters at most', 400);
  if (data.nameUr !== undefined && String(data.nameUr).length > 100) throw new AppError('The Urdu name can be 100 characters at most', 400);
  if (body.keywords !== undefined) data.keywords = readKeywords(body.keywords);
  if (data.metaTitle && String(data.metaTitle).length > 70) throw new AppError('The SEO title can be 70 characters at most', 400);
  if (data.metaDescription && String(data.metaDescription).length > 170) throw new AppError('The SEO description can be 170 characters at most', 400);
  if (data.unit && !UNITS.includes(data.unit)) throw new AppError('Invalid unit', 400);
  if (body.category !== undefined) data.category = assertId(body.category, 'category');
  for (const key of ['price', 'quantityAvailable', 'templateQuantity']) {
    if (body[key] !== undefined && body[key] !== '') {
      const n = toNumber(body[key]);
      if (n === undefined || n < 0) throw new AppError(`${key} must be a positive number`, 400);
      if (key === 'price' && n <= 0) throw new AppError('Price must be greater than 0', 400);
      data[key] = key === 'price' ? round2(n) : Math.floor(n);
    }
  }
  // How customers buy it: by weight (grams / ml), the smallest amount (and step) and the most per order
  if (body.sellByWeight !== undefined) data.sellByWeight = ['true', '1', 'on'].includes(String(body.sellByWeight));
  if (body.minQuantity !== undefined && body.minQuantity !== '') {
    const n = toNumber(body.minQuantity);
    if (n === undefined || n <= 0) throw new AppError('The smallest amount must be more than 0', 400);
    data.minQuantity = Math.round(n * 1000) / 1000;
  }
  if (body.maxPerOrder !== undefined) {
    const n = body.maxPerOrder === '' ? 0 : toNumber(body.maxPerOrder);
    if (n === undefined || n < 0) throw new AppError('The most per order must be 0 (no limit) or a positive number', 400);
    data.maxPerOrder = Math.round(n * 1000) / 1000;
  }
  // Offer: the usual price, shown struck through next to the lower price (empty or 0 ends the offer)
  if (body.compareAtPrice !== undefined) {
    const was = toNumber(body.compareAtPrice);
    if (body.compareAtPrice === '' || !was) data.compareAtPrice = null;
    else if (was < 0) throw new AppError('The price before the offer must be a positive number', 400);
    else if (data.price !== undefined && was <= data.price) throw new AppError('The price before the offer must be higher than the price', 400);
    else data.compareAtPrice = round2(was);
  }
  if (body.offerEndsAt !== undefined) data.offerEndsAt = readOfferEnd(body.offerEndsAt);
  if (data.compareAtPrice === null) data.offerEndsAt = null;
  if (!partial) {
    for (const key of ['name', 'category', 'price']) if (data[key] === undefined) throw new AppError(`Please provide the product ${key}`, 400);
  }
  return data;
}

// GET /api/farmer/products?search=&status=
export async function myProducts(req, res) {
  // Products removed by an admin stay visible here (with the reason); ones the farmer deleted do not.
  const filter = { farmer: req.farmer._id, deletedByFarmer: { $ne: true } };
  if (req.query.search) filter.name = containsRegex(req.query.search);
  if (Object.values(PRODUCT_STATUS).includes(req.query.status)) filter.status = req.query.status;
  if (req.query.status === 'offer') filter.$expr = { $gt: ['$compareAtPrice', '$price'] }; // products on offer
  const products = await Product.find(filter).populate('category', 'name nameUr slug color').sort({ createdAt: -1 }).lean();
  res.json({ products, units: UNITS, autoApplyTemplate: req.farmer.autoApplyTemplate, templateLastAppliedWeek: req.farmer.templateLastAppliedWeek });
}

// POST /api/farmer/products  (multipart: image)
export async function createProduct(req, res) {
  const data = readProductBody(req.body);
  if (!(await Category.exists({ _id: data.category, isActive: true }))) throw new AppError('Please choose a valid category', 400);
  if (data.templateQuantity === undefined) data.templateQuantity = data.quantityAvailable || 0;
  const files = req.files || {};
  checkQuantityRules({ unit: 'kg', minQuantity: 1, maxPerOrder: 0, ...data });
  const product = await Product.create({
    ...data,
    slug: await uniqueSlug(Product, data.name),
    farmer: req.farmer._id,
    image: fileUrl('products', files.image?.[0]),
    gallery: (files.gallery || []).map((f) => ({ url: fileUrl('products', f) })),
    markets: req.farmer.markets,
    days: req.farmer.operatingDays,
    farmerActive: req.farmer.isActive,
  });
  await recordMovements([{ product, change: product.quantityAvailable, type: 'initial', reason: 'New product', by: 'farmer' }]);
  await checkLowStock([product._id]);
  await saveSchema(product, readSchemaFields(req.body), { changed: true });
  res.status(201).json({ product });
}

/**
 * Product schema after a save: the farmer's own text when they wrote it, otherwise written by AI
 * (straight away when missing, again when the name, category or description changed).
 */
async function saveSchema(product, own, { changed }) {
  const { source, ...text } = own || {};
  if (own && Object.values(text).some(Boolean)) {
    product.aiSchema = { ...text, source, generatedAt: new Date() };
    await product.save();
    if (!own.summary) await ensureProductSchema(product, { changed: true });
    return product;
  }
  if (own && product.aiSchema?.source === 'farmer') product.aiSchema = undefined; // the farmer cleared their text
  return ensureProductSchema(product, { changed });
}

async function loadOwnProduct(req) {
  const product = await Product.findOne({ _id: assertId(req.params.id, 'product'), farmer: req.farmer._id, deletedByFarmer: { $ne: true } });
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

// PUT /api/farmer/products/:id  (multipart: image)
export async function updateProduct(req, res) {
  const product = await loadOwnProduct(req);
  const data = readProductBody(req.body, { partial: true });
  if (data.category && !(await Category.exists({ _id: data.category, isActive: true }))) throw new AppError('Please choose a valid category', 400);
  const wasEmpty = product.quantityAvailable <= 0 || product.status === PRODUCT_STATUS.SOLD_OUT;
  const before = product.quantityAvailable;
  const wasOnOffer = product.compareAtPrice > product.price;
  if (data.name && data.name !== product.name) product.slug = await uniqueSlug(Product, data.name, product._id);
  const contentChanged = ['name', 'description'].some((k) => data[k] !== undefined && data[k] !== product[k]) || (data.category && String(data.category) !== String(product.category));
  Object.assign(product, data);
  checkQuantityRules(product);
  const files = req.files || {};
  if (files.image?.[0]) {
    product.image = fileUrl('products', files.image[0]);
    product.imageCredit = undefined;
  }
  // Gallery: remove the photos the farmer took out, then add the new uploads (5 photos at most in total)
  const remove = [].concat(req.body.removeGallery || []).flatMap((v) => String(v).split(',')).filter(Boolean);
  if (remove.length) product.gallery = product.gallery.filter((g) => !remove.includes(g.url));
  for (const f of files.gallery || []) if (product.gallery.length < 4) product.gallery.push({ url: fileUrl('products', f) });
  await product.save();
  await recordMovements([{ product, change: product.quantityAvailable - before, type: 'adjustment', reason: 'Edited in Weekly stock', by: 'farmer' }]);
  await checkLowStock([product._id]);
  if (wasEmpty && product.quantityAvailable > 0 && product.status === PRODUCT_STATUS.AVAILABLE) await notifyRestock(product);
  if (!wasOnOffer && product.compareAtPrice > product.price && product.status === PRODUCT_STATUS.AVAILABLE) await notifyOfferFans(product, (1 - product.price / product.compareAtPrice) * 100);
  await saveSchema(product, readSchemaFields(req.body), { changed: contentChanged });
  res.json({ product });
}

// PATCH /api/farmer/products/:id/status  { status: available | sold_out | unavailable }
export async function setProductStatus(req, res) {
  const product = await loadOwnProduct(req);
  const { status } = req.body;
  if (!Object.values(PRODUCT_STATUS).includes(status)) throw new AppError('Invalid status', 400);
  const wasEmpty = product.status !== PRODUCT_STATUS.AVAILABLE;
  if (status === PRODUCT_STATUS.AVAILABLE && product.quantityAvailable <= 0) {
    throw new AppError('Add stock quantity before marking the product as available', 400);
  }
  const before = product.quantityAvailable;
  if (status === PRODUCT_STATUS.SOLD_OUT) product.quantityAvailable = 0;
  product.status = status;
  await product.save();
  await recordMovements([{ product, change: product.quantityAvailable - before, type: 'adjustment', reason: 'Marked sold out', by: 'farmer' }]);
  if (wasEmpty && status === PRODUCT_STATUS.AVAILABLE) await notifyRestock(product);
  res.json({ product });
}

// PATCH /api/farmer/products/:id/offer  { percent: 5-90, endsOn?: 'YYYY-MM-DD' } or { end: true }
// Puts a product on offer from its usual price (e.g. 20% off) or ends the offer; fans of the product hear about a new offer.
export async function setProductOffer(req, res) {
  const product = await loadOwnProduct(req);
  const usual = product.compareAtPrice && product.compareAtPrice > product.price ? product.compareAtPrice : product.price;
  if (req.body.end === true || req.body.end === 'true') {
    product.price = usual;
    product.compareAtPrice = undefined;
    product.offerEndsAt = undefined;
    await product.save();
    return res.json({ product, message: 'Offer ended' });
  }
  const percent = toNumber(req.body.percent);
  if (percent === undefined || percent < 5 || percent > 90) throw new AppError('Choose a discount between 5% and 90%', 400);
  const wasOnOffer = product.compareAtPrice > product.price;
  product.compareAtPrice = round2(usual);
  product.price = Math.max(1, Math.round(usual * (1 - percent / 100)));
  product.offerEndsAt = req.body.endsOn ? readOfferEnd(req.body.endsOn) : undefined;
  await product.save();
  if (!wasOnOffer && product.status === PRODUCT_STATUS.AVAILABLE) await notifyOfferFans(product, percent);
  res.json({ product, message: `${Math.round(percent)}% off ${product.name}` });
}

// DELETE /api/farmer/products/:id
export async function deleteProduct(req, res) {
  const product = await loadOwnProduct(req);
  const hasOrders = await Order.exists({ 'items.product': product._id });
  if (hasOrders) {
    // Keep the record for order history, but hide it everywhere
    product.isRemoved = true;
    product.deletedByFarmer = true;
    product.removedReason = 'Deleted by farmer';
    product.status = PRODUCT_STATUS.UNAVAILABLE;
    await product.save();
  } else {
    await product.deleteOne();
  }
  res.json({ message: 'Product deleted' });
}

// PUT /api/farmer/template  { autoApplyTemplate, items: [{ productId, templateQuantity }] }
export async function updateTemplate(req, res) {
  if (req.body.autoApplyTemplate !== undefined) req.farmer.autoApplyTemplate = toBool(req.body.autoApplyTemplate);
  await req.farmer.save();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  for (const item of items) {
    const qty = toNumber(item.templateQuantity);
    if (!isValidId(item.productId) || qty === undefined || qty < 0) continue;
    await Product.updateOne({ _id: item.productId, farmer: req.farmer._id }, { templateQuantity: Math.floor(qty) });
  }
  res.json({ message: 'Weekly stock template saved', autoApplyTemplate: req.farmer.autoApplyTemplate });
}

// POST /api/farmer/template/apply
export async function applyTemplateNow(req, res) {
  const updated = await applyWeeklyTemplate(req.farmer);
  res.json({ message: `Weekly template applied to ${updated} product(s)`, updated });
}

// ---------------------------------------------------------------- orders

// GET /api/farmer/orders?status=&date=&search=
export async function farmerOrders(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = { farmer: req.farmer._id };
  const status = String(req.query.status || '');
  if (status === 'active') filter.status = { $in: OPEN_ORDER_STATUSES };
  else if (status === 'problems') filter['issue.status'] = { $in: ['open', 'new_pickup', 'disputed'] }; // "not received"
  else if (status === 'history') filter.status = { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DECLINED, ORDER_STATUS.CANCELLED] };
  else if (Object.values(ORDER_STATUS).includes(status)) filter.status = status;
  if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) filter.pickupDate = req.query.date;
  if (req.query.search) filter.orderNumber = containsRegex(req.query.search);

  // Open orders: soonest pickup first. History / all: most recent first.
  const openTabs = ['active', ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED, ORDER_STATUS.READY];
  const sort = openTabs.includes(status) ? { pickupAt: 1 } : { pickupAt: -1 };
  const [orders, total, counts] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name phone email')
      .populate('market', 'name address')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    Promise.all(Object.values(ORDER_STATUS).map((s) => Order.countDocuments({ farmer: req.farmer._id, status: s }))),
  ]);
  const statusCounts = Object.fromEntries(Object.values(ORDER_STATUS).map((s, i) => [s, counts[i]]));
  statusCounts.problems = await Order.countDocuments({ farmer: req.farmer._id, 'issue.status': { $in: ['open', 'new_pickup', 'disputed'] } });
  res.json({ orders, total, page, pages: Math.ceil(total / limit), statusCounts });
}

const TRANSITIONS = {
  accept: { from: [ORDER_STATUS.PLACED], to: ORDER_STATUS.ACCEPTED },
  decline: { from: [ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED], to: ORDER_STATUS.DECLINED },
  ready: { from: [ORDER_STATUS.ACCEPTED], to: ORDER_STATUS.READY },
  complete: { from: [ORDER_STATUS.READY, ORDER_STATUS.ACCEPTED], to: ORDER_STATUS.COMPLETED },
};

const CUSTOMER_MESSAGES = {
  accepted: (o, f, note, m) => [`Pre-order ${o.orderNumber} accepted`, `${f.stallName} accepted your pre-order.\n${pickupDetails(o, m)}`],
  declined: (o, f, note) => [`Pre-order ${o.orderNumber} declined`, `${f.stallName} could not fulfil your pre-order.${note ? ` Reason: ${note}` : ''}`],
  ready: (o, f, note, m) => [`Pre-order ${o.orderNumber} is ready for pickup`, `Your order from ${f.stallName} is packed and ready. Please pay at pickup.\n${pickupDetails(o, m)}`],
  completed: (o, f) => [`Did you receive pre-order ${o.orderNumber}?`, `${f.stallName} marked your pre-order as picked up. Please confirm that you received it, then share your experience with a review.`],
};

// POST /api/farmer/orders/:id/:action   action = accept | decline | ready | complete
export async function updateOrderStatus(req, res) {
  const rule = TRANSITIONS[req.params.action];
  if (!rule) throw new AppError('Unknown action', 400);
  const order = await Order.findOne({ _id: assertId(req.params.id, 'order'), farmer: req.farmer._id });
  if (!order) throw new AppError('Order not found', 404);
  if (!rule.from.includes(order.status)) throw new AppError(`Cannot ${req.params.action} an order that is ${order.status}`, 400);

  const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : undefined;
  if (rule.to === ORDER_STATUS.DECLINED) {
    await releaseItems(order.items);
    await recordMovements(orderMovements(order, 1, 'order_released', 'farmer'));
    await checkLowStock(order.items.map((i) => i.product));
  }
  if (rule.to === ORDER_STATUS.COMPLETED) {
    order.completedAt = new Date();
    for (const item of order.items) await Product.updateOne({ _id: item.product }, { $inc: { totalSold: item.quantity } });
  }
  if (note) order.farmerNote = note;
  pushStatus(order, rule.to, 'farmer', note);
  await order.save();

  const market = await Market.findById(order.market).select('name address latitude longitude').lean();
  const [title, message] = CUSTOMER_MESSAGES[rule.to](order, req.farmer, note, market);
  // E-mail for the important moments: accepted, ready for pickup and declined
  const email = [ORDER_STATUS.ACCEPTED, ORDER_STATUS.READY, ORDER_STATUS.DECLINED, ORDER_STATUS.COMPLETED].includes(rule.to);
  await notify(order.customer, { type: 'order', title, message, link: `/account/orders/${order._id}` }, { email });

  await order.populate([
    { path: 'customer', select: 'name phone email' },
    { path: 'market', select: 'name address' },
  ]);
  res.json({ order });
}

// ---------------------------------------------------------------- insights

// GET /api/farmer/insights?days=30
export async function farmerInsights(req, res) {
  const farmerId = req.farmer._id;
  const days = Math.min(365, Math.max(7, toNumber(req.query.days, 30)));
  const now = new Date();
  const since = startOfDay(addDays(now, -(days - 1)));

  const [allOrders, products] = await Promise.all([
    Order.find({ farmer: farmerId }).select('status totalAmount items createdAt completedAt pickupDate pickupAt').lean(),
    Product.find({ farmer: farmerId, isRemoved: false }).select('name status quantityAvailable').lean(),
  ]);

  const completed = allOrders.filter((o) => o.status === ORDER_STATUS.COMPLETED);
  const sumRevenue = (list) => round2(list.reduce((s, o) => s + o.totalAmount, 0));
  const weekStart = startOfDay(addDays(now, -6));
  const monthStart = startOfDay(addDays(now, -29));
  const doneAt = (o) => new Date(o.completedAt || o.pickupAt);

  // Revenue per day for the chart
  const series = [];
  for (let i = 0; i < days; i += 1) series.push({ date: toDateKey(addDays(since, i)), revenue: 0, orders: 0 });
  const index = new Map(series.map((p, i) => [p.date, i]));
  for (const o of completed) {
    const i = index.get(toDateKey(doneAt(o)));
    if (i !== undefined) {
      series[i].revenue = round2(series[i].revenue + o.totalAmount);
      series[i].orders += 1;
    }
  }

  // Best-selling products (completed orders)
  const sales = new Map();
  for (const o of completed) {
    for (const item of o.items) {
      const key = String(item.product);
      const row = sales.get(key) || { productId: key, name: item.name, nameUr: item.nameUr, quantity: 0, revenue: 0, unit: item.unit };
      row.quantity += item.quantity;
      row.revenue = round2(row.revenue + item.subtotal);
      sales.set(key, row);
    }
  }
  const bestSellers = [...sales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6);

  const statusCounts = {};
  for (const s of Object.values(ORDER_STATUS)) statusCounts[s] = allOrders.filter((o) => o.status === s).length;

  const upcoming = await Order.find({ farmer: farmerId, status: { $in: OPEN_ORDER_STATUSES }, pickupAt: { $gte: startOfDay(now) } })
    .populate('customer', 'name phone')
    .populate('market', 'name')
    .sort({ pickupAt: 1 })
    .limit(6)
    .lean();

  res.json({
    kpis: {
      totalOrders: allOrders.length,
      pendingOrders: statusCounts.placed,
      activeOrders: statusCounts.placed + statusCounts.accepted + statusCounts.ready,
      completedOrders: completed.length,
      revenueTotal: sumRevenue(completed),
      revenueWeek: sumRevenue(completed.filter((o) => doneAt(o) >= weekStart)),
      revenueMonth: sumRevenue(completed.filter((o) => doneAt(o) >= monthStart)),
      averageOrder: completed.length ? round2(sumRevenue(completed) / completed.length) : 0,
      productsListed: products.length,
      productsSoldOut: products.filter((p) => p.status === PRODUCT_STATUS.SOLD_OUT).length,
      rating: req.farmer.ratingAvg,
      ratingCount: req.farmer.ratingCount,
    },
    series,
    bestSellers,
    statusCounts,
    upcoming,
    status: req.user.status,
  });
}

// ---------------------------------------------------------------- reviews

// GET /api/farmer/reviews
export async function farmerReviews(req, res) {
  const filter = { farmer: req.farmer._id, isRemoved: false };
  if (req.query.unanswered === 'true') filter['response.text'] = { $exists: false };
  const reviews = await Review.find(filter).populate('customer', 'name avatar').populate('product', 'name slug image').sort({ createdAt: -1 }).lean();
  res.json({ reviews });
}

// POST /api/farmer/reviews/:id/respond  { text }
export async function respondToReview(req, res) {
  const review = await Review.findOne({ _id: assertId(req.params.id, 'review'), farmer: req.farmer._id, isRemoved: false });
  if (!review) throw new AppError('Review not found', 404);
  const text = String(req.body.text || '').trim();
  if (!text) throw new AppError('Please write a response', 400);
  review.response = { text: text.slice(0, 1000), at: new Date() };
  await review.save();
  await notify(review.customer, {
    type: 'review',
    title: `${req.farmer.stallName} replied to your review`,
    message: text.slice(0, 120),
    link: review.product ? `/products/${(await Product.findById(review.product).select('slug').lean())?.slug || review.product}` : `/farmers/${req.farmer.slug}`,
  });
  res.json({ review });
}

// POST /api/farmer/products/:id/schema  -> writes the product schema again with AI (replaces the farmer's text)
export async function regenerateProductSchema(req, res) {
  const product = await loadOwnProduct(req);
  await refreshProductSchema(product, { force: true });
  res.json({ product });
}

// POST /api/farmer/products/ai-seo  { name, category, unit, price, description }
// "Write with AI" in the product form: SEO title, description, keywords, Urdu name and product schema
export async function aiProductSeo(req, res) {
  const name = String(req.body.name || '').trim().slice(0, 100);
  if (name.length < 2) throw new AppError('Type the product name first', 400);
  const category = isValidId(req.body.category) ? (await Category.findById(req.body.category).select('name').lean())?.name : '';
  const result = await generateProductSchema({
    name,
    category: category || '',
    unit: UNITS.includes(req.body.unit) ? req.body.unit : '',
    price: toNumber(req.body.price) || undefined,
    description: String(req.body.description || '').slice(0, 1500),
    stallName: req.farmer.stallName,
    city: req.farmer.city || '',
    practices: req.farmer.tags || [],
  });
  res.json(result);
}

/** Customers who saved the product as a favourite get an in-app notice when it goes on offer. */
async function notifyOfferFans(product, percent) {
  const fans = await User.find({ favoriteProducts: product._id, status: USER_STATUS.ACTIVE }).select('_id').lean();
  if (!fans.length) return 0;
  return notifyMany(
    fans.map((f) => f._id),
    { type: 'restock', title: `${product.name} is on offer`, message: `${Math.round(percent)}% off ${product.name} now. Pre-order before the offer ends.`, link: `/products/${product.slug || product._id}` }
  );
}
