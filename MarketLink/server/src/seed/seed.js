/**
 * Seeds the database with demo data.
 *   npm run seed            (from the /server folder)
 * WARNING: this deletes all existing MarketLink data first.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import {
  Announcement,
  AssistantChat,
  Category,
  City,
  ContactMessage,
  Subscriber,
  ContentFlag,
  Faq,
  Farmer,
  Market,
  MarketDayLog,
  Notification,
  Order,
  Product,
  Report,
  Review,
  RestockRequest,
  SiteBanner,
  StockMovement,
  User,
} from '../models/index.js';
import { ORDER_STATUS, ROLES, TERMS_VERSION, USER_STATUS } from '../utils/constants.js';
import { addDays, combineDateTime, isoWeekKey, startOfDay, toDateKey } from '../utils/dates.js';
import { round2, slugify } from '../utils/helpers.js';
import { generateSlots, getAvailability } from '../services/slots.js';
import { uniqueSlug } from '../utils/slug.js';
import { faqs } from '../content/faqs.js';
import { builtinSchema } from '../services/productSchema.js';
import { syncValidators } from '../services/migrations.js';
import { currentMonth } from '../models/Announcement.js';
import { refreshRatings } from '../services/ratings.js';
import { buildReport, REPORT_TITLES } from '../services/reports.js';
import { markDataChanged } from '../services/cache.js';
import * as data from './data.js';
import fs from 'node:fs';

// Real product photos (Open Images, CC BY 2.0) keyed by product name - see server/uploads/photos/CREDITS.md
const PHOTOS = JSON.parse(fs.readFileSync(new URL('./photoCredits.json', import.meta.url), 'utf8'));
// Extra photos for the product-page gallery (same source and licence)
const GALLERY = JSON.parse(fs.readFileSync(new URL('./galleryCredits.json', import.meta.url), 'utf8'));
// Market and farm photos (Open Images, CC BY 2.0) - see server/uploads/places/CREDITS.md
const PLACES = JSON.parse(fs.readFileSync(new URL('./placeCredits.json', import.meta.url), 'utf8'));
const placeCredit = (url) => (url ? PLACES[url] : undefined);

/** Search keywords for a seeded product, e.g. ['sindhri mangoes', 'fresh sindhri mangoes', 'fruits karachi']. */
function seedKeywords(name, categoryName, city) {
  const n = name.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return [...new Set([n, `fresh ${n}`, `${categoryName.toLowerCase()} ${String(city || 'karachi').toLowerCase()}`, 'farm fresh'])];
}

// Small deterministic random generator so every seed produces the same demo data
let state = 20260923;
function random() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const randInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const pickOne = (list) => list[Math.floor(random() * list.length)];
function pickMany(list, count) {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < count) out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  return out;
}
function weightedRating() {
  const r = random();
  if (r < 0.55) return 5;
  if (r < 0.87) return 4;
  if (r < 0.97) return 3;
  return 2;
}

let orderCounter = 0;
function orderNumber(date) {
  orderCounter += 1;
  const d = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `ML-${d}-${String(orderCounter).padStart(4, '0')}`;
}

async function clearDatabase() {
  const models = [Announcement, AssistantChat, Category, City, ContactMessage, ContentFlag, Faq, StockMovement, Farmer, Market, MarketDayLog, Notification, Order, Product, Report, RestockRequest, Review, SiteBanner, Subscriber, User];
  for (const Model of models) {
    await Model.deleteMany({});
    await Model.init(); // make sure indexes exist
  }
}

async function main() {
  await connectDB();
  await syncValidators().catch((err) => console.error('[seed] Could not update the database validators:', err.message));
  console.log('[seed] Clearing existing data...');
  await clearDatabase();

  // ---------------------------------------------------------------- admin
  const admin = await User.create({ ...data.admin, password: data.PASSWORDS.admin, role: ROLES.ADMIN, status: USER_STATUS.ACTIVE });

  // ---------------------------------------------------------------- categories & markets
  const categoryByKey = {};
  for (const c of data.categories) {
    categoryByKey[c.key] = await Category.create({ ...c, slug: slugify(c.name) });
  }
  for (const [i, c] of data.cities.entries()) {
    await City.create({ ...c, slug: slugify(c.name), sortOrder: i });
  }
  const marketByKey = {};
  for (const m of data.markets) {
    marketByKey[m.key] = await Market.create({ ...m, imageCredit: placeCredit(m.image?.replace('/uploads/', '')), slug: slugify(m.name), mapProvider: 'openstreetmap', mapLink: `https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=17/${m.latitude}/${m.longitude}` });
  }

  // ---------------------------------------------------------------- farmers & products
  const farmerByKey = {};
  const productsByFarmer = {};
  const week = isoWeekKey();
  // Demo "closed date": the nursery skips its next Friday market
  const nextFriday = toDateKey(addDays(startOfDay(new Date()), ((5 - new Date().getDay() + 7) % 7) || 7));
  for (const f of data.farmers) {
    const user = await User.create({
      name: f.contactPerson,
      email: f.email,
      password: data.PASSWORDS.farmer,
      role: ROLES.FARMER,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      status: f.status,
      phone: f.phone,
      address: f.address,
      city: f.city,
    });
    const farmer = await Farmer.create({
      user: user._id,
      stallName: f.stallName,
      slug: slugify(f.stallName),
      contactPerson: f.contactPerson,
      phone: f.phone,
      email: f.email,
      address: f.address,
      city: f.city,
      bio: f.bio,
      bioUr: f.bioUr,
      tags: f.tags,
      logo: f.logo,
      coverImage: f.cover,
      coverCredit: placeCredit(f.cover?.replace('/uploads/', '')),
      latitude: f.latitude,
      longitude: f.longitude,
      pickupWindows: f.windows.map((w) => ({ ...w, market: marketByKey[w.market]._id })),
      orderCutoffHours: f.cutoff,
      slotMinutes: 30,
      slotCapacity: 6,
      isActive: f.status === USER_STATUS.ACTIVE,
      blockedDates: f.key === 'bloom' ? [nextFriday] : [],
      autoApplyTemplate: true,
      templateLastAppliedWeek: week,
    });
    farmerByKey[f.key] = { farmer, user, def: f };
    productsByFarmer[f.key] = [];
    for (const p of f.products) {
      const product = await Product.create({
        farmer: farmer._id,
        name: p.name,
        nameUr: data.urduNames[p.name],
        slug: await uniqueSlug(Product, p.name),
        category: categoryByKey[p.cat]._id,
        price: p.price,
        compareAtPrice: p.was, // the usual price of this week's offers
        unit: p.unit,
        quantityAvailable: p.qty,
        templateQuantity: p.template ?? p.qty,
        // sold by weight (grams / ml) with the smallest amount as the step, and a per-order limit
        sellByWeight: Boolean(p.weight),
        minQuantity: p.weight || 1,
        maxPerOrder: p.maxPer || 0,
        description: p.desc,
        descriptionUr: data.urduDescriptions[p.name],
        keywords: seedKeywords(p.name, categoryByKey[p.cat].name, farmer.city),
        image: PHOTOS[p.name] ? `/uploads/photos/${PHOTOS[p.name].file}` : undefined,
        imageCredit: PHOTOS[p.name] ? { author: PHOTOS[p.name].author, source: PHOTOS[p.name].source, license: PHOTOS[p.name].license } : undefined,
        gallery: (GALLERY[p.name] || []).map((g) => ({ url: `/uploads/photos/gallery/${g.file}`, credit: { author: g.author, source: g.source, license: g.license } })),
        markets: farmer.markets,
        days: farmer.operatingDays,
        farmerActive: farmer.isActive,
        // Product schema from the built-in AI writer (Claude writes it for products added later when a key is set)
        aiSchema: (({ summary, season, storage, uses, storageUr, usesUr }) => ({ summary, season, storage, uses, storageUr, usesUr, source: 'builtin', generatedAt: new Date() }))(
          builtinSchema({ name: p.name, category: categoryByKey[p.cat].name, unit: p.unit, price: p.price, stallName: farmer.stallName, city: farmer.city, practices: farmer.tags })
        ),
      });
      productsByFarmer[f.key].push(product);
    }
    // "What they grow" = the categories of the farmer's products
    farmer.categories = [...new Set(productsByFarmer[f.key].map((p) => String(p.category)))];
    if (!farmer.categories.length && f.key === 'poultry') farmer.categories = [categoryByKey.dairy._id];
    await farmer.save();
  }
  console.log(`[seed] ${data.farmers.length} farmers, ${Object.values(productsByFarmer).flat().length} products`);

  // What is sold at each market = the categories of the approved farmers who sell there
  for (const market of Object.values(marketByKey)) {
    const sellers = Object.values(farmerByKey).filter(({ farmer }) => farmer.isActive && farmer.markets.some((id) => String(id) === String(market._id)));
    market.categories = [...new Set(sellers.flatMap(({ farmer }) => farmer.categories.map(String)))];
    await market.save();
  }

  // ---------------------------------------------------------------- customers
  const customerByKey = {};
  for (const c of data.customers) {
    customerByKey[c.key] = await User.create({
      name: c.name,
      email: c.email,
      password: data.PASSWORDS.customer,
      phone: c.phone,
      address: c.address,
      city: c.city,
      role: ROLES.CUSTOMER,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      status: c.status || USER_STATUS.ACTIVE,
    });
  }
  for (const c of data.customers.filter((x) => x.household)) {
    const owner = customerByKey[c.household];
    owner.household = owner._id;
    await owner.save();
    customerByKey[c.key].household = owner._id;
    await customerByKey[c.key].save();
  }

  const ayesha = customerByKey.ayesha;
  const findProduct = (farmerKey, name) => productsByFarmer[farmerKey].find((p) => p.name === name);
  ayesha.favoriteFarmers = [farmerByKey.malir.farmer._id, farmerByKey.bakehouse.farmer._id, farmerByKey.thatta.farmer._id];
  ayesha.favoriteProducts = [
    findProduct('gadap', 'Sindhri Mangoes')._id,
    findProduct('bakehouse', 'Country Sourdough Loaf')._id,
    findProduct('malir', 'Capsicum Mix')._id,
    findProduct('herbs', 'Button Mushrooms')._id,
  ];
  ayesha.savedMarkets = [marketByKey.clifton._id, marketByKey.dha._id];
  await ayesha.save();

  // ---------------------------------------------------------------- order history (last 8 weeks)
  const activeFarmers = Object.values(farmerByKey).filter((x) => x.farmer.isActive);
  const buyersFor = (city) => {
    const all = Object.values(customerByKey).filter((c) => c.status === USER_STATUS.ACTIVE);
    const local = all.filter((c) => c.city === city);
    return local.length ? local : all;
  };
  const sold = new Map();
  const completedOrders = [];
  const today = startOfDay(new Date());
  const orderDocs = [];

  for (let back = 56; back >= 1; back -= 1) {
    const date = addDays(today, -back);
    const dateKey = toDateKey(date);
    for (const { farmer, def } of activeFarmers) {
      const products = productsByFarmer[def.key];
      if (!products.length) continue;
      for (const window of farmer.pickupWindows.filter((w) => w.day === date.getDay())) {
        const count = def.key === 'malir' ? randInt(2, 4) : randInt(1, 3);
        const slots = generateSlots(window, farmer.slotMinutes);
        for (let i = 0; i < count; i += 1) {
          const customer = pickOne(buyersFor(def.city));
          const slot = pickOne(slots);
          const pickupAt = combineDateTime(dateKey, slot.start);
          const createdAt = new Date(pickupAt.getTime() - randInt(14, 72) * 3600 * 1000);
          const items = pickMany(products, randInt(1, 3)).map((p) => {
            const quantity = randInt(1, 3);
            return { product: p._id, name: p.name, nameUr: p.nameUr, image: p.image, unit: p.unit, price: p.price, quantity, subtotal: round2(p.price * quantity) };
          });
          const r = random();
          const status = r < 0.85 ? ORDER_STATUS.COMPLETED : r < 0.93 ? ORDER_STATUS.CANCELLED : ORDER_STATUS.DECLINED;
          const history = [{ status: ORDER_STATUS.PLACED, at: createdAt, by: 'customer' }];
          if (status === ORDER_STATUS.CANCELLED) history.push({ status, at: new Date(createdAt.getTime() + 3 * 3600 * 1000), by: 'customer' });
          if (status === ORDER_STATUS.DECLINED) history.push({ status, at: new Date(createdAt.getTime() + 2 * 3600 * 1000), by: 'farmer', note: 'Harvest was smaller than expected' });
          if (status === ORDER_STATUS.COMPLETED) {
            history.push({ status: ORDER_STATUS.ACCEPTED, at: new Date(createdAt.getTime() + 2 * 3600 * 1000), by: 'farmer' });
            history.push({ status: ORDER_STATUS.READY, at: new Date(pickupAt.getTime() - 3600 * 1000), by: 'farmer' });
            history.push({ status: ORDER_STATUS.COMPLETED, at: new Date(pickupAt.getTime() + 20 * 60 * 1000), by: 'farmer' });
          }
          orderDocs.push({
            orderNumber: orderNumber(createdAt),
            customer: customer._id,
            farmer: farmer._id,
            market: window.market,
            items,
            totalAmount: round2(items.reduce((s, x) => s + x.subtotal, 0)),
            pickupDate: dateKey,
            pickupSlot: slot,
            pickupAt,
            cutoffAt: new Date(pickupAt.getTime() - farmer.orderCutoffHours * 3600 * 1000),
            status,
            statusHistory: history,
            farmerNote: status === ORDER_STATUS.DECLINED ? 'Harvest was smaller than expected' : undefined,
            paymentMethod: 'pay_at_pickup',
            completedAt: status === ORDER_STATUS.COMPLETED ? new Date(pickupAt.getTime() + 20 * 60 * 1000) : undefined,
            createdAt,
            updatedAt: history[history.length - 1].at,
          });
        }
      }
    }
  }
  // insertMany keeps our historical createdAt values
  const inserted = await Order.insertMany(orderDocs, { timestamps: false });
  for (const order of inserted) {
    if (order.status !== ORDER_STATUS.COMPLETED) continue;
    completedOrders.push(order);
    for (const item of order.items) sold.set(String(item.product), (sold.get(String(item.product)) || 0) + item.quantity);
  }
  for (const [productId, qty] of sold) await Product.updateOne({ _id: productId }, { totalSold: qty });
  // Customers confirmed receiving their past orders; the demo customer's latest one still asks
  // "Did you receive it?" so the confirmation can be tried out
  await Order.updateMany({ status: ORDER_STATUS.COMPLETED }, [{ $set: { receipt: { status: 'received', at: '$completedAt' } } }], { updatePipeline: true });
  const demoCustomer = await User.findOne({ email: 'customer@marketlink.com' }).select('_id').lean();
  const latest = demoCustomer && (await Order.findOne({ customer: demoCustomer._id, status: ORDER_STATUS.COMPLETED }).sort({ completedAt: -1 }).select('_id'));
  if (latest) await Order.updateOne({ _id: latest._id }, { $unset: { receipt: 1 } });
  // One pickup problem to show the "not received" flow: a recent Malir Green Fields order of another customer
  const malir = await Farmer.findOne({ slug: 'malir-green-fields' }).select('_id').lean();
  const problem = malir && (await Order.findOne({ farmer: malir._id, status: ORDER_STATUS.COMPLETED, customer: { $ne: demoCustomer?._id } }).sort({ completedAt: -1 }));
  if (problem) {
    const note = 'I came at my time but the stall had already packed up.';
    const at = new Date(problem.completedAt.getTime() + 3 * 3600 * 1000);
    await Order.updateOne(
      { _id: problem._id },
      { $set: { receipt: { status: 'not_received', note, at }, issue: { status: 'open', reason: 'not_received', note, openedAt: at, timesReported: 1, history: [{ at, by: 'customer', action: 'reported', note }] } } }
    );
  }
  console.log(`[seed] ${inserted.length} historical orders`);

  // ---------------------------------------------------------------- upcoming (open) orders
  const stockLog = [];
  async function openOrder(customer, farmerKey, lines, status, { dateIndex = 0, slotIndex = 0, note } = {}) {
    const { farmer } = farmerByKey[farmerKey];
    await farmer.populate('pickupWindows.market', 'name address');
    const availability = await getAvailability(farmer, { days: 14 });
    const day = availability[Math.min(dateIndex, availability.length - 1)];
    if (!day) return null;
    const window = day.windows[0];
    const openSlots = window.slots.filter((s) => s.available);
    const slot = openSlots[Math.min(slotIndex, openSlots.length - 1)];
    const pickupAt = combineDateTime(day.date, slot.start);
    const createdAt = new Date(Date.now() - randInt(1, 20) * 3600 * 1000);
    const items = [];
    for (const [name, quantity] of lines) {
      const p = findProduct(farmerKey, name);
      items.push({ product: p._id, name: p.name, nameUr: p.nameUr, image: p.image, unit: p.unit, price: p.price, quantity, subtotal: round2(p.price * quantity) });
      await Product.updateOne({ _id: p._id }, { $inc: { quantityAvailable: -quantity } });
    }
    const history = [{ status: ORDER_STATUS.PLACED, at: createdAt, by: 'customer' }];
    if (status !== ORDER_STATUS.PLACED) history.push({ status: ORDER_STATUS.ACCEPTED, at: new Date(createdAt.getTime() + 30 * 60 * 1000), by: 'farmer' });
    if (status === ORDER_STATUS.READY) history.push({ status: ORDER_STATUS.READY, at: new Date(createdAt.getTime() + 60 * 60 * 1000), by: 'farmer' });
    const [order] = await Order.insertMany(
      [
        {
          orderNumber: orderNumber(createdAt),
          customer: customer._id,
          farmer: farmer._id,
          market: window.market._id,
          items,
          totalAmount: round2(items.reduce((s, x) => s + x.subtotal, 0)),
          pickupDate: day.date,
          pickupSlot: { start: slot.start, end: slot.end },
          pickupAt,
          cutoffAt: new Date(pickupAt.getTime() - farmer.orderCutoffHours * 3600 * 1000),
          status,
          statusHistory: history,
          customerNote: note,
          createdAt,
          updatedAt: history[history.length - 1].at,
        },
      ],
      { timestamps: false }
    );
    stockLog.push(...items.map((i) => ({ product: i.product, change: -i.quantity, type: 'order_reserved', order: order._id, orderNumber: order.orderNumber, by: 'customer', at: createdAt })));
    return order;
  }

  const upcoming = [
    await openOrder(ayesha, 'malir', [['Vine Tomatoes', 2], ['Sweet Carrots', 1], ['Green Chillies', 1]], ORDER_STATUS.PLACED, { dateIndex: 1, slotIndex: 2, note: 'Please pick the ripest tomatoes' }),
    await openOrder(ayesha, 'bakehouse', [['Country Sourdough Loaf', 1], ['Butter Croissants', 1]], ORDER_STATUS.ACCEPTED, { dateIndex: 0, slotIndex: 1 }),
    await openOrder(ayesha, 'thatta', [['Desi Eggs', 1], ['Fresh Buffalo Milk', 2]], ORDER_STATUS.READY, { dateIndex: 0, slotIndex: 0 }),
    await openOrder(customerByKey.bilal, 'malir', [['Farm Potatoes', 3], ['Red Onions', 2]], ORDER_STATUS.PLACED, { dateIndex: 0, slotIndex: 3 }),
    await openOrder(customerByKey.sara, 'malir', [['Desi Cucumbers', 2], ['Vine Tomatoes', 1]], ORDER_STATUS.ACCEPTED, { dateIndex: 0, slotIndex: 1 }),
    await openOrder(customerByKey.usman, 'malir', [['Purple Brinjal', 1], ['Sweet Carrots', 2]], ORDER_STATUS.READY, { dateIndex: 0, slotIndex: 0 }),
    await openOrder(customerByKey.omar, 'gadap', [['Sindhri Mangoes', 3], ['Bananas', 1]], ORDER_STATUS.PLACED, { dateIndex: 0, slotIndex: 2 }),
    await openOrder(customerByKey.bilal, 'honey', [['Wild Sidr Honey', 1]], ORDER_STATUS.ACCEPTED, { dateIndex: 0, slotIndex: 0 }),
  ].filter(Boolean);
  console.log(`[seed] ${upcoming.length} upcoming pre-orders`);

  // ---------------------------------------------------------------- reviews
  const reviewDocs = [];
  for (const order of completedOrders) {
    if (random() > 0.5) continue;
    const at = new Date(order.completedAt.getTime() + randInt(2, 30) * 3600 * 1000);
    const farmerRating = weightedRating();
    reviewDocs.push({
      type: 'farmer',
      farmer: order.farmer,
      customer: order.customer,
      order: order._id,
      verified: true,
      rating: farmerRating,
      comment: pickOne(data.reviewComments[farmerRating]),
      response: random() < 0.4 ? { text: pickOne(data.farmerResponses), at: new Date(at.getTime() + 5 * 3600 * 1000) } : undefined,
      createdAt: at,
      updatedAt: at,
    });
    if (random() < 0.75) {
      const item = order.items[0];
      const rating = weightedRating();
      reviewDocs.push({
        type: 'product',
        product: item.product,
        farmer: order.farmer,
        customer: order.customer,
        order: order._id,
        verified: true,
        rating,
        comment: pickOne(data.reviewComments[rating]),
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  // A few reviews from customers who never bought the item: shown as "Unverified"
  const bought = new Set(completedOrders.flatMap((o) => o.items.map((i) => `${o.customer}:${i.product}`)));
  const boughtFrom = new Set(completedOrders.map((o) => `${o.customer}:${o.farmer}`));
  const allCustomers = Object.values(customerByKey);
  const unverifiedNotes = {
    5: ['My neighbour shared some with us, lovely quality.', 'Tried it at a friend\'s house, will order myself next week.'],
    4: ['Looked very fresh at the stall when I passed by.', 'Heard good things from other families in our building.'],
    3: ['Seemed a bit pricey when I checked at the market.', 'Saw it at the stall, the selection was small that day.'],
  };
  let unverified = 0;
  for (const product of Object.values(productsByFarmer).flat().slice(0, 40)) {
    if (unverified >= 6 || random() > 0.3) continue;
    const customer = allCustomers.find((c) => !bought.has(`${c._id}:${product._id}`));
    if (!customer) continue;
    const rating = [5, 4, 4, 3][randInt(0, 3)];
    const at = new Date(Date.now() - randInt(2, 20) * 24 * 3600 * 1000);
    reviewDocs.push({ type: 'product', product: product._id, farmer: product.farmer, customer: customer._id, verified: false, rating, comment: pickOne(unverifiedNotes[rating]), createdAt: at, updatedAt: at });
    unverified += 1;
  }
  for (const { farmer } of Object.values(farmerByKey).slice(0, 4)) {
    const customer = allCustomers.find((c) => !boughtFrom.has(`${c._id}:${farmer._id}`));
    if (!customer) continue;
    const at = new Date(Date.now() - randInt(2, 20) * 24 * 3600 * 1000);
    reviewDocs.push({ type: 'farmer', farmer: farmer._id, customer: customer._id, verified: false, rating: 4, comment: pickOne(unverifiedNotes[4]), createdAt: at, updatedAt: at });
    unverified += 1;
  }
  await Review.insertMany(reviewDocs, { timestamps: false });
  for (const product of Object.values(productsByFarmer).flat()) await refreshRatings({ productId: product._id });
  for (const { farmer } of Object.values(farmerByKey)) await refreshRatings({ farmerId: farmer._id });
  console.log(`[seed] ${reviewDocs.length} reviews (${unverified} unverified)`);

  // ---------------------------------------------------------------- announcements, messages, notifications, report
  for (const a of data.announcements) await Announcement.create({ ...a, createdBy: admin._id });
  const month = currentMonth();
  const seasonal = data.announcements.find((a) => a.months?.includes(month)) || data.announcements[0];
  await ContactMessage.insertMany(data.contactMessages);
  await Subscriber.insertMany(data.subscribers.map((sub, i) => ({ ...sub, createdAt: addDays(new Date(), -(i * 3 + 1)) })));
  await Faq.insertMany(faqs.map((f, i) => ({ ...f, order: i + 1 })));

  const [placedOrder, acceptedOrder, readyOrder] = upcoming;
  const malirUser = farmerByKey.malir.user;
  await Notification.insertMany([
    { user: ayesha._id, type: 'system', title: 'Welcome to MarketLink!', message: 'Browse this week\'s harvest and pre-order for pickup at your favourite market.', link: '/products', read: true },
    { user: ayesha._id, type: 'announcement', title: seasonal.title, message: seasonal.message, link: seasonal.link },
    { user: ayesha._id, type: 'order', title: `Pre-order ${placedOrder.orderNumber} placed`, message: 'Malir Green Fields received your pre-order.', link: `/account/orders/${placedOrder._id}` },
    { user: ayesha._id, type: 'order', title: `Pre-order ${acceptedOrder.orderNumber} accepted`, message: 'Karachi Artisan Bakehouse accepted your pre-order.', link: `/account/orders/${acceptedOrder._id}` },
    { user: ayesha._id, type: 'order', title: `Pre-order ${readyOrder.orderNumber} is ready for pickup`, message: 'Your order from Thatta Dairy Collective is packed and ready. Please pay at pickup.', link: `/account/orders/${readyOrder._id}` },
    { user: malirUser._id, type: 'order', title: `New pre-order ${placedOrder.orderNumber}`, message: 'Ayesha Khan placed a pre-order.', link: '/farmer/orders' },
    { user: malirUser._id, type: 'review', title: 'New 5-star review', message: 'A customer loved your Vine Tomatoes!', link: '/farmer/reviews' },
    { user: admin._id, type: 'account', title: 'New farmer registration', message: 'Sunny Acres Poultry (Rashid Mehmood) is waiting for approval.', link: '/admin/farmers?status=pending' },
    { user: admin._id, type: 'system', title: 'New contact message', message: 'Tariq Jamil: Joining as a farmer', link: '/admin/messages' },
  ]);

  // ---------------------------------------------------------------- inventory log, low-stock alerts, moderation queue
  const allProducts = await Product.find().lean();
  const weekStart = startOfDay(addDays(new Date(), -((new Date().getDay() + 6) % 7)));
  const reservedNow = new Map();
  for (const m of stockLog) reservedNow.set(String(m.product), (reservedNow.get(String(m.product)) || 0) - m.change);
  const movementDocs = [];
  for (const p of allProducts) {
    const opening = p.quantityAvailable + (reservedNow.get(String(p._id)) || 0);
    movementDocs.push({ farmer: p.farmer, product: p._id, productName: p.name, unit: p.unit, change: opening, quantityAfter: opening, type: 'template', reason: 'Weekly stock template', by: 'system', createdAt: weekStart, updatedAt: weekStart });
  }
  // A few hand adjustments at Malir Green Fields so the log shows every kind of movement
  const malirFarmer = farmerByKey.malir.farmer;
  const demoAdjust = [
    ['Farm Potatoes', 10, 'restock', 'Harvest / restock: second picking'],
    ['Purple Brinjal', -2, 'waste', 'Damaged or spoiled: bruised in transport'],
    ['Red Onions', -3, 'stall_sale', 'Sold at the stall'],
  ];
  let running = new Map(allProducts.map((p) => [String(p._id), p.quantityAvailable + (reservedNow.get(String(p._id)) || 0)]));
  for (const [name, change, type, reason] of demoAdjust) {
    const p = await Product.findOne({ farmer: malirFarmer._id, name });
    if (!p || p.quantityAvailable + change < 0) continue;
    p.quantityAvailable += change;
    await p.save();
    // Tuesday 2 am, or an hour ago when the week has only just started (a movement is never in the future)
    const at = new Date(Math.min(weekStart.getTime() + 26 * 3600 * 1000, Date.now() - 3600 * 1000));
    running.set(String(p._id), (running.get(String(p._id)) || 0) + change);
    movementDocs.push({ farmer: p.farmer, product: p._id, productName: p.name, unit: p.unit, change, quantityAfter: running.get(String(p._id)), type, reason, by: 'farmer', createdAt: at, updatedAt: at });
  }
  for (const m of stockLog.sort((a, b) => a.at - b.at)) {
    const p = allProducts.find((x) => String(x._id) === String(m.product));
    running.set(String(m.product), (running.get(String(m.product)) || 0) + m.change);
    movementDocs.push({ farmer: p.farmer, product: p._id, productName: p.name, unit: p.unit, change: m.change, quantityAfter: Math.max(0, running.get(String(m.product))), type: m.type, reason: `Pre-order ${m.orderNumber}`, order: m.order, orderNumber: m.orderNumber, by: m.by, createdAt: m.at, updatedAt: m.at });
  }
  await StockMovement.insertMany(movementDocs, { timestamps: false });

  // Low-stock alerts for products already at their alert level (in-app only while seeding)
  const low = await Product.find({ isRemoved: false, status: { $ne: 'unavailable' } }).populate('farmer', 'user stallName');
  const lowNotes = [];
  for (const p of low) {
    if (p.quantityAvailable > (p.lowStockThreshold ?? 5)) continue;
    const soldOut = p.quantityAvailable <= 0;
    p.lowStockAlertedAt = new Date();
    if (soldOut) p.soldOutAlertedAt = new Date();
    await p.save();
    lowNotes.push({
      user: p.farmer.user,
      type: 'stock',
      title: soldOut ? `${p.name} is sold out` : `Low stock: ${p.name}`,
      message: soldOut ? `${p.name} has no stock left, so customers cannot pre-order it. Add stock in Inventory when you have more.` : `Only ${p.quantityAvailable} ${p.unit} of ${p.name} left at ${p.farmer.stallName}. Restock it in Inventory before it sells out.`,
      link: '/farmer/inventory',
    });
  }
  if (lowNotes.length) await Notification.insertMany(lowNotes);

  // "Remind me when available" on the sold-out products (other customers and a few guests), for the demand report
  const waiting = [];
  const others = Object.values(customerByKey).filter((c) => c.email !== 'customer@marketlink.com');
  low.filter((p) => p.quantityAvailable <= 0).forEach((p, i) => {
    others.slice(0, 2 + (i % 3)).forEach((c, j) => waiting.push({ product: p._id, user: c._id, email: c.email, createdAt: addDays(new Date(), -(j * 3 + i + 1)) }));
    waiting.push({ product: p._id, email: `guest${i + 1}@example.com`, createdAt: addDays(new Date(), -(i + 2)) });
  });
  if (waiting.length) await RestockRequest.insertMany(waiting);

  // Moderation queue: one report from a customer and one review held by the word filter
  const someReview = await Review.findOne({ isRemoved: false, comment: { $exists: true } }).sort({ createdAt: -1 });
  const bilal = customerByKey.bilal;
  const flagged = [];
  if (someReview) flagged.push({ targetType: 'review', review: someReview._id, product: someReview.product, farmer: someReview.farmer, reason: 'misleading', note: 'This review talks about a different stall.', reporter: bilal._id });
  const heldOrder = await Order.findOne({ customer: customerByKey.usman._id, status: ORDER_STATUS.COMPLETED });
  if (heldOrder) {
    const held = await Review.create({ type: 'farmer', farmer: heldOrder.farmer, customer: customerByKey.usman._id, order: heldOrder._id, verified: true, rating: 1, comment: 'Total bakwas, the stall was closed when I came.', isRemoved: true, removedReason: 'Held for moderation' });
    flagged.push({ targetType: 'review', review: held._id, farmer: heldOrder.farmer, reason: 'auto_language', note: 'Contains "bakwas"' });
  }
  const listing = allProducts.find((p) => p.name === 'Green Olives in Brine');
  if (listing) flagged.push({ targetType: 'product', product: listing._id, farmer: listing.farmer, reason: 'wrong_info', note: 'The jar size in the photo is different from the one sold.', reporter: ayesha._id });
  await ContentFlag.insertMany(flagged);
  console.log(`[seed] ${movementDocs.length} stock movements, ${lowNotes.length} low-stock alerts, ${flagged.length} moderation reports`);

  // Market attendance of the last 30 days (admin report): most farmers checked in, a few said they could
  // not come (with the reason) and some market days have no check-in at all
  const attendance = [];
  const reasons = ['sick', 'transport', 'weather', 'harvest', 'family', 'other'];
  const reasonNotes = { sick: 'Fever, my son could not drive the van alone.', transport: 'The pickup truck broke down on the highway.', weather: 'Heavy rain, the market road was flooded.', harvest: 'The next picking was not ready yet.', family: 'Wedding in the family.', other: 'Stall repairs.' };
  const attendingFarmers = await Farmer.find({ isActive: true }).select('slug pickupWindows blockedDates').lean();
  for (let back = 30; back >= 0; back -= 1) {
    const day = addDays(new Date(), -back);
    const key = toDateKey(day);
    for (const f of attendingFarmers) {
      const windows = (f.pickupWindows || []).filter((w) => w.day === day.getDay());
      if (!windows.length) continue;
      // today: the other farmers whose market has started have checked in; the demo farmer has not (try it)
      if (back === 0 && (f.slug === 'malir-green-fields' || combineDateTime(key, windows.map((w) => w.start).sort()[0]) > new Date())) continue;
      const r = random();
      if (r < 0.78) {
        const start = windows.map((w) => w.start).sort()[0];
        const at = combineDateTime(key, start);
        const checkedAt = new Date(Math.min(at.getTime() + randInt(-20, 35) * 60000, Date.now()));
        attendance.push({ farmer: f._id, date: key, status: 'here', at: checkedAt });
        // today's check-in is also what customers see on the farmer's badge
        if (back === 0) await Farmer.updateOne({ _id: f._id }, { $set: { checkIn: { date: key, at: checkedAt } } });
      } else if (r < 0.9 && back > 0) {
        const reason = pickOne(reasons);
        const at = combineDateTime(key, '06:30');
        attendance.push({ farmer: f._id, date: key, status: 'away', reason, note: reasonNotes[reason], at: new Date(at.getTime() - randInt(0, 36) * 3600000), ordersAffected: randInt(0, 3) });
      }
    }
  }
  // closed dates the farmers set in advance
  for (const f of attendingFarmers) for (const d of f.blockedDates || []) attendance.push({ farmer: f._id, date: d, status: 'away', reason: 'closed_date', at: new Date() });
  await MarketDayLog.insertMany(attendance);
  console.log(`[seed] ${attendance.length} market-day check-ins and absences`);

  const to = new Date();
  const from = startOfDay(addDays(to, -29));
  await Report.create({ generatedBy: admin._id, reportType: 'orders_summary', title: REPORT_TITLES.orders_summary, from, to, data: await buildReport('orders_summary', from, to) });

  await markDataChanged(); // a running server empties its cache
  console.log('\n[seed] Done! Demo accounts:');
  console.table([
    { role: 'Admin', email: data.admin.email, password: data.PASSWORDS.admin, login: '/login' },
    { role: 'Farmer (approved)', email: 'farmer@marketlink.com', password: data.PASSWORDS.farmer, login: '/login' },
    { role: 'Farmer (pending)', email: 'pending.farmer@marketlink.com', password: data.PASSWORDS.farmer, login: '/login' },
    { role: 'Customer', email: 'customer@marketlink.com', password: data.PASSWORDS.customer, login: '/login' },
    { role: 'Customer (family member)', email: 'omar@marketlink.com', password: data.PASSWORDS.customer, login: '/login' },
  ]);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed] Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
