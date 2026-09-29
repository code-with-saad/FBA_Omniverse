import { Announcement, Category, ContactMessage, Farmer, Market, Order, Product, Review, User } from '../models/index.js';
import { ORDER_STATUS, ROLES, USER_STATUS } from '../utils/constants.js';
import { containsRegex, pick, requireFields, toNumber } from '../utils/helpers.js';
import { notifyMany } from '../services/notify.js';
import { inSeason } from '../models/Announcement.js';
import { resolveCategory } from './helpers/category.js';
import { CONTACT_TOPICS } from '../models/ContactMessage.js';

// GET /api/stats  -> numbers shown on the home page
export async function publicStats(req, res) {
  const [markets, farmers, products, customers, ordersCompleted] = await Promise.all([
    Market.countDocuments({ isActive: true }),
    Farmer.countDocuments({ isActive: true }),
    Product.countDocuments(Product.publicFilter()),
    User.countDocuments({ role: ROLES.CUSTOMER, status: USER_STATUS.ACTIVE }),
    Order.countDocuments({ status: ORDER_STATUS.COMPLETED }),
  ]);
  res.json({ markets, farmers, products, customers, ordersCompleted, deals: await dealSummary() });
}

/**
 * This week's offers for the "Up to N% off" banner: how many products are on offer, the biggest
 * saving and the category where it is (null when no farmer runs an offer).
 */
async function dealSummary() {
  const offers = await Product.find({ ...Product.publicFilter(), quantityAvailable: { $gt: 0 }, $expr: { $gt: ['$compareAtPrice', '$price'] } })
    .select('price compareAtPrice category')
    .populate('category', 'name nameUr slug')
    .lean();
  if (!offers.length) return null;
  const percent = (p) => Math.round((1 - p.price / p.compareAtPrice) * 100);
  const best = offers.reduce((a, b) => (percent(b) > percent(a) ? b : a));
  return { count: offers.length, maxPercent: percent(best), category: best.category ? { name: best.category.name, nameUr: best.category.nameUr, slug: best.category.slug } : null };
}

// GET /api/practices  (farming practices used by approved farmers, for the filter dropdowns)
export async function listPractices(req, res) {
  const tags = await Farmer.distinct('tags', { isActive: true });
  const unique = [...new Map(tags.filter(Boolean).map((t) => [t.toLowerCase(), t])).values()];
  res.json({ practices: unique.sort((a, b) => a.localeCompare(b)) });
}

// GET /api/categories
export async function listCategories(req, res) {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Promise.all(
    categories.map((c) => Product.countDocuments({ ...Product.publicFilter(), category: c._id }))
  );
  res.json({ categories: categories.map((c, i) => ({ ...c, productCount: counts[i] })) });
}

// GET /api/search?q=&category=  -> quick search across products, farmers and markets
export async function globalSearch(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ products: [], farmers: [], markets: [] });
  const regex = containsRegex(q);
  // Category-wise search: only products of that category, and only farmers who sell it
  const category = req.query.category ? await resolveCategory(String(req.query.category)) : null;
  if (req.query.category && !category) return res.json({ products: [], farmers: [], markets: [] });
  const productFilter = { ...Product.publicFilter(), $or: [{ name: regex }, { nameUr: regex }, { keywords: regex }], ...(category ? { category: category._id } : {}) };
  const farmerFilter = { isActive: true, $or: [{ stallName: regex }, { tags: regex }] };
  if (category) farmerFilter._id = { $in: await Product.distinct('farmer', { ...Product.publicFilter(), category: category._id }) };
  const [products, farmers, markets] = await Promise.all([
    Product.find(productFilter)
      .select('name nameUr slug price unit image status quantityAvailable farmer category')
      .populate('farmer', 'stallName slug')
      .populate('category', 'name nameUr slug color')
      .limit(6)
      .lean(),
    Farmer.find(farmerFilter)
      .select('stallName slug logo ratingAvg')
      .limit(4)
      .lean(),
    category
      ? []
      : Market.find({ isActive: true, $or: [{ name: regex }, { address: regex }, { city: regex }] })
          .select('name slug address image')
          .limit(4)
          .lean(),
  ]);
  res.json({ products, farmers, markets });
}

// GET /api/map?day=&search=  -> every market and farmer stall with coordinates
export async function mapData(req, res) {
  const marketFilter = { isActive: true };
  const farmerFilter = { isActive: true, latitude: { $ne: null }, longitude: { $ne: null } };
  const day = toNumber(req.query.day);
  if (day !== undefined && day >= 0 && day <= 6) {
    marketFilter.operatingDays = day;
    farmerFilter.operatingDays = day;
  }
  if (req.query.search) {
    marketFilter.$or = [{ name: containsRegex(req.query.search) }, { address: containsRegex(req.query.search) }];
    farmerFilter.stallName = containsRegex(req.query.search);
  }
  const [markets, farmers] = await Promise.all([
    Market.find(marketFilter)
      .select('name slug address city latitude longitude operatingDays openTime closeTime image')
      .lean(),
    Farmer.find(farmerFilter)
      .select('stallName slug logo address city latitude longitude operatingDays ratingAvg ratingCount markets tags')
      .populate('markets', 'name slug')
      .lean(),
  ]);
  res.json({ markets, farmers });
}

// GET /api/announcements/active
export async function activeAnnouncements(req, res) {
  const audiences = ['all'];
  if (req.user?.role === ROLES.CUSTOMER) audiences.push('customer');
  if (req.user?.role === ROLES.FARMER) audiences.push('farmer');
  // Seasonal notices only show in their months (e.g. mangoes in summer, kinnow in winter)
  const announcements = await Announcement.find({ isActive: true, audience: { $in: audiences }, ...inSeason() })
    .select('title message titleUr messageUr audience months link createdAt')
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  res.json({ announcements });
}

// GET /api/testimonials  -> recent good reviews for the home page, plus the overall rating summary
export async function testimonials(req, res) {
  const visible = { isRemoved: false };
  const [reviews, summary] = await Promise.all([
    Review.find({ ...visible, rating: { $gte: 4 }, comment: { $exists: true, $ne: '' } })
      .populate('customer', 'name avatar city')
      .populate('farmer', 'stallName slug logo city')
      .populate('product', 'name nameUr slug image')
      .sort({ verified: -1, rating: -1, createdAt: -1 })
      .limit(80)
      .lean(),
    Review.aggregate([
      { $match: visible },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avg: { $avg: '$rating' },
          verified: { $sum: { $cond: ['$verified', 1, 0] } },
          r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const s = summary[0];
  // Every comment text once and at most two reviews per customer, so the home page shows a varied wall
  const seenText = new Set();
  const perCustomer = new Map();
  const picked = [];
  for (const r of reviews) {
    const text = r.comment.trim().toLowerCase();
    const who = String(r.customer?._id || '');
    if (seenText.has(text) || (perCustomer.get(who) || 0) >= 2) continue;
    seenText.add(text);
    perCustomer.set(who, (perCustomer.get(who) || 0) + 1);
    picked.push(r);
    if (picked.length === 12) break;
  }
  res.json({
    reviews: picked.map(({ customer, ...r }) => ({ ...r, customer: customer ? { name: customer.name, avatar: customer.avatar, city: customer.city } : null })),
    summary: s
      ? { count: s.count, average: Math.round(s.avg * 10) / 10, verifiedShare: Math.round((s.verified / s.count) * 100), stars: { 5: s.r5, 4: s.r4, 3: s.r3, 2: s.r2, 1: s.r1 } }
      : { count: 0, average: 0, verifiedShare: 0, stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
  });
}

// POST /api/contact
export async function submitContact(req, res) {
  requireFields(req.body, ['name', 'email', 'message']);
  const data = pick(req.body, ['name', 'email', 'subject', 'message']);
  if (CONTACT_TOPICS.includes(req.body.topic)) data.topic = req.body.topic; // optional
  const msg = await ContactMessage.create(data);
  const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
  await notifyMany(
    admins.map((a) => a._id),
    { type: 'system', title: 'New contact message', message: `${msg.name}: ${msg.subject || msg.message.slice(0, 60)}`, link: '/admin/messages' }
  );
  res.status(201).json({ message: 'Thank you! Our team will get back to you soon.' });
}

// GET /api/credits  -> who took the licensed stock photos (listed on the Photo credits page, not on the photos)
export async function photoCredits(req, res) {
  const [products, farmers, markets] = await Promise.all([
    Product.find({ ...Product.publicFilter(), $or: [{ 'imageCredit.author': { $exists: true, $ne: '' } }, { 'gallery.credit.author': { $exists: true, $ne: '' } }] })
      .select('name nameUr slug imageCredit gallery.credit')
      .sort({ name: 1 })
      .lean(),
    Farmer.find({ isActive: true, 'coverCredit.author': { $exists: true, $ne: '' } }).select('stallName slug coverCredit').sort({ stallName: 1 }).lean(),
    Market.find({ isActive: true, 'imageCredit.author': { $exists: true, $ne: '' } }).select('name slug imageCredit').sort({ name: 1 }).lean(),
  ]);
  const credits = (list) => list.filter((c) => c?.author).map((c) => pick(c, ['author', 'source', 'license']));
  res.json({
    products: products.map((p) => ({ name: p.name, nameUr: p.nameUr, link: `/products/${p.slug || p._id}`, credits: credits([p.imageCredit, ...(p.gallery || []).map((g) => g.credit)]) })),
    farmers: farmers.map((f) => ({ name: f.stallName, link: `/farmers/${f.slug}`, credits: credits([f.coverCredit]) })),
    markets: markets.map((m) => ({ name: m.name, link: `/markets/${m.slug}`, credits: credits([m.imageCredit]) })),
  });
}
