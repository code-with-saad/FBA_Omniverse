import { Category, City, ContactMessage, ContentFlag, Farmer, Market, Order, Product, RestockRequest, Review, Subscriber, User } from '../models/index.js';
import { buildAttendance } from './attendance.js';
import { ORDER_STATUS, ROLES, USER_STATUS } from '../utils/constants.js';
import { round2 } from '../utils/helpers.js';
import { addDays, startOfDay, toDateKey } from '../utils/dates.js';

export const REPORT_TITLES = {
  platform_overview: 'Platform overview',
  orders_summary: 'Orders summary',
  revenue_by_market: 'Revenue by market',
  top_farmers: 'Most active farmers',
  sales_by_category: 'Sales by category',
  customer_activity: 'Customer activity',
  inventory_status: 'Inventory and low stock',
  city_overview: 'Cities overview',
  reviews_moderation: 'Reviews and moderation',
  product_performance: 'Best-selling products',
  pickup_times: 'Busiest pickup days and times',
  cancellations: 'Cancelled and declined orders',
  pickup_problems: 'Pickup problems (not received)',
  market_attendance: 'Farmer market attendance',
  offers: 'Offers and discounts',
  farmer_signups: 'Farmer sign-ups and approvals',
  demand: 'Customer demand (remind me requests)',
  engagement: 'Newsletter, messages and sign-ups',
};

const sum = (list, fn) => round2(list.reduce((s, x) => s + fn(x), 0));

function ordersInRange(from, to) {
  return Order.find({ createdAt: { $gte: from, $lte: to } })
    .select('status totalAmount market farmer createdAt completedAt items')
    .lean();
}

function dailySeries(orders, from, to) {
  const series = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) series.push({ date: toDateKey(d), orders: 0, revenue: 0 });
  const index = new Map(series.map((p, i) => [p.date, i]));
  for (const o of orders) {
    const i = index.get(toDateKey(new Date(o.createdAt)));
    if (i === undefined) continue;
    series[i].orders += 1;
    if (o.status === ORDER_STATUS.COMPLETED) series[i].revenue = round2(series[i].revenue + o.totalAmount);
  }
  return series;
}

async function ordersSummary(from, to) {
  const orders = await ordersInRange(from, to);
  const completed = orders.filter((o) => o.status === ORDER_STATUS.COMPLETED);
  const byStatus = Object.fromEntries(Object.values(ORDER_STATUS).map((s) => [s, orders.filter((o) => o.status === s).length]));
  return {
    totals: {
      orders: orders.length,
      completed: completed.length,
      revenue: sum(completed, (o) => o.totalAmount),
      averageOrder: completed.length ? round2(sum(completed, (o) => o.totalAmount) / completed.length) : 0,
      cancelled: byStatus.cancelled,
      declined: byStatus.declined,
    },
    byStatus,
    series: dailySeries(orders, from, to),
  };
}

async function revenueByMarket(from, to) {
  const orders = await ordersInRange(from, to);
  const markets = await Market.find().select('name city').lean();
  const rows = new Map(markets.map((m) => [String(m._id), { marketId: String(m._id), market: m.name, city: m.city, orders: 0, completed: 0, revenue: 0 }]));
  for (const o of orders) {
    const row = rows.get(String(o.market));
    if (!row) continue;
    row.orders += 1;
    if (o.status === ORDER_STATUS.COMPLETED) {
      row.completed += 1;
      row.revenue = round2(row.revenue + o.totalAmount);
    }
  }
  const list = [...rows.values()].sort((a, b) => b.revenue - a.revenue);
  const total = sum(list, (r) => r.revenue);
  return {
    totals: { revenue: total, orders: sum(list, (r) => r.orders), markets: list.length },
    rows: list.map((r) => ({ ...r, share: total ? round2((r.revenue / total) * 100) : 0 })),
  };
}

async function topFarmers(from, to) {
  const orders = await ordersInRange(from, to);
  const farmers = await Farmer.find().select('stallName slug ratingAvg ratingCount isActive').lean();
  const productCounts = await Promise.all(farmers.map((f) => Product.countDocuments({ farmer: f._id, isRemoved: false })));
  const rows = new Map(
    farmers.map((f, i) => [
      String(f._id),
      { farmerId: String(f._id), farmer: f.stallName, slug: f.slug, rating: f.ratingAvg, reviews: f.ratingCount, products: productCounts[i], orders: 0, completed: 0, itemsSold: 0, revenue: 0 },
    ])
  );
  for (const o of orders) {
    const row = rows.get(String(o.farmer));
    if (!row) continue;
    row.orders += 1;
    if (o.status === ORDER_STATUS.COMPLETED) {
      row.completed += 1;
      row.revenue = round2(row.revenue + o.totalAmount);
      row.itemsSold += o.items.reduce((s, i) => s + i.quantity, 0);
    }
  }
  const list = [...rows.values()].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  return { totals: { farmers: list.length, activeSellers: list.filter((r) => r.orders > 0).length }, rows: list };
}

async function platformOverview(from, to) {
  const [customers, farmersActive, farmersPending, markets, products, newCustomers, newFarmers, summary] = await Promise.all([
    User.countDocuments({ role: ROLES.CUSTOMER }),
    User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.ACTIVE }),
    User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.PENDING }),
    Market.countDocuments({ isActive: true }),
    Product.countDocuments({ isRemoved: false }),
    User.countDocuments({ role: ROLES.CUSTOMER, createdAt: { $gte: from, $lte: to } }),
    User.countDocuments({ role: ROLES.FARMER, createdAt: { $gte: from, $lte: to } }),
    ordersSummary(from, to),
  ]);
  return {
    totals: { customers, farmersActive, farmersPending, markets, products, newCustomers, newFarmers, ...summary.totals },
    byStatus: summary.byStatus,
    series: summary.series,
  };
}


// ---- platform-wide reports with a generic table (columns + rows) and an optional chart

async function salesByCategory(from, to) {
  const orders = (await ordersInRange(from, to)).filter((o) => o.status === ORDER_STATUS.COMPLETED);
  const products = await Product.find().select('category').lean();
  const categories = await Category.find().select('name').lean();
  const catOf = new Map(products.map((p) => [String(p._id), String(p.category)]));
  const rows = new Map(categories.map((c) => [String(c._id), { category: c.name, orders: new Set(), items: 0, revenue: 0 }]));
  for (const o of orders) {
    for (const i of o.items) {
      const row = rows.get(catOf.get(String(i.product)));
      if (!row) continue;
      row.orders.add(String(o._id));
      row.items += i.quantity;
      row.revenue = round2(row.revenue + i.subtotal);
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, orders: r.orders.size })).sort((a, b) => b.revenue - a.revenue);
  const total = sum(list, (r) => r.revenue);
  return {
    totals: { revenue: total, items: list.reduce((s, r) => s + r.items, 0), categories: list.length },
    columns: [{ key: 'category', label: 'Category' }, { key: 'orders', label: 'Orders', num: true }, { key: 'items', label: 'Items sold', num: true }, { key: 'revenue', label: 'Revenue', money: true }, { key: 'share', label: 'Share %', num: true }],
    rows: list.map((r) => ({ ...r, share: total ? round2((r.revenue / total) * 100) : 0 })),
    chart: { label: 'category', value: 'revenue', name: 'Revenue', money: true },
  };
}

async function customerActivity(from, to) {
  const [customers, orders] = await Promise.all([User.find({ role: ROLES.CUSTOMER }).select('name email city status createdAt').lean(), ordersInRange(from, to)]);
  const rows = new Map(customers.map((c) => [String(c._id), { customer: c.name, email: c.email, city: c.city || '', status: c.status, joined: toDateKey(new Date(c.createdAt)), orders: 0, completed: 0, cancelled: 0, spent: 0, farmers: new Set() }]));
  for (const o of await Order.find({ createdAt: { $gte: from, $lte: to } }).select('customer status totalAmount farmer').lean()) {
    const row = rows.get(String(o.customer));
    if (!row) continue;
    row.orders += 1;
    row.farmers.add(String(o.farmer));
    if (o.status === ORDER_STATUS.COMPLETED) {
      row.completed += 1;
      row.spent = round2(row.spent + o.totalAmount);
    }
    if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.DECLINED].includes(o.status)) row.cancelled += 1;
  }
  const list = [...rows.values()].map((r) => ({ ...r, farmers: r.farmers.size })).sort((a, b) => b.spent - a.spent);
  return {
    totals: {
      customers: list.length,
      active: list.filter((r) => r.orders > 0).length,
      newCustomers: customers.filter((c) => c.createdAt >= from && c.createdAt <= to).length,
      repeat: list.filter((r) => r.completed > 1).length,
      orders: orders.length,
    },
    columns: [{ key: 'customer', label: 'Customer' }, { key: 'city', label: 'City' }, { key: 'orders', label: 'Orders', num: true }, { key: 'completed', label: 'Completed', num: true }, { key: 'cancelled', label: 'Cancelled', num: true }, { key: 'farmers', label: 'Farmers', num: true }, { key: 'spent', label: 'Spent', money: true }, { key: 'joined', label: 'Joined' }],
    rows: list,
    chart: { label: 'customer', value: 'spent', name: 'Spent', money: true, top: 10 },
  };
}

async function inventoryStatus() {
  const products = await Product.find({ isRemoved: false }).populate('farmer', 'stallName').select('name unit price quantityAvailable lowStockThreshold status farmer totalSold').lean();
  const rows = products
    .map((p) => {
      const t = p.lowStockThreshold ?? 5;
      const state = p.status === 'unavailable' ? 'Unavailable' : p.quantityAvailable <= 0 ? 'Sold out' : p.quantityAvailable <= t ? 'Low stock' : 'In stock';
      return { product: p.name, farmer: p.farmer?.stallName || '', stock: p.quantityAvailable, unit: p.unit, alertLevel: t, state, sold: p.totalSold, value: round2(p.price * p.quantityAvailable) };
    })
    .sort((a, b) => a.stock - b.stock);
  return {
    totals: { products: rows.length, lowStock: rows.filter((r) => r.state === 'Low stock').length, soldOut: rows.filter((r) => r.state === 'Sold out').length, units: rows.reduce((s, r) => s + r.stock, 0), stockValue: sum(rows, (r) => r.value) },
    columns: [{ key: 'product', label: 'Product' }, { key: 'farmer', label: 'Farmer' }, { key: 'stock', label: 'In stock', num: true }, { key: 'unit', label: 'Unit' }, { key: 'alertLevel', label: 'Alert level', num: true }, { key: 'state', label: 'State' }, { key: 'sold', label: 'Sold', num: true }, { key: 'value', label: 'Stock value', money: true }],
    rows,
  };
}

async function cityOverview(from, to) {
  const [cities, markets, farmers, customers, orders] = await Promise.all([
    City.find().sort({ sortOrder: 1 }).lean(),
    Market.find().select('city').lean(),
    Farmer.find({ isActive: true }).select('city').lean(),
    User.find({ role: ROLES.CUSTOMER }).select('city').lean(),
    Order.find({ createdAt: { $gte: from, $lte: to } }).populate('market', 'city').select('market status totalAmount').lean(),
  ]);
  const rows = cities.map((c) => {
    const own = orders.filter((o) => o.market?.city === c.name);
    const done = own.filter((o) => o.status === ORDER_STATUS.COMPLETED);
    return {
      city: c.name,
      province: c.province || '',
      markets: markets.filter((m) => m.city === c.name).length,
      farmers: farmers.filter((f) => f.city === c.name).length,
      customers: customers.filter((u) => u.city === c.name).length,
      orders: own.length,
      revenue: sum(done, (o) => o.totalAmount),
    };
  });
  return {
    totals: { cities: rows.length, activeCities: rows.filter((r) => r.orders > 0).length, revenue: sum(rows, (r) => r.revenue) },
    columns: [{ key: 'city', label: 'City' }, { key: 'province', label: 'Province' }, { key: 'markets', label: 'Markets', num: true }, { key: 'farmers', label: 'Farmers', num: true }, { key: 'customers', label: 'Customers', num: true }, { key: 'orders', label: 'Orders', num: true }, { key: 'revenue', label: 'Revenue', money: true }],
    rows: rows.sort((a, b) => b.revenue - a.revenue),
    chart: { label: 'city', value: 'revenue', name: 'Revenue', money: true },
  };
}

async function reviewsModeration(from, to) {
  const [reviews, flags, farmers] = await Promise.all([
    Review.find({ createdAt: { $gte: from, $lte: to } }).select('rating isRemoved farmer type').lean(),
    ContentFlag.find({ createdAt: { $gte: from, $lte: to } }).select('status reason targetType action farmer').lean(),
    Farmer.find().select('stallName ratingAvg ratingCount').lean(),
  ]);
  const rows = farmers.map((f) => {
    const own = reviews.filter((r) => String(r.farmer) === String(f._id));
    return {
      farmer: f.stallName,
      reviews: own.length,
      average: own.length ? round2(own.reduce((s, r) => s + r.rating, 0) / own.length) : 0,
      lowRatings: own.filter((r) => r.rating <= 2).length,
      removed: own.filter((r) => r.isRemoved).length,
      reports: flags.filter((x) => String(x.farmer) === String(f._id)).length,
      overall: f.ratingAvg,
    };
  });
  const byStars = [5, 4, 3, 2, 1].map((n) => ({ rating: `${n} stars`, count: reviews.filter((r) => r.rating === n).length }));
  return {
    totals: {
      reviews: reviews.length,
      averageRating: reviews.length ? round2(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0,
      removedReviews: reviews.filter((r) => r.isRemoved).length,
      reports: flags.length,
      openReports: flags.filter((x) => x.status === 'open').length,
      resolvedReports: flags.filter((x) => x.status !== 'open').length,
    },
    byStars,
    columns: [{ key: 'farmer', label: 'Farmer' }, { key: 'reviews', label: 'Reviews', num: true }, { key: 'average', label: 'Average (period)', num: true }, { key: 'lowRatings', label: '1-2 stars', num: true }, { key: 'removed', label: 'Removed', num: true }, { key: 'reports', label: 'Reports', num: true }, { key: 'overall', label: 'Overall rating', num: true }],
    rows: rows.sort((a, b) => b.reviews - a.reviews),
    chart: { label: 'rating', value: 'count', name: 'Reviews', data: 'byStars' },
  };
}


// ---- more platform reports (Round 12): products, pickup times, cancellations, pickup problems, attendance,
// offers, farmer sign-ups, customer demand and engagement

const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hourLabel = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'am' : 'pm'}`;

async function productPerformance(from, to) {
  const orders = (await ordersInRange(from, to)).filter((o) => o.status === ORDER_STATUS.COMPLETED);
  const products = await Product.find().select('name unit farmer category ratingAvg ratingCount isRemoved').populate('farmer', 'stallName').populate('category', 'name').lean();
  const rows = new Map(products.map((p) => [String(p._id), { product: p.name, farmer: p.farmer?.stallName || '', category: p.category?.name || '', unit: p.unit, orders: new Set(), units: 0, revenue: 0, rating: p.ratingCount ? p.ratingAvg : 0 }]));
  for (const o of orders) {
    for (const i of o.items) {
      const row = rows.get(String(i.product));
      if (!row) continue;
      row.orders.add(String(o._id));
      row.units += i.quantity;
      row.revenue = round2(row.revenue + i.subtotal);
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, orders: r.orders.size })).filter((r) => r.orders > 0).sort((a, b) => b.revenue - a.revenue);
  return {
    totals: { productsSold: list.length, items: list.reduce((n, r) => n + r.units, 0), revenue: sum(list, (r) => r.revenue), notSold: products.filter((p) => !p.isRemoved).length - list.length },
    columns: [{ key: 'product', label: 'Product' }, { key: 'farmer', label: 'Farmer' }, { key: 'category', label: 'Category' }, { key: 'orders', label: 'Orders', num: true }, { key: 'units', label: 'Units sold', num: true }, { key: 'unit', label: 'Unit' }, { key: 'revenue', label: 'Revenue', money: true }, { key: 'rating', label: 'Rating', num: true }],
    rows: list,
    chart: { label: 'product', value: 'revenue', name: 'Revenue', money: true, top: 10 },
  };
}

async function pickupTimes(from, to) {
  const orders = await Order.find({ pickupAt: { $gte: from, $lte: to }, status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.DECLINED] } })
    .select('pickupAt pickupSlot status totalAmount')
    .lean();
  const days = DAY_LABEL.map((day) => ({ day, orders: 0, completed: 0, revenue: 0, hours: {} }));
  const hours = {};
  for (const o of orders) {
    const d = days[new Date(o.pickupAt).getDay()];
    const h = Number(String(o.pickupSlot?.start || '').split(':')[0]) || new Date(o.pickupAt).getHours();
    d.orders += 1;
    d.hours[h] = (d.hours[h] || 0) + 1;
    hours[h] = (hours[h] || 0) + 1;
    if (o.status === ORDER_STATUS.COMPLETED) {
      d.completed += 1;
      d.revenue = round2(d.revenue + o.totalAmount);
    }
  }
  const busiest = (map) => {
    const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return top ? `${hourLabel(Number(top[0]))} (${top[1]})` : '-';
  };
  const rows = [1, 2, 3, 4, 5, 6, 0].map((i) => days[i]).map((d) => ({ day: d.day, orders: d.orders, completed: d.completed, revenue: d.revenue, share: orders.length ? round2((d.orders / orders.length) * 100) : 0, busiestHour: busiest(d.hours) }));
  const byHour = Object.entries(hours)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([h, n]) => ({ hour: hourLabel(Number(h)), orders: n }));
  const top = [...rows].sort((a, b) => b.orders - a.orders)[0];
  return {
    totals: { pickups: orders.length, busiestDay: top?.orders ? top.day : '-', busiestHour: busiest(hours).replace(/ \(\d+\)$/, '') },
    byHour,
    columns: [{ key: 'day', label: 'Day' }, { key: 'orders', label: 'Pickups', num: true }, { key: 'share', label: 'Share %', num: true }, { key: 'completed', label: 'Collected', num: true }, { key: 'revenue', label: 'Revenue', money: true }, { key: 'busiestHour', label: 'Busiest hour' }],
    rows,
    chart: { label: 'hour', value: 'orders', name: 'Pickups', data: 'byHour', title: 'Pickups by hour of the day' },
  };
}

async function cancellations(from, to) {
  const orders = await Order.find({ createdAt: { $gte: from, $lte: to } })
    .select('status farmer statusHistory totalAmount')
    .populate('farmer', 'stallName')
    .lean();
  const rows = new Map();
  const reasons = {};
  for (const o of orders) {
    const key = String(o.farmer?._id || o.farmer);
    if (!rows.has(key)) rows.set(key, { farmer: o.farmer?.stallName || '', orders: 0, declined: 0, byCustomer: 0, byAdmin: 0, lost: 0 });
    const row = rows.get(key);
    row.orders += 1;
    if (![ORDER_STATUS.CANCELLED, ORDER_STATUS.DECLINED].includes(o.status)) continue;
    const last = [...(o.statusHistory || [])].reverse().find((h) => h.status === o.status);
    if (o.status === ORDER_STATUS.DECLINED) row.declined += 1;
    else if (last?.by === 'admin') row.byAdmin += 1;
    else row.byCustomer += 1;
    row.lost = round2(row.lost + o.totalAmount);
    const why = String(last?.note || '').trim() || (o.status === ORDER_STATUS.DECLINED ? 'Declined, no reason given' : 'Cancelled, no reason given');
    reasons[why.slice(0, 60)] = (reasons[why.slice(0, 60)] || 0) + 1;
  }
  const list = [...rows.values()].map((r) => ({ ...r, rate: r.orders ? round2(((r.declined + r.byCustomer + r.byAdmin) / r.orders) * 100) : 0 })).sort((a, b) => b.declined + b.byCustomer + b.byAdmin - (a.declined + a.byCustomer + a.byAdmin));
  const cancelled = list.reduce((n, r) => n + r.byCustomer + r.byAdmin, 0);
  const declined = list.reduce((n, r) => n + r.declined, 0);
  return {
    totals: { orders: orders.length, cancelled, declined, cancelRate: orders.length ? round2(((cancelled + declined) / orders.length) * 100) : 0, lostValue: sum(list, (r) => r.lost) },
    byReason: Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    columns: [{ key: 'farmer', label: 'Farmer' }, { key: 'orders', label: 'Orders', num: true }, { key: 'declined', label: 'Declined by farmer', num: true }, { key: 'byCustomer', label: 'Cancelled by customer', num: true }, { key: 'byAdmin', label: 'Cancelled by admin', num: true }, { key: 'rate', label: 'Rate %', num: true }, { key: 'lost', label: 'Order value lost', money: true }],
    rows: list,
    chart: { label: 'reason', value: 'count', name: 'Orders', data: 'byReason', title: 'Reasons given', top: 8 },
  };
}

const ISSUE_STATUS = { open: 'Waiting for the farmer', new_pickup: 'New pickup arranged', disputed: 'Farmer says collected', resolved: 'Sorted out' };
const ISSUE_OUTCOME = { received: 'Customer received it', collected_after_new_pickup: 'Collected at the new pickup', cancelled: 'Order cancelled', farmer_right: 'Farmer was right' };

async function pickupProblems(from, to) {
  const orders = await Order.find({ 'issue.openedAt': { $gte: from, $lte: to } })
    .select('orderNumber customer farmer market totalAmount issue pickupDate')
    .populate('customer', 'name')
    .populate('farmer', 'stallName')
    .populate('market', 'name')
    .sort({ 'issue.openedAt': -1 })
    .lean();
  const rows = orders.map((o) => ({
    order: o.orderNumber,
    customer: o.customer?.name || '',
    farmer: o.farmer?.stallName || '',
    market: o.market?.name || '',
    reported: toDateKey(new Date(o.issue.openedAt)),
    times: o.issue.timesReported || 1,
    state: ISSUE_STATUS[o.issue.status] || o.issue.status,
    outcome: ISSUE_OUTCOME[o.issue.resolution] || '-',
    value: o.totalAmount,
  }));
  const byState = Object.values(ISSUE_STATUS).map((state) => ({ state, count: rows.filter((r) => r.state === state).length }));
  return {
    totals: {
      problems: rows.length,
      openProblems: orders.filter((o) => ['open', 'disputed'].includes(o.issue.status)).length,
      newPickups: orders.filter((o) => o.issue.history?.some((h) => h.action === 'new_pickup')).length,
      solved: orders.filter((o) => o.issue.status === 'resolved').length,
      problemValue: sum(rows, (r) => r.value),
    },
    byState,
    columns: [{ key: 'order', label: 'Order' }, { key: 'customer', label: 'Customer' }, { key: 'farmer', label: 'Farmer' }, { key: 'market', label: 'Market' }, { key: 'reported', label: 'Reported' }, { key: 'times', label: 'Times reported', num: true }, { key: 'state', label: 'State' }, { key: 'outcome', label: 'Outcome' }, { key: 'value', label: 'Order value', money: true }],
    rows,
    chart: { label: 'state', value: 'count', name: 'Problems', data: 'byState', title: 'Problems by state' },
  };
}

async function marketAttendance(from, to) {
  // the attendance is about days that have come, at most 180 of them
  const toKey = toDateKey(to);
  const fromKey = toDateKey(new Date(Math.max(from.getTime(), addDays(to, -180).getTime())));
  const a = await buildAttendance({ from: fromKey, to: toKey });
  return {
    totals: { marketDays: a.summary.marketDays, attended: a.summary.attended, absent: a.summary.absent, noCheckIn: a.summary.noCheckIn, attendanceRate: a.summary.rate ?? 0, pickupsOnAbsentDays: a.summary.pickupsOnAbsentDays },
    byReason: a.byReason.map((r) => ({ reason: r.label, count: r.n })),
    columns: [{ key: 'farmer', label: 'Farmer' }, { key: 'marketDays', label: 'Market days', num: true }, { key: 'attended', label: 'Came', num: true }, { key: 'absent', label: 'Did not come', num: true }, { key: 'noCheckIn', label: 'No check-in', num: true }, { key: 'rate', label: 'Attendance %', num: true }],
    rows: a.byFarmer.map((f) => ({ farmer: f.farmer.stallName, marketDays: f.marketDays, attended: f.attended, absent: f.absent, noCheckIn: f.noCheckIn, rate: f.rate ?? 0 })),
    chart: { label: 'reason', value: 'count', name: 'Market days missed', data: 'byReason', title: 'Why farmers could not come' },
  };
}

async function offersReport() {
  const products = await Product.find({ isRemoved: false, compareAtPrice: { $gt: 0 } }).select('name unit price compareAtPrice offerEndsAt farmer totalSold').populate('farmer', 'stallName').lean();
  const rows = products
    .filter((p) => p.compareAtPrice > p.price)
    .map((p) => ({ product: p.name, farmer: p.farmer?.stallName || '', unit: p.unit, usual: p.compareAtPrice, offer: p.price, off: Math.round((1 - p.price / p.compareAtPrice) * 100), ends: p.offerEndsAt ? toDateKey(new Date(p.offerEndsAt)) : 'No end date', sold: p.totalSold || 0 }))
    .sort((a, b) => b.off - a.off);
  const byFarmer = {};
  for (const r of rows) byFarmer[r.farmer] = (byFarmer[r.farmer] || 0) + 1;
  return {
    totals: { onOffer: rows.length, averageOff: rows.length ? Math.round(rows.reduce((n, r) => n + r.off, 0) / rows.length) : 0, biggestOff: rows[0]?.off || 0, farmersWithOffers: Object.keys(byFarmer).length },
    byFarmer: Object.entries(byFarmer).map(([farmer, count]) => ({ farmer, count })),
    columns: [{ key: 'product', label: 'Product' }, { key: 'farmer', label: 'Farmer' }, { key: 'unit', label: 'Unit' }, { key: 'usual', label: 'Usual price', money: true }, { key: 'offer', label: 'Offer price', money: true }, { key: 'off', label: '% off', num: true }, { key: 'ends', label: 'Ends' }, { key: 'sold', label: 'Sold (all time)', num: true }],
    rows,
    chart: { label: 'farmer', value: 'count', name: 'Products on offer', data: 'byFarmer', title: 'Offers by farmer' },
  };
}

async function farmerSignups(from, to) {
  const farmers = await Farmer.find({ createdAt: { $gte: from, $lte: to } })
    .select('stallName city user createdAt')
    .populate('user', 'status name email')
    .sort({ createdAt: -1 })
    .lean();
  const label = { active: 'Approved', pending: 'Waiting for approval', suspended: 'Suspended', inactive: 'Inactive' };
  const rows = farmers.map((f) => ({ farmer: f.stallName, contact: f.user?.name || '', email: f.user?.email || '', city: f.city || '', applied: toDateKey(new Date(f.createdAt)), state: label[f.user?.status] || f.user?.status || '' }));
  const byState = Object.values(label).map((state) => ({ state, count: rows.filter((r) => r.state === state).length }));
  const [pendingNow, approvedNow] = await Promise.all([User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.PENDING }), User.countDocuments({ role: ROLES.FARMER, status: USER_STATUS.ACTIVE })]);
  return {
    totals: { applications: rows.length, approvedInPeriod: rows.filter((r) => r.state === 'Approved').length, waitingNow: pendingNow, farmersActive: approvedNow },
    byState,
    columns: [{ key: 'farmer', label: 'Stall' }, { key: 'contact', label: 'Contact person' }, { key: 'email', label: 'E-mail' }, { key: 'city', label: 'City' }, { key: 'applied', label: 'Applied' }, { key: 'state', label: 'State' }],
    rows,
    chart: { label: 'state', value: 'count', name: 'Farmers', data: 'byState', title: 'Sign-ups by state' },
  };
}

async function demandReport(from, to) {
  const requests = await RestockRequest.find({})
    .select('product createdAt user')
    .populate({ path: 'product', select: 'name quantityAvailable status farmer', populate: { path: 'farmer', select: 'stallName' } })
    .lean();
  const rows = new Map();
  for (const r of requests) {
    if (!r.product) continue;
    const key = String(r.product._id);
    if (!rows.has(key)) rows.set(key, { product: r.product.name, farmer: r.product.farmer?.stallName || '', waiting: 0, inPeriod: 0, guests: 0, stock: r.product.quantityAvailable, state: r.product.quantityAvailable > 0 && r.product.status !== 'unavailable' ? 'Back in stock' : 'Sold out' });
    const row = rows.get(key);
    row.waiting += 1;
    if (!r.user) row.guests += 1;
    if (r.createdAt >= from && r.createdAt <= to) row.inPeriod += 1;
  }
  const list = [...rows.values()].sort((a, b) => b.waiting - a.waiting);
  return {
    totals: { requests: requests.length, requestsInPeriod: list.reduce((n, r) => n + r.inPeriod, 0), productsWanted: list.length, soldOutWanted: list.filter((r) => r.state === 'Sold out').length },
    columns: [{ key: 'product', label: 'Product' }, { key: 'farmer', label: 'Farmer' }, { key: 'waiting', label: 'People waiting', num: true }, { key: 'inPeriod', label: 'Asked in period', num: true }, { key: 'guests', label: 'Guests (e-mail only)', num: true }, { key: 'stock', label: 'In stock now', num: true }, { key: 'state', label: 'State' }],
    rows: list,
    chart: { label: 'product', value: 'waiting', name: 'People waiting', top: 10 },
  };
}

async function engagement(from, to) {
  const [subs, messages, customers, farmers, reviews] = await Promise.all([
    Subscriber.find({}).select('status createdAt').lean(),
    ContactMessage.find({ createdAt: { $gte: from, $lte: to } }).select('status createdAt').lean(),
    User.find({ role: ROLES.CUSTOMER, createdAt: { $gte: from, $lte: to } }).select('createdAt').lean(),
    Farmer.find({ createdAt: { $gte: from, $lte: to } }).select('createdAt').lean(),
    Review.find({ createdAt: { $gte: from, $lte: to } }).select('createdAt').lean(),
  ]);
  const newSubs = subs.filter((s) => s.createdAt >= from && s.createdAt <= to);
  // one row per week of the period
  const rows = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 7)) {
    const end = addDays(d, 7);
    const inWeek = (list) => list.filter((x) => x.createdAt >= d && x.createdAt < end).length;
    rows.push({ week: `${toDateKey(d)} to ${toDateKey(addDays(d, 6) > to ? to : addDays(d, 6))}`, customers: inWeek(customers), farmers: inWeek(farmers), subscribers: inWeek(newSubs), messages: inWeek(messages), reviews: inWeek(reviews) });
  }
  return {
    totals: { newCustomers: customers.length, newFarmers: farmers.length, subscribers: subs.filter((s) => s.status === 'subscribed').length, newSubscribers: newSubs.length, messages: messages.length, unreadMessages: messages.filter((m) => m.status === 'new').length, reviews: reviews.length },
    columns: [{ key: 'week', label: 'Week' }, { key: 'customers', label: 'New customers', num: true }, { key: 'farmers', label: 'New farmers', num: true }, { key: 'subscribers', label: 'Newsletter sign-ups', num: true }, { key: 'messages', label: 'Contact messages', num: true }, { key: 'reviews', label: 'Reviews', num: true }],
    rows,
  };
}

const BUILDERS = {
  platform_overview: platformOverview,
  orders_summary: ordersSummary,
  revenue_by_market: revenueByMarket,
  top_farmers: topFarmers,
  sales_by_category: salesByCategory,
  customer_activity: customerActivity,
  inventory_status: inventoryStatus,
  city_overview: cityOverview,
  reviews_moderation: reviewsModeration,
  product_performance: productPerformance,
  pickup_times: pickupTimes,
  cancellations,
  pickup_problems: pickupProblems,
  market_attendance: marketAttendance,
  offers: offersReport,
  farmer_signups: farmerSignups,
  demand: demandReport,
  engagement,
};

// The order of the sections on the reports page ("orders_summary" is part of the overview there)
export const ALL_REPORTS = ['platform_overview', 'revenue_by_market', 'sales_by_category', 'product_performance', 'top_farmers', 'customer_activity', 'city_overview', 'pickup_times', 'cancellations', 'pickup_problems', 'market_attendance', 'inventory_status', 'offers', 'reviews_moderation', 'farmer_signups', 'demand', 'engagement'];

/** Every report for one period (the reports page). */
export async function buildAllReports(from, to) {
  const entries = await Promise.all(ALL_REPORTS.map(async (type) => [type, await BUILDERS[type](from, to)]));
  return Object.fromEntries(entries);
}

export async function buildReport(type, from, to) {
  return BUILDERS[type](from, to);
}
