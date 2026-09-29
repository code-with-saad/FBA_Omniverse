import {
  Announcement,
  Category,
  ContactMessage,
  ContentFlag,
  Farmer,
  Market,
  Order,
  Product,
  Report,
  Review,
  User,
} from '../models/index.js';
import { announceNewFarmer } from '../services/customerAlerts.js';
import { REPORT_TYPES } from '../models/Report.js';
import { currentMonth } from '../models/Announcement.js';
import AppError from '../utils/AppError.js';
import { ORDER_STATUS, ROLES, USER_STATUS } from '../utils/constants.js';
import { assertId, containsRegex, getPagination, isValidId, pick, requireFields, toBool, toNumber, toNumberList } from '../utils/helpers.js';
import { isTime, parseDateKey, isDateKey, addDays, startOfDay } from '../utils/dates.js';
import { uniqueSlug } from '../utils/slug.js';
import { fileUrl } from '../middleware/upload.js';
import { notify, notifyMany } from '../services/notify.js';
import { syncFarmerProducts } from '../services/stock.js';
import { refreshRatings } from '../services/ratings.js';
import { ALL_REPORTS, buildAllReports, buildReport, REPORT_TITLES } from '../services/reports.js';
import { resolveCity } from './adminToolsController.js';
import { toList } from './helpers/farmDetails.js';

// ---------------------------------------------------------------- dashboard

// GET /api/admin/dashboard
export async function adminDashboard(req, res) {
  const [farmers, pendingFarmers, customers, markets, products, orders, openOrders, messages] = await Promise.all([
    User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.ACTIVE }),
    User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.PENDING }),
    User.countDocuments({ role: ROLES.CUSTOMER }),
    Market.countDocuments({ isActive: true }),
    Product.countDocuments({ isRemoved: false }),
    Order.countDocuments(),
    Order.countDocuments({ status: { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED, ORDER_STATUS.READY] } }),
    ContactMessage.countDocuments({ status: 'new' }),
  ]);

  const to = new Date();
  const from = startOfDay(addDays(to, -29));
  const [summary, top, recentOrders, pending] = await Promise.all([
    buildReport('orders_summary', from, to),
    buildReport('top_farmers', from, to),
    Order.find().populate('customer', 'name').populate('farmer', 'stallName').populate('market', 'name').sort({ createdAt: -1 }).limit(6).lean(),
    Farmer.find({ isActive: false }).populate({ path: 'user', match: { status: USER_STATUS.PENDING }, select: 'status createdAt' }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const allCompleted = await Order.find({ status: ORDER_STATUS.COMPLETED }).select('totalAmount').lean();
  res.json({
    totals: {
      farmers,
      pendingFarmers,
      customers,
      markets,
      products,
      orders,
      openOrders,
      newMessages: messages,
      revenue: Math.round(allCompleted.reduce((s, o) => s + o.totalAmount, 0) * 100) / 100,
    },
    last30: summary,
    topFarmers: top.rows.slice(0, 5),
    recentOrders,
    pendingFarmers: pending.filter((f) => f.user),
  });
}

// GET /api/admin/badges  (small counters for the admin sidebar)
export async function adminBadges(req, res) {
  const [pendingFarmers, newMessages, openOrders, openFlags, pickupProblems] = await Promise.all([
    User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.PENDING }),
    ContactMessage.countDocuments({ status: 'new' }),
    Order.countDocuments({ status: { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED, ORDER_STATUS.READY] } }),
    ContentFlag.countDocuments({ status: 'open' }),
    Order.countDocuments({ 'issue.status': { $in: ['open', 'disputed'] } }), // "not received" waiting for someone
  ]);
  res.json({ pendingFarmers, newMessages, openOrders, openFlags, pickupProblems });
}

// ---------------------------------------------------------------- farmers

// GET /api/admin/farmers?status=&search=
export async function adminFarmers(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const userFilter = { role: ROLES.FARMER };
  if (Object.values(USER_STATUS).includes(req.query.status)) userFilter.status = req.query.status;
  const users = await User.find(userFilter).select('_id').lean();
  const filter = { user: { $in: users.map((u) => u._id) } };
  if (req.query.search) filter.$or = [{ stallName: containsRegex(req.query.search) }, { contactPerson: containsRegex(req.query.search) }, { email: containsRegex(req.query.search) }];

  const [farmers, total] = await Promise.all([
    Farmer.find(filter)
      .populate('user', 'name email phone status createdAt lastLoginAt')
      .populate('markets', 'name')
      .populate('categories', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Farmer.countDocuments(filter),
  ]);
  const productCounts = await Promise.all(farmers.map((f) => Product.countDocuments({ farmer: f._id, isRemoved: false })));
  const orderCounts = await Promise.all(farmers.map((f) => Order.countDocuments({ farmer: f._id })));
  farmers.forEach((f, i) => {
    f.productCount = productCounts[i];
    f.orderCount = orderCounts[i];
  });
  res.json({ farmers, total, page, pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/farmers/:id/status  { status: active | suspended, reason? }
export async function setFarmerStatus(req, res) {
  const status = req.body.status;
  if (![USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED].includes(status)) throw new AppError('Status must be active or suspended', 400);
  const farmer = await Farmer.findById(assertId(req.params.id, 'farmer'));
  if (!farmer) throw new AppError('Farmer not found', 404);
  const user = await User.findById(farmer.user);
  const wasPending = user.status === USER_STATUS.PENDING;

  user.status = status;
  await user.save();
  farmer.isActive = status === USER_STATUS.ACTIVE;
  await farmer.save();
  await syncFarmerProducts(farmer, farmer.isActive);

  const reason = req.body.reason ? ` Reason: ${String(req.body.reason).slice(0, 200)}` : '';
  const message =
    status === USER_STATUS.ACTIVE
      ? wasPending
        ? `Welcome to MarketLink! ${farmer.stallName} has been approved. You can now list your weekly stock.`
        : `${farmer.stallName} has been re-activated.`
      : `${farmer.stallName} has been suspended by the MarketLink team.${reason}`;
  await notify(user, { type: 'account', title: status === USER_STATUS.ACTIVE ? 'Your stall is approved' : 'Your stall has been suspended', message, link: '/farmer' }, { email: true });
  // A newly approved stall: customers in its city and at its markets get a "new farmer" notification
  if (wasPending && status === USER_STATUS.ACTIVE) await announceNewFarmer(farmer);

  res.json({ farmer: { ...farmer.toObject(), user: user.toSafeJSON() } });
}

// ---------------------------------------------------------------- customers

// GET /api/admin/customers?status=&search=
export async function adminCustomers(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = { role: ROLES.CUSTOMER };
  if ([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.search) filter.$or = [{ name: containsRegex(req.query.search) }, { email: containsRegex(req.query.search) }, { phone: containsRegex(req.query.search) }];
  const [customers, total] = await Promise.all([
    User.find(filter).select('-favoriteFarmers -favoriteProducts -savedMarkets').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const orderCounts = await Promise.all(customers.map((c) => Order.countDocuments({ customer: c._id })));
  customers.forEach((c, i) => {
    c.orderCount = orderCounts[i];
  });
  res.json({ customers, total, page, pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/customers/:id/status  { status: active | inactive }
export async function setCustomerStatus(req, res) {
  const status = req.body.status;
  if (![USER_STATUS.ACTIVE, USER_STATUS.INACTIVE].includes(status)) throw new AppError('Status must be active or inactive', 400);
  const user = await User.findOne({ _id: assertId(req.params.id, 'customer'), role: ROLES.CUSTOMER });
  if (!user) throw new AppError('Customer not found', 404);
  user.status = status;
  await user.save();
  if (status === USER_STATUS.ACTIVE) {
    await notify(user, { type: 'account', title: 'Account re-activated', message: 'Your MarketLink account is active again.', link: '/account' }, { email: true });
  }
  res.json({ customer: user.toSafeJSON() });
}

// ---------------------------------------------------------------- markets

async function readMarketBody(body, partial) {
  const data = pick(body, ['name', 'description', 'descriptionUr', 'address', 'mapProvider', 'mapLink', 'openTime', 'closeTime']);
  // City comes from the cities table (dropdown); categories = what is sold at the market
  if (body.city !== undefined) data.city = await resolveCity(body.city);
  if (body.categories !== undefined) {
    const ids = toList(body.categories, 30).filter(isValidId);
    const found = await Category.find({ _id: { $in: ids } }).select('_id').lean();
    data.categories = found.map((c) => c._id);
  }
  if (!partial) requireFields({ ...body }, ['name', 'address', 'latitude', 'longitude']);
  for (const key of ['latitude', 'longitude']) {
    if (body[key] !== undefined && body[key] !== '') {
      const n = toNumber(body[key]);
      if (n === undefined) throw new AppError(`${key} must be a number`, 400);
      data[key] = n;
    }
  }
  if (body.operatingDays !== undefined) data.operatingDays = [...new Set(toNumberList(body.operatingDays).filter((d) => d >= 0 && d <= 6))].sort();
  for (const key of ['openTime', 'closeTime']) if (data[key] && !isTime(data[key])) throw new AppError(`${key} must be HH:MM`, 400);
  if (data.openTime && data.closeTime && data.closeTime <= data.openTime) throw new AppError('Closing time must be after opening time', 400);
  if (data.latitude !== undefined && Math.abs(data.latitude) > 90) throw new AppError('Latitude must be between -90 and 90', 400);
  if (data.longitude !== undefined && Math.abs(data.longitude) > 180) throw new AppError('Longitude must be between -180 and 180', 400);
  if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
  return data;
}

// GET /api/admin/markets
export async function adminMarkets(req, res) {
  const filter = {};
  if (req.query.search) filter.name = containsRegex(req.query.search);
  const markets = await Market.find(filter).populate('categories', 'name color').sort({ name: 1 }).lean();
  const counts = await Promise.all(markets.map((m) => Farmer.countDocuments({ markets: m._id })));
  res.json({ markets: markets.map((m, i) => ({ ...m, farmerCount: counts[i] })) });
}

// POST /api/admin/markets  (multipart: image)
export async function createMarket(req, res) {
  const data = await readMarketBody(req.body, false);
  const market = await Market.create({ ...data, slug: await uniqueSlug(Market, data.name), image: fileUrl('markets', req.file) });
  res.status(201).json({ market });
}

// PUT /api/admin/markets/:id
export async function updateMarket(req, res) {
  const market = await Market.findById(assertId(req.params.id, 'market'));
  if (!market) throw new AppError('Market not found', 404);
  const data = await readMarketBody(req.body, true);
  if (data.name && data.name !== market.name) market.slug = await uniqueSlug(Market, data.name, market._id);
  Object.assign(market, data);
  if (req.file) market.image = fileUrl('markets', req.file);
  await market.save();
  res.json({ market });
}

// DELETE /api/admin/markets/:id
// Markets that have order history are archived (hidden) instead of deleted.
export async function deleteMarket(req, res) {
  const market = await Market.findById(assertId(req.params.id, 'market'));
  if (!market) throw new AppError('Market not found', 404);

  const farmers = await Farmer.find({ markets: market._id });
  for (const farmer of farmers) {
    farmer.markets = farmer.markets.filter((m) => String(m) !== String(market._id));
    farmer.pickupWindows = farmer.pickupWindows.filter((w) => String(w.market) !== String(market._id));
    await farmer.save();
    await syncFarmerProducts(farmer);
    await notify(farmer.user, {
      type: 'system',
      title: `${market.name} was removed`,
      message: `${market.name} is no longer available on MarketLink. Please review your pickup windows.`,
      link: '/farmer/pickup',
    });
  }

  if (await Order.exists({ market: market._id })) {
    market.isActive = false;
    await market.save();
    return res.json({ message: 'Market archived (it has order history)', archived: true });
  }
  await market.deleteOne();
  res.json({ message: 'Market deleted' });
}

// ---------------------------------------------------------------- moderation

// GET /api/admin/products?search=&state=removed|active
export async function adminProducts(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = { deletedByFarmer: { $ne: true } }; // products the farmer deleted are not moderated
  if (req.query.state === 'removed') filter.isRemoved = true;
  if (req.query.state === 'active') filter.isRemoved = false;
  if (req.query.search) filter.name = containsRegex(req.query.search);
  const [products, total] = await Promise.all([
    Product.find(filter).populate('farmer', 'stallName slug').populate('category', 'name color').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ products, total, page, pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/products/:id/moderate  { action: remove | restore, reason }
export async function moderateProduct(req, res) {
  const product = await Product.findOne({ _id: assertId(req.params.id, 'product'), deletedByFarmer: { $ne: true } }).populate('farmer', 'user stallName');
  if (!product) throw new AppError('Product not found', 404);
  const remove = req.body.action === 'remove';
  product.isRemoved = remove;
  product.removedReason = remove ? String(req.body.reason || 'Violates platform guidelines').slice(0, 200) : undefined;
  await product.save();
  await notify(product.farmer.user, {
    type: 'system',
    title: remove ? `Listing removed: ${product.name}` : `Listing restored: ${product.name}`,
    message: remove ? `An administrator removed "${product.name}". Reason: ${product.removedReason}` : `"${product.name}" is visible again.`,
    link: '/farmer/products',
  });
  res.json({ product });
}

// GET /api/admin/reviews?state=removed|active&search=
export async function adminReviews(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = {};
  if (req.query.state === 'removed') filter.isRemoved = true;
  if (req.query.state === 'active') filter.isRemoved = false;
  if (req.query.search) filter.comment = containsRegex(req.query.search);
  const rating = toNumber(req.query.rating);
  if (rating) filter.rating = rating;
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('customer', 'name email')
      .populate('farmer', 'stallName slug')
      .populate('product', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);
  res.json({ reviews, total, page, pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/reviews/:id/moderate  { action: remove | restore, reason }
export async function moderateReview(req, res) {
  const review = await Review.findById(assertId(req.params.id, 'review'));
  if (!review) throw new AppError('Review not found', 404);
  const remove = req.body.action === 'remove';
  review.isRemoved = remove;
  review.removedReason = remove ? String(req.body.reason || 'Violates platform guidelines').slice(0, 200) : undefined;
  await review.save();
  await refreshRatings({ productId: review.product, farmerId: review.farmer });
  res.json({ review });
}

// ---------------------------------------------------------------- categories (master data)

// GET /api/admin/categories
export async function adminCategories(req, res) {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Promise.all(categories.map((c) => Product.countDocuments({ category: c._id, isRemoved: false })));
  res.json({ categories: categories.map((c, i) => ({ ...c, productCount: counts[i] })) });
}

// POST /api/admin/categories  (multipart: icon, image)
export async function createCategory(req, res) {
  requireFields(req.body, ['name']);
  const data = pick(req.body, ['name', 'nameUr', 'description', 'color']);
  const category = await Category.create({
    ...data,
    slug: await uniqueSlug(Category, data.name),
    sortOrder: toNumber(req.body.sortOrder, 0),
    icon: fileUrl('categories', req.files?.icon?.[0]),
    image: fileUrl('categories', req.files?.image?.[0]),
  });
  res.status(201).json({ category });
}

// PUT /api/admin/categories/:id
export async function updateCategory(req, res) {
  const category = await Category.findById(assertId(req.params.id, 'category'));
  if (!category) throw new AppError('Category not found', 404);
  const data = pick(req.body, ['name', 'nameUr', 'description', 'color']);
  if (data.name && data.name !== category.name) category.slug = await uniqueSlug(Category, data.name, category._id);
  Object.assign(category, data);
  if (req.body.sortOrder !== undefined) category.sortOrder = toNumber(req.body.sortOrder, 0);
  if (req.body.isActive !== undefined) category.isActive = toBool(req.body.isActive);
  if (req.files?.icon?.[0]) category.icon = fileUrl('categories', req.files.icon[0]);
  if (req.files?.image?.[0]) category.image = fileUrl('categories', req.files.image[0]);
  await category.save();
  res.json({ category });
}

// DELETE /api/admin/categories/:id
export async function deleteCategory(req, res) {
  const category = await Category.findById(assertId(req.params.id, 'category'));
  if (!category) throw new AppError('Category not found', 404);
  if (await Product.exists({ category: category._id })) {
    throw new AppError('This category is used by products. Deactivate it instead of deleting', 409);
  }
  await category.deleteOne();
  res.json({ message: 'Category deleted' });
}

// ---------------------------------------------------------------- announcements

// GET /api/admin/announcements
export async function adminAnnouncements(req, res) {
  const announcements = await Announcement.find().populate('createdBy', 'name').sort({ createdAt: -1 }).lean();
  res.json({ announcements, month: currentMonth() });
}

/** Months (1-12) and an optional on-site link from an announcement form. */
function announcementExtras(body) {
  const out = {};
  if (body.months !== undefined) {
    const months = [...new Set(toNumberList(body.months).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
    out.months = months.length === 12 ? [] : months; // every month = all year
  }
  if (body.link !== undefined) {
    const link = String(body.link || '').trim();
    if (link && (!link.startsWith('/') || link.startsWith('//'))) throw new AppError('The link must be a page on this site, e.g. /products?category=fruits', 400);
    out.link = link || undefined;
  }
  return out;
}

// POST /api/admin/announcements  { title, message, audience, months, link, notify }
export async function createAnnouncement(req, res) {
  requireFields(req.body, ['title', 'message']);
  const announcement = await Announcement.create({
    ...pick(req.body, ['title', 'message', 'titleUr', 'messageUr', 'audience']),
    ...announcementExtras(req.body),
    isActive: req.body.isActive === undefined ? true : toBool(req.body.isActive),
    createdBy: req.user._id,
  });

  // A notice for another season is saved now and appears in its months; it is not sent today.
  const inSeasonNow = !announcement.months.length || announcement.months.includes(currentMonth());
  let delivered = 0;
  if (inSeasonNow && toBool(req.body.notify ?? true)) {
    const roles = announcement.audience === 'all' ? [ROLES.CUSTOMER, ROLES.FARMER] : [announcement.audience];
    const users = await User.find({ role: { $in: roles }, status: USER_STATUS.ACTIVE }).select('_id').lean();
    delivered = await notifyMany(
      users.map((u) => u._id),
      { type: 'announcement', title: announcement.title, message: announcement.message, link: announcement.link }
    );
  }
  res.status(201).json({ announcement, delivered, inSeason: inSeasonNow });
}

// PUT /api/admin/announcements/:id
export async function updateAnnouncement(req, res) {
  const announcement = await Announcement.findById(assertId(req.params.id, 'announcement'));
  if (!announcement) throw new AppError('Announcement not found', 404);
  Object.assign(announcement, pick(req.body, ['title', 'message', 'titleUr', 'messageUr', 'audience']), announcementExtras(req.body));
  if (req.body.isActive !== undefined) announcement.isActive = toBool(req.body.isActive);
  await announcement.save();
  res.json({ announcement });
}

// DELETE /api/admin/announcements/:id
export async function deleteAnnouncement(req, res) {
  await Announcement.deleteOne({ _id: assertId(req.params.id, 'announcement') });
  res.json({ message: 'Announcement deleted' });
}

// ---------------------------------------------------------------- reports

function readRange(body) {
  const to = isDateKey(body.to) ? parseDateKey(body.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = isDateKey(body.from) ? parseDateKey(body.from) : startOfDay(addDays(to, -29));
  if (from > to) throw new AppError('"From" date must be before "To" date', 400);
  if ((to - from) / 86400000 > 366) throw new AppError('Please choose a range of at most one year', 400);
  return { from, to };
}

// POST /api/admin/reports  { reportType, from, to }
export async function generateReport(req, res) {
  const { reportType } = req.body;
  if (!REPORT_TYPES.includes(reportType)) throw new AppError('Unknown report type', 400);
  const { from, to } = readRange(req.body);
  const data = await buildReport(reportType, from, to);
  const report = await Report.create({ generatedBy: req.user._id, reportType, title: REPORT_TITLES[reportType], from, to, data });
  res.status(201).json({ report });
}

// GET /api/admin/reports/all?from=&to=   (every platform report for one period, shown together)
export async function allReports(req, res) {
  const { from, to } = readRange(req.query);
  const sections = await buildAllReports(from, to);
  res.json({ from, to, generatedAt: new Date(), order: ALL_REPORTS, titles: REPORT_TITLES, sections });
}

// GET /api/admin/reports
export async function listReports(req, res) {
  const reports = await Report.find().select('-data').populate('generatedBy', 'name').sort({ generatedAt: -1 }).limit(50).lean();
  res.json({ reports, types: REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TITLES[t] })) });
}

// GET /api/admin/reports/:id
export async function getReport(req, res) {
  const report = await Report.findById(assertId(req.params.id, 'report')).populate('generatedBy', 'name').lean();
  if (!report) throw new AppError('Report not found', 404);
  res.json({ report });
}

// DELETE /api/admin/reports/:id
export async function deleteReport(req, res) {
  await Report.deleteOne({ _id: assertId(req.params.id, 'report') });
  res.json({ message: 'Report deleted' });
}

// ---------------------------------------------------------------- orders & messages

// GET /api/admin/orders?status=&market=&search=
export async function adminOrders(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = {};
  if (Object.values(ORDER_STATUS).includes(req.query.status)) filter.status = req.query.status;
  if (isValidId(req.query.market)) filter.market = req.query.market;
  if (req.query.search) filter.orderNumber = containsRegex(req.query.search);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name email')
      .populate('farmer', 'stallName slug')
      .populate('market', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, total, page, pages: Math.ceil(total / limit) });
}

// GET /api/admin/messages
export async function adminMessages(req, res) {
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ messages });
}

// PATCH /api/admin/messages/:id  { status: read | new }
export async function updateMessage(req, res) {
  const status = req.body.status === 'new' ? 'new' : 'read';
  await ContactMessage.updateOne({ _id: assertId(req.params.id, 'message') }, { status });
  res.json({ ok: true });
}

// DELETE /api/admin/messages/:id
export async function deleteMessage(req, res) {
  await ContactMessage.deleteOne({ _id: assertId(req.params.id, 'message') });
  res.json({ ok: true });
}
