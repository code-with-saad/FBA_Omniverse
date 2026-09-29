import crypto from 'node:crypto';
import { Category, City, ContactMessage, ContentFlag, Farmer, Market, Order, Product, Review, Subscriber, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { ORDER_STATUS, ROLES, USER_STATUS } from '../utils/constants.js';
import { assertId, escapeRegex, isValidId, requireFields, round2, slugify, toNumber } from '../utils/helpers.js';
import { dataTableQuery, dateRange, searchRegex } from '../utils/dataTable.js';
import { uniqueSlug } from '../utils/slug.js';
import { isoWeekKey } from '../utils/dates.js';
import { readFarmDetails } from './helpers/farmDetails.js';
import { createPreOrders } from './orderController.js';
import { sendMail } from '../services/mailer.js';
import { notify } from '../services/notify.js';
import { describeFarm, describeProduct } from '../services/describe.js';
import { KINDS as WRITE_KINDS, writeText } from '../services/writer.js';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
const OPEN_STATUSES = [ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED, ORDER_STATUS.READY];

// ================================================================ cities

/** Returns the official city name for a value from a city dropdown ('' when empty). */
export async function resolveCity(value) {
  const name = String(value || '').trim();
  if (!name) return '';
  const city = await City.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i'), isActive: true }).lean();
  if (!city) throw new AppError('Please choose a city from the list', 400);
  return city.name;
}

// GET /api/cities  (public: active cities with how many markets and farmers they have)
export async function listCities(req, res) {
  const [cities, markets, farmers] = await Promise.all([
    City.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Market.find({ isActive: true }).select('city').lean(),
    Farmer.find({ isActive: true }).select('city').lean(),
  ]);
  const count = (list, name) => list.filter((x) => x.city === name).length;
  res.json({ cities: cities.map((c) => ({ ...c, markets: count(markets, c.name), farmers: count(farmers, c.name) })) });
}

// GET /api/admin/cities
export async function adminCities(req, res) {
  const [cities, markets, farmers, customers] = await Promise.all([
    City.find().sort({ sortOrder: 1, name: 1 }).lean(),
    Market.find().select('city').lean(),
    Farmer.find().select('city').lean(),
    User.find({ role: ROLES.CUSTOMER }).select('city').lean(),
  ]);
  const count = (list, name) => list.filter((x) => (x.city || '').toLowerCase() === name.toLowerCase()).length;
  res.json({ cities: cities.map((c) => ({ ...c, markets: count(markets, c.name), farmers: count(farmers, c.name), customers: count(customers, c.name) })) });
}

function readCityBody(body) {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim().slice(0, 60);
  if (body.province !== undefined) data.province = String(body.province).trim().slice(0, 60);
  for (const key of ['latitude', 'longitude']) {
    if (body[key] !== undefined && body[key] !== '') {
      const n = toNumber(body[key]);
      if (n === undefined || Math.abs(n) > (key === 'latitude' ? 90 : 180)) throw new AppError(`Please enter a valid ${key}`, 400);
      data[key] = n;
    }
  }
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === 'true';
  if (body.sortOrder !== undefined) data.sortOrder = toNumber(body.sortOrder, 0);
  return data;
}

// POST /api/admin/cities
export async function createCity(req, res) {
  requireFields(req.body, ['name']);
  const data = readCityBody(req.body);
  if (await City.exists({ name: new RegExp(`^${escapeRegex(data.name)}$`, 'i') })) throw new AppError('This city already exists', 409);
  const city = await City.create({ ...data, slug: slugify(data.name), sortOrder: data.sortOrder ?? (await City.countDocuments()) });
  res.status(201).json({ city });
}

// PUT /api/admin/cities/:id  (renaming a city also renames it on markets, farmers and customers)
export async function updateCity(req, res) {
  const city = await City.findById(assertId(req.params.id, 'city'));
  if (!city) throw new AppError('City not found', 404);
  const data = readCityBody(req.body);
  const oldName = city.name;
  if (data.name && data.name.toLowerCase() !== oldName.toLowerCase()) {
    if (await City.exists({ _id: { $ne: city._id }, name: new RegExp(`^${escapeRegex(data.name)}$`, 'i') })) throw new AppError('This city already exists', 409);
    data.slug = slugify(data.name);
  }
  Object.assign(city, data);
  await city.save();
  if (data.name && data.name !== oldName) {
    await Promise.all([Market.updateMany({ city: oldName }, { city: data.name }), Farmer.updateMany({ city: oldName }, { city: data.name }), User.updateMany({ city: oldName }, { city: data.name })]);
  }
  res.json({ city });
}

// DELETE /api/admin/cities/:id  (only when no market uses it; otherwise hide it instead)
export async function deleteCity(req, res) {
  const city = await City.findById(assertId(req.params.id, 'city'));
  if (!city) throw new AppError('City not found', 404);
  const used = await Market.countDocuments({ city: city.name });
  if (used) throw new AppError(`${used} market(s) are in ${city.name}. Move them first, or hide the city instead.`, 400);
  await city.deleteOne();
  res.json({ message: 'City deleted' });
}

// ================================================================ accounts created by the admin

async function prepareLogin(body) {
  if (body.password) {
    if (!PASSWORD_RULE.test(String(body.password))) throw new AppError('Password must be at least 8 characters and contain letters and numbers', 400);
    return { password: String(body.password), invite: false };
  }
  // No password typed: a random one is set and the person gets an e-mail to choose their own
  return { password: `${crypto.randomBytes(18).toString('base64url')}9a`, invite: true };
}

async function sendInvite(req, user, what) {
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordHash = crypto.createHash('sha256').update(token).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 3 days
  await user.save();
  const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
  await sendMail({
    to: user.email,
    subject: 'Your MarketLink account is ready',
    message: `Hi ${user.name},\nThe MarketLink team created ${what} for you with this e-mail address.\nUse the button below within 3 days to choose your password, then log in at ${origin}/login.`,
    link: `${origin}/reset-password/${token}`,
    linkLabel: 'Choose my password',
  });
}

// POST /api/admin/farmers  (admin registers a stall; approved straight away unless status=pending)
export async function createFarmerAccount(req, res) {
  requireFields(req.body, ['stallName', 'contactPerson', 'phone', 'email', 'address']);
  const city = await resolveCity(req.body.city);
  const details = await readFarmDetails(req.body);
  const status = req.body.status === USER_STATUS.PENDING ? USER_STATUS.PENDING : USER_STATUS.ACTIVE;
  const { password, invite } = await prepareLogin(req.body);
  const { stallName, contactPerson, phone, email, address } = req.body;

  const user = await User.create({ name: contactPerson, email, password, phone, address, city, role: ROLES.FARMER, status });
  let farmer;
  try {
    farmer = await Farmer.create({
      user: user._id,
      stallName,
      slug: await uniqueSlug(Farmer, stallName),
      contactPerson,
      phone,
      email: user.email,
      address,
      city,
      ...details,
      isActive: status === USER_STATUS.ACTIVE,
      templateLastAppliedWeek: isoWeekKey(),
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  if (invite) await sendInvite(req, user, `a stall account (${stallName})`);
  await notify(user, {
    type: 'account',
    title: 'Welcome to MarketLink',
    message:
      status === USER_STATUS.ACTIVE
        ? `${stallName} was registered by the MarketLink team and is approved. Add your weekly stock and pickup times to start taking pre-orders.`
        : `${stallName} was registered by the MarketLink team and is waiting for approval.`,
    link: '/farmer',
  });
  res.status(201).json({ farmer, user: user.toSafeJSON(), inviteSent: invite });
}

// POST /api/admin/customers
export async function createCustomerAccount(req, res) {
  requireFields(req.body, ['name', 'email', 'phone', 'address']);
  const city = req.body.city ? await resolveCity(req.body.city) : '';
  const { password, invite } = await prepareLogin(req.body);
  const { name, email, phone, address } = req.body;
  const user = await User.create({ name, email, password, phone, address, city, role: ROLES.CUSTOMER, status: USER_STATUS.ACTIVE });
  if (invite) await sendInvite(req, user, 'a customer account');
  await notify(user, { type: 'account', title: 'Welcome to MarketLink', message: 'Your account was created by the MarketLink team. Browse local markets and pre-order fresh produce.', link: '/account' });
  res.status(201).json({ customer: user.toSafeJSON(), inviteSent: invite });
}

// ================================================================ admin places an order

// GET /api/admin/order-options  (customers and farmers for the "Place order" dialog)
export async function orderOptions(req, res) {
  const [customers, farmers] = await Promise.all([
    User.find({ role: ROLES.CUSTOMER, status: USER_STATUS.ACTIVE }).select('name email phone city').sort({ name: 1 }).lean(),
    Farmer.find({ isActive: true }).select('stallName slug city logo pickupWindows').sort({ stallName: 1 }).lean(),
  ]);
  res.json({
    customers,
    farmers: farmers.map(({ pickupWindows, ...f }) => ({ ...f, hasPickup: (pickupWindows || []).length > 0 })),
  });
}

// POST /api/admin/orders  { customerId, groups: [...] }  (same checks as the customer checkout)
export async function adminPlaceOrder(req, res) {
  const customer = await User.findOne({ _id: assertId(req.body.customerId, 'customer'), role: ROLES.CUSTOMER });
  if (!customer) throw new AppError('Please choose a customer', 400);
  if (customer.status !== USER_STATUS.ACTIVE) throw new AppError('This customer account is not active', 400);
  const orders = await createPreOrders(customer, req.body.groups, { by: 'admin' });
  res.status(201).json({ orders });
}

// ================================================================ customer history and purchase analytics

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Groups orders by farmer: orders, items, amount and what was bought. */
function purchasesByFarmer(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = String(o.farmer?._id || o.farmer);
    if (!map.has(key)) {
      map.set(key, { farmerId: key, farmer: o.farmer?.stallName || 'Removed stall', slug: o.farmer?.slug, orders: 0, completed: 0, amount: 0, items: 0, products: new Map(), lastOrder: null });
    }
    const row = map.get(key);
    row.orders += 1;
    if (o.status === ORDER_STATUS.COMPLETED) row.completed += 1;
    row.amount += o.totalAmount;
    if (!row.lastOrder || o.createdAt > row.lastOrder) row.lastOrder = o.createdAt;
    for (const i of o.items) {
      row.items += i.quantity;
      const p = row.products.get(i.name) || { name: i.name, unit: i.unit, quantity: 0, amount: 0 };
      p.quantity += i.quantity;
      p.amount += i.subtotal;
      row.products.set(i.name, p);
    }
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      amount: round2(r.amount),
      products: [...r.products.values()].map((p) => ({ ...p, amount: round2(p.amount) })).sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

// GET /api/admin/customers/:id/overview  (profile, totals and purchases by farmer)
export async function customerOverview(req, res) {
  const customer = await User.findOne({ _id: assertId(req.params.id, 'customer'), role: ROLES.CUSTOMER }).lean();
  if (!customer) throw new AppError('Customer not found', 404);
  delete customer.password;
  const orders = await Order.find({ customer: customer._id }).populate('farmer', 'stallName slug').populate('market', 'name').sort({ createdAt: -1 }).lean();
  const completed = orders.filter((o) => o.status === ORDER_STATUS.COMPLETED);
  const spent = round2(completed.reduce((s, o) => s + o.totalAmount, 0));

  const months = new Map();
  for (const o of orders) {
    const key = monthKey(new Date(o.createdAt));
    const m = months.get(key) || { month: key, orders: 0, amount: 0 };
    m.orders += 1;
    if (o.status === ORDER_STATUS.COMPLETED) m.amount = round2(m.amount + o.totalAmount);
    months.set(key, m);
  }
  const household = customer.household ? await User.find({ household: customer.household, _id: { $ne: customer._id } }).select('name email').lean() : [];

  res.json({
    customer: { ...customer, favorites: { farmers: customer.favoriteFarmers?.length || 0, products: customer.favoriteProducts?.length || 0, markets: customer.savedMarkets?.length || 0 } },
    household,
    stats: {
      orders: orders.length,
      completed: completed.length,
      open: orders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
      cancelled: orders.filter((o) => [ORDER_STATUS.CANCELLED, ORDER_STATUS.DECLINED].includes(o.status)).length,
      spent,
      average: completed.length ? round2(spent / completed.length) : 0,
      farmers: new Set(orders.map((o) => String(o.farmer?._id))).size,
      firstOrder: orders.at(-1)?.createdAt || null,
      lastOrder: orders[0]?.createdAt || null,
    },
    byFarmer: purchasesByFarmer(orders.filter((o) => ![ORDER_STATUS.CANCELLED, ORDER_STATUS.DECLINED].includes(o.status))),
    byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
  });
}

async function analyticsFilter(q) {
  const filter = {};
  if (q.status === 'all') filter.status = { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.DECLINED] };
  else if (Object.values(ORDER_STATUS).includes(q.status)) filter.status = q.status;
  else filter.status = ORDER_STATUS.COMPLETED; // default: what customers actually bought
  Object.assign(filter, dateRange('createdAt', q.from, q.to));
  if (isValidId(q.farmer)) filter.farmer = q.farmer;
  if (isValidId(q.customer)) filter.customer = q.customer;
  if (isValidId(q.market)) filter.market = q.market;
  if (q.city) {
    const markets = await Market.find({ city: String(q.city) }).select('_id').lean();
    filter.market = isValidId(q.market) ? q.market : { $in: markets.map((m) => m._id) };
  }
  if (isValidId(q.category)) {
    const products = await Product.find({ category: q.category }).select('_id').lean();
    filter['items.product'] = { $in: products.map((p) => p._id) };
  }
  return filter;
}

// GET /api/admin/analytics/purchases  (which customer bought what from which farmer)
export async function purchaseAnalytics(req, res) {
  const filter = await analyticsFilter(req.query);
  const orders = await Order.find(filter)
    .populate('customer', 'name email city')
    .populate('farmer', 'stallName slug city')
    .populate('market', 'name city')
    .sort({ createdAt: 1 })
    .lean();

  const pairs = new Map();
  const byFarmer = new Map();
  const byCustomer = new Map();
  const products = new Map();
  const days = new Map();
  let items = 0;
  let amount = 0;

  for (const o of orders) {
    const cId = String(o.customer?._id || o.customer);
    const fId = String(o.farmer?._id || o.farmer);
    const cName = o.customer?.name || 'Deleted customer';
    const fName = o.farmer?.stallName || 'Removed stall';
    const qty = o.items.reduce((s, i) => s + i.quantity, 0);
    items += qty;
    amount += o.totalAmount;

    const pk = `${cId}|${fId}`;
    const pair = pairs.get(pk) || { customerId: cId, customer: cName, email: o.customer?.email, city: o.customer?.city || '', farmerId: fId, farmer: fName, farmerSlug: o.farmer?.slug, orders: 0, items: 0, amount: 0, products: new Map(), firstOrder: o.createdAt, lastOrder: o.createdAt };
    pair.orders += 1;
    pair.items += qty;
    pair.amount += o.totalAmount;
    pair.lastOrder = o.createdAt;
    for (const i of o.items) {
      const p = pair.products.get(i.name) || { name: i.name, unit: i.unit, quantity: 0, amount: 0 };
      p.quantity += i.quantity;
      p.amount += i.subtotal;
      pair.products.set(i.name, p);

      const tk = `${fId}|${i.name}`;
      const t = products.get(tk) || { product: i.name, unit: i.unit, farmer: fName, quantity: 0, amount: 0, customers: new Set() };
      t.quantity += i.quantity;
      t.amount += i.subtotal;
      t.customers.add(cId);
      products.set(tk, t);
    }
    pairs.set(pk, pair);

    const f = byFarmer.get(fId) || { farmerId: fId, farmer: fName, orders: 0, amount: 0, customers: new Set() };
    f.orders += 1;
    f.amount += o.totalAmount;
    f.customers.add(cId);
    byFarmer.set(fId, f);

    const c = byCustomer.get(cId) || { customerId: cId, customer: cName, city: o.customer?.city || '', orders: 0, amount: 0, farmers: new Set() };
    c.orders += 1;
    c.amount += o.totalAmount;
    c.farmers.add(fId);
    byCustomer.set(cId, c);

    const dk = new Date(o.createdAt).toISOString().slice(0, 10);
    const d = days.get(dk) || { date: dk, orders: 0, amount: 0 };
    d.orders += 1;
    d.amount = round2(d.amount + o.totalAmount);
    days.set(dk, d);
  }

  const pairRows = [...pairs.values()]
    .map((p) => {
      const list = [...p.products.values()].sort((a, b) => b.amount - a.amount);
      return { ...p, amount: round2(p.amount), products: list.map((x) => ({ ...x, amount: round2(x.amount) })), productSummary: list.map((x) => `${x.name} (${x.quantity} ${x.unit})`).join(', ') };
    })
    .sort((a, b) => b.amount - a.amount);
  const farmerRows = [...byFarmer.values()].map((f) => ({ ...f, amount: round2(f.amount), customers: f.customers.size })).sort((a, b) => b.amount - a.amount);
  const customerRows = [...byCustomer.values()].map((c) => ({ ...c, amount: round2(c.amount), farmers: c.farmers.size })).sort((a, b) => b.amount - a.amount);

  // Matrix of the top customers x top farmers (amount spent)
  const topC = customerRows.slice(0, 8);
  const topF = farmerRows.slice(0, 8);
  const matrix = topC.map((c) => ({
    customerId: c.customerId,
    customer: c.customer,
    cells: topF.map((f) => round2(pairs.get(`${c.customerId}|${f.farmerId}`)?.amount || 0)),
  }));

  res.json({
    filters: { status: filter.status, from: req.query.from || '', to: req.query.to || '' },
    totals: { orders: orders.length, items, amount: round2(amount), customers: byCustomer.size, farmers: byFarmer.size, pairs: pairs.size },
    pairs: pairRows,
    byFarmer: farmerRows,
    byCustomer: customerRows,
    topProducts: [...products.values()].map((t) => ({ ...t, amount: round2(t.amount), customers: t.customers.size })).sort((a, b) => b.amount - a.amount).slice(0, 15),
    matrix: { farmers: topF.map((f) => f.farmer), rows: matrix },
    series: [...days.values()],
  });
}

// ================================================================ DataTables (server-side processing)

const REGEX_FIELDS = (fields, text) => ({ $or: fields.map((f) => ({ [f]: searchRegex(text) })) });

async function userIdsMatching(text, role) {
  const users = await User.find({ ...(role ? { role } : {}), ...REGEX_FIELDS(['name', 'email', 'phone'], text) }).select('_id').lean();
  return users.map((u) => u._id);
}

async function countBy(Model, field, ids, extra = {}) {
  const rows = await Model.find({ [field]: { $in: ids }, ...extra }).select(field).lean();
  const map = new Map();
  for (const r of rows) map.set(String(r[field]), (map.get(String(r[field])) || 0) + 1);
  return map;
}

const TABLES = {
  // Farmers with account status, city, markets and activity
  farmers: (req) =>
    dataTableQuery({
      req,
      Model: Farmer,
      filter: async (f) => {
        const q = {};
        if (Object.values(USER_STATUS).includes(f.status)) {
          const users = await User.find({ role: ROLES.FARMER, status: f.status }).select('_id').lean();
          q.user = { $in: users.map((u) => u._id) };
        }
        if (f.city) q.city = String(f.city);
        if (isValidId(f.market)) q.markets = f.market;
        if (isValidId(f.category)) q.categories = f.category;
        return { ...q, ...dateRange('createdAt', f.from, f.to) };
      },
      search: (text) => REGEX_FIELDS(['stallName', 'contactPerson', 'email', 'phone', 'city'], text),
      sortable: { stallName: 'stallName', contactPerson: 'contactPerson', city: 'city', createdAt: 'createdAt', ratingAvg: 'ratingAvg' },
      query: (q) => q.populate('user', 'name email phone status createdAt lastLoginAt avatar').populate('markets', 'name').populate('categories', 'name'),
      rows: async (docs) => {
        const ids = docs.map((d) => d._id);
        const [products, orders, completed] = await Promise.all([
          countBy(Product, 'farmer', ids, { isRemoved: false }),
          Order.find({ farmer: { $in: ids } }).select('farmer').lean(),
          Order.find({ farmer: { $in: ids }, status: ORDER_STATUS.COMPLETED }).select('farmer totalAmount').lean(),
        ]);
        return docs.map((d) => ({
          ...d,
          productCount: products.get(String(d._id)) || 0,
          orderCount: orders.filter((o) => String(o.farmer) === String(d._id)).length,
          revenue: round2(completed.filter((o) => String(o.farmer) === String(d._id)).reduce((s, o) => s + o.totalAmount, 0)),
        }));
      },
    }),

  // Customers with their order totals
  customers: (req) =>
    dataTableQuery({
      req,
      Model: User,
      base: { role: ROLES.CUSTOMER },
      filter: (f) => {
        const q = {};
        if ([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE].includes(f.status)) q.status = f.status;
        if (f.city) q.city = String(f.city);
        if (f.household === 'yes') q.household = { $exists: true, $ne: null };
        return { ...q, ...dateRange('createdAt', f.from, f.to) };
      },
      search: (text) => REGEX_FIELDS(['name', 'email', 'phone', 'city', 'address'], text),
      sortable: { name: 'name', email: 'email', city: 'city', createdAt: 'createdAt', lastLoginAt: 'lastLoginAt', status: 'status' },
      query: (q) => q.select('name email phone address city status avatar household createdAt lastLoginAt'),
      rows: async (docs) => {
        const orders = await Order.find({ customer: { $in: docs.map((d) => d._id) } }).select('customer status totalAmount createdAt').lean();
        return docs.map((d) => {
          const mine = orders.filter((o) => String(o.customer) === String(d._id));
          const done = mine.filter((o) => o.status === ORDER_STATUS.COMPLETED);
          return {
            ...d,
            orderCount: mine.length,
            completed: done.length,
            spent: round2(done.reduce((s, o) => s + o.totalAmount, 0)),
            lastOrderAt: mine.reduce((m, o) => (!m || o.createdAt > m ? o.createdAt : m), null),
          };
        });
      },
    }),

  // Every pre-order on the platform
  orders: (req) =>
    dataTableQuery({
      req,
      Model: Order,
      filter: async (f) => {
        const q = {};
        const statuses = String(f.status || '')
          .split(',')
          .filter((s) => Object.values(ORDER_STATUS).includes(s));
        if (f.status === 'open') q.status = { $in: OPEN_STATUSES };
        else if (statuses.length) q.status = { $in: statuses };
        if (isValidId(f.market)) q.market = f.market;
        if (isValidId(f.farmer)) q.farmer = f.farmer;
        if (isValidId(f.customer)) q.customer = f.customer;
        if (['customer', 'admin'].includes(f.placedBy)) q.placedBy = f.placedBy === 'customer' ? { $ne: 'admin' } : 'admin';
        if (f.city) {
          const markets = await Market.find({ city: String(f.city) }).select('_id').lean();
          q.market = isValidId(f.market) ? f.market : { $in: markets.map((m) => m._id) };
        }
        const pickup = {};
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.pickupFrom || '')) pickup.$gte = f.pickupFrom;
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.pickupTo || '')) pickup.$lte = f.pickupTo;
        if (Object.keys(pickup).length) q.pickupDate = pickup;
        const min = toNumber(f.minTotal);
        const max = toNumber(f.maxTotal);
        if (min !== undefined || max !== undefined) q.totalAmount = { ...(min !== undefined ? { $gte: min } : {}), ...(max !== undefined ? { $lte: max } : {}) };
        return { ...q, ...dateRange('createdAt', f.from, f.to) };
      },
      search: async (text) => {
        const [customers, farmers] = await Promise.all([userIdsMatching(text, ROLES.CUSTOMER), Farmer.find(REGEX_FIELDS(['stallName'], text)).select('_id').lean()]);
        return { $or: [{ orderNumber: searchRegex(text) }, { customer: { $in: customers } }, { farmer: { $in: farmers.map((f) => f._id) } }] };
      },
      sortable: { orderNumber: 'orderNumber', createdAt: 'createdAt', pickupDate: 'pickupDate', totalAmount: 'totalAmount', status: 'status' },
      query: (q) => q.populate('customer', 'name email avatar').populate('farmer', 'stallName slug').populate('market', 'name city'),
    }),

  // Product listings, including removed ones
  products: (req) =>
    dataTableQuery({
      req,
      Model: Product,
      base: { deletedByFarmer: { $ne: true } },
      filter: async (f) => {
        const q = {};
        if (isValidId(f.category)) q.category = f.category;
        if (isValidId(f.farmer)) q.farmer = f.farmer;
        if (f.status === 'removed') q.isRemoved = true;
        else if (['available', 'sold_out', 'unavailable'].includes(f.status)) Object.assign(q, { status: f.status, isRemoved: false });
        const min = toNumber(f.minPrice);
        const max = toNumber(f.maxPrice);
        if (min !== undefined || max !== undefined) q.price = { ...(min !== undefined ? { $gte: min } : {}), ...(max !== undefined ? { $lte: max } : {}) };
        if (f.stock === 'low') q.quantityAvailable = { $lte: 5 };
        if (f.city) {
          const farmers = await Farmer.find({ city: String(f.city) }).select('_id').lean();
          q.farmer = isValidId(f.farmer) ? f.farmer : { $in: farmers.map((x) => x._id) };
        }
        return q;
      },
      search: async (text) => {
        const farmers = await Farmer.find(REGEX_FIELDS(['stallName'], text)).select('_id').lean();
        return { $or: [{ name: searchRegex(text) }, { farmer: { $in: farmers.map((x) => x._id) } }] };
      },
      sortable: { name: 'name', price: 'price', quantityAvailable: 'quantityAvailable', totalSold: 'totalSold', ratingAvg: 'ratingAvg', createdAt: 'createdAt' },
      query: (q) => q.populate('farmer', 'stallName slug city').populate('category', 'name color'),
    }),

  // Reviews of products and farmers
  reviews: (req) =>
    dataTableQuery({
      req,
      Model: Review,
      filter: (f) => {
        const q = {};
        if (['product', 'farmer'].includes(f.type)) q.type = f.type;
        const rating = toNumber(f.rating);
        if (rating >= 1 && rating <= 5) q.rating = rating;
        if (f.removed === 'yes') q.isRemoved = true;
        if (f.removed === 'no') q.isRemoved = false;
        if (f.verified === 'yes') q.verified = true;
        if (f.verified === 'no') q.verified = { $ne: true };
        if (isValidId(f.farmer)) q.farmer = f.farmer;
        return { ...q, ...dateRange('createdAt', f.from, f.to) };
      },
      search: async (text) => ({ $or: [{ comment: searchRegex(text) }, { customer: { $in: await userIdsMatching(text, ROLES.CUSTOMER) } }] }),
      sortable: { rating: 'rating', createdAt: 'createdAt', type: 'type', verified: 'verified' },
      query: (q) => q.populate('customer', 'name avatar').populate('product', 'name slug').populate('farmer', 'stallName slug'),
    }),

  // Content moderation queue: reports from users and automatic flags
  flags: (req) =>
    dataTableQuery({
      req,
      Model: ContentFlag,
      filter: (f) => ({
        ...(['open', 'resolved', 'dismissed'].includes(f.status) ? { status: f.status } : {}),
        ...(['review', 'product', 'farmer'].includes(f.targetType) ? { targetType: f.targetType } : {}),
        ...(f.reason ? { reason: String(f.reason) } : {}),
        ...dateRange('createdAt', f.from, f.to),
      }),
      search: async (text) => ({ $or: [{ note: searchRegex(text) }, { reporter: { $in: await userIdsMatching(text) } }] }),
      sortable: { createdAt: 'createdAt', status: 'status', reason: 'reason', targetType: 'targetType' },
      query: (q) =>
        q
          .populate({ path: 'review', select: 'comment rating isRemoved removedReason customer', populate: { path: 'customer', select: 'name' } })
          .populate('product', 'name slug image isRemoved')
          .populate('farmer', 'stallName slug isActive')
          .populate('reporter', 'name email role')
          .populate('resolvedBy', 'name'),
    }),

  // Newsletter subscribers
  subscribers: (req) =>
    dataTableQuery({
      req,
      Model: Subscriber,
      filter: (f) => ({ ...(['subscribed', 'unsubscribed'].includes(f.status) ? { status: f.status } : {}), ...(f.source ? { source: String(f.source) } : {}), ...dateRange('createdAt', f.from, f.to) }),
      search: (text) => REGEX_FIELDS(['email', 'name'], text),
      sortable: { email: 'email', name: 'name', createdAt: 'createdAt', status: 'status', source: 'source' },
      query: (q) => q.select('-token'),
    }),

  // Contact form messages
  messages: (req) =>
    dataTableQuery({
      req,
      Model: ContactMessage,
      filter: (f) => ({ ...(['new', 'read'].includes(f.status) ? { status: f.status } : {}), ...(f.topic ? { topic: String(f.topic) } : {}), ...dateRange('createdAt', f.from, f.to) }),
      search: (text) => REGEX_FIELDS(['name', 'email', 'subject', 'message'], text),
      sortable: { name: 'name', createdAt: 'createdAt', status: 'status', subject: 'subject' },
    }),
};

// POST /api/admin/tables/:name  (DataTables server-side processing)
export async function dataTable(req, res) {
  const handler = TABLES[req.params.name];
  if (!handler) throw new AppError('Unknown table', 404);
  res.json(await handler(req));
}

// GET /api/admin/filter-options  (lists for the filter dropdowns)
export async function filterOptions(req, res) {
  const [cities, markets, farmers, categories] = await Promise.all([
    City.find().sort({ sortOrder: 1, name: 1 }).select('name isActive').lean(),
    Market.find().sort({ name: 1 }).select('name city').lean(),
    Farmer.find().sort({ stallName: 1 }).select('stallName city').lean(),
    Category.find().sort({ sortOrder: 1, name: 1 }).select('name').lean(),
  ]);
  res.json({ cities, markets, farmers, categories });
}

// ================================================================ AI product descriptions

// POST /api/farmer/products/describe and /api/admin/products/describe  { name, category, unit, variant, farmerId? }
export async function writeDescription(req, res) {
  const name = String(req.body.name || '').trim().slice(0, 100);
  if (name.length < 2) throw new AppError('Type the product name first', 400);
  let farmer = req.farmer;
  if (!farmer && isValidId(req.body.farmerId)) farmer = await Farmer.findById(req.body.farmerId).lean();
  const category = isValidId(req.body.category) ? (await Category.findById(req.body.category).select('name').lean())?.name : String(req.body.category || '');
  const result = await describeProduct({
    name,
    category: category || '',
    unit: String(req.body.unit || '').slice(0, 20),
    stallName: farmer?.stallName || 'our farm',
    practices: farmer?.tags || [],
    variant: Number(req.body.variant) || 0,
  });
  res.json(result);
}

// POST /api/admin/farmers/describe and /api/farmer/describe  { stallName, city, categories, tags, markets, variant }
export async function writeFarmBio(req, res) {
  const stallName = String(req.body.stallName || req.farmer?.stallName || '').trim().slice(0, 100);
  if (stallName.length < 2) throw new AppError('Type the stall / farm name first', 400);
  const ids = (Array.isArray(req.body.categories) ? req.body.categories : String(req.body.categories || '').split(',')).filter(isValidId);
  const marketIds = (Array.isArray(req.body.markets) ? req.body.markets : String(req.body.markets || '').split(',')).filter(isValidId);
  const [cats, markets] = await Promise.all([Category.find({ _id: { $in: ids } }).select('name').lean(), Market.find({ _id: { $in: marketIds } }).select('name').lean()]);
  const tags = Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  res.json(
    await describeFarm({
      stallName,
      contactPerson: String(req.body.contactPerson || '').trim().slice(0, 60),
      city: String(req.body.city || '').trim().slice(0, 60),
      categories: cats.map((c) => c.name),
      markets: markets.map((m) => m.name),
      practices: tags.slice(0, 6),
      variant: Number(req.body.variant) || 0,
    })
  );
}

// POST /api/ai/write  { kind, context, lang, variant }  ("Generate with AI" in text boxes)
export async function writeWithAi(req, res) {
  const kind = String(req.body.kind || '');
  const spec = WRITE_KINDS[kind];
  if (!spec) throw new AppError('Unknown kind of text', 400);
  if (!spec.roles.includes(req.user.role)) throw new AppError('You cannot write this kind of text', 403);
  const context = req.body.context && typeof req.body.context === 'object' && !Array.isArray(req.body.context) ? req.body.context : {};
  res.json(await writeText(kind, context, { lang: req.body.lang === 'ur' ? 'ur' : 'en', variant: Number(req.body.variant) || 0 }));
}


// GET /api/admin/farmer-rankings?by=revenue|rating|orders|products|customers&days=30&limit=10
// Leaderboard of active stalls for the chips on the admin Farmers page (days=0: all time)
export async function farmerRankings(req, res) {
  const by = ['revenue', 'rating', 'orders', 'products', 'customers'].includes(req.query.by) ? req.query.by : 'revenue';
  const days = Math.max(0, Math.min(365, toNumber(req.query.days) ?? 30));
  const limit = Math.max(3, Math.min(50, toNumber(req.query.limit) ?? 10));
  const farmers = await Farmer.find({ isActive: true }).select('stallName slug logo city ratingAvg ratingCount').lean();
  const ids = farmers.map((f) => f._id);
  const since = days ? new Date(Date.now() - days * 24 * 3600 * 1000) : null;
  const [orders, products] = await Promise.all([
    Order.find({ farmer: { $in: ids }, status: ORDER_STATUS.COMPLETED, ...(since ? { completedAt: { $gte: since } } : {}) }).select('farmer customer totalAmount').lean(),
    countBy(Product, 'farmer', ids, { isRemoved: false }),
  ]);
  const stats = new Map(farmers.map((f) => [String(f._id), { revenue: 0, orders: 0, customers: new Set() }]));
  for (const o of orders) {
    const s = stats.get(String(o.farmer));
    if (!s) continue;
    s.revenue += o.totalAmount;
    s.orders += 1;
    s.customers.add(String(o.customer));
  }
  const rows = farmers.map((f) => {
    const s = stats.get(String(f._id));
    return { _id: f._id, stallName: f.stallName, slug: f.slug, logo: f.logo, city: f.city, ratingAvg: f.ratingAvg, ratingCount: f.ratingCount, revenue: round2(s.revenue), orders: s.orders, customers: s.customers.size, products: products.get(String(f._id)) || 0 };
  });
  const key = { revenue: (r) => r.revenue, rating: (r) => (r.ratingCount ? r.ratingAvg * 1000 + r.ratingCount : -1), orders: (r) => r.orders, products: (r) => r.products, customers: (r) => r.customers }[by];
  rows.sort((a, b) => key(b) - key(a));
  res.json({ by, days, farmers: rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 })) });
}
