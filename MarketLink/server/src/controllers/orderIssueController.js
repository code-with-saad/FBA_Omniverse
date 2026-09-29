import { Farmer, Order, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { ORDER_STATUS, ROLES } from '../utils/constants.js';
import { assertId, getPagination } from '../utils/helpers.js';
import { validatePickup } from '../services/slots.js';
import { pickupDetails, pushStatus } from '../services/orders.js';
import { notify } from '../services/notify.js';

// A pre-order the customer says they did not receive ("issue" on the order) can be sorted out three ways:
//  - a new pickup (farmer, customer or admin chooses a date and time; the order is ready again),
//  - the farmer says the customer collected it (an admin then decides),
//  - the customer says they received it after all, or an admin closes it with an outcome.

const ACTIVE = ['open', 'new_pickup', 'disputed'];
const ISSUE_POPULATE = [
  { path: 'customer', select: 'name email phone' },
  { path: 'farmer', select: 'stallName slug phone user logo pickupWindows slotMinutes slotCapacity orderCutoffHours blockedDates' },
  { path: 'market', select: 'name slug address latitude longitude' },
];

/** The order with its problem, if this user may act on it: the customer who owns it, its farmer, or an admin. */
async function loadIssueOrder(req) {
  const order = await Order.findById(assertId(req.params.id, 'order')).populate(ISSUE_POPULATE);
  if (!order) throw new AppError('Order not found', 404);
  let role = null;
  if (req.user.role === ROLES.ADMIN) role = 'admin';
  else if (req.user.role === ROLES.CUSTOMER && String(order.customer._id) === String(req.user._id)) role = 'customer';
  else if (req.user.role === ROLES.FARMER) {
    const farmer = await Farmer.findOne({ user: req.user._id }).select('_id').lean();
    if (farmer && String(order.farmer._id) === String(farmer._id)) role = 'farmer';
  }
  if (!role) throw new AppError('Order not found', 404);
  if (!order.issue?.status) throw new AppError('Nobody reported a problem with this order', 400);
  return { order, role };
}

async function tellAdmins(alert) {
  const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
  for (const a of admins) await notify(a._id, { ...alert, link: '/admin/pickup-problems' });
}

const readNote = (body) => String(body.note || '').trim().slice(0, 500) || undefined;

// POST /api/orders/:id/issue/new-pickup  { date, slotStart, marketId, note }
// Farmer, customer or admin: the order is ready again for a new pickup date and time.
export async function arrangeNewPickup(req, res) {
  const { order, role } = await loadIssueOrder(req);
  if (!['open', 'disputed'].includes(order.issue.status)) throw new AppError('A new pickup can be arranged while the problem is open', 400);
  const farmer = await Farmer.findById(order.farmer._id);
  const pickup = await validatePickup(farmer, { date: req.body.date, slotStart: req.body.slotStart, marketId: req.body.marketId, excludeOrderId: order._id, ignoreCutoff: true });
  order.market = pickup.market;
  order.pickupDate = pickup.pickupDate;
  order.pickupSlot = pickup.pickupSlot;
  order.pickupAt = pickup.pickupAt;
  order.cutoffAt = pickup.pickupAt;
  order.completedAt = undefined;
  order.receipt = undefined; // the customer is asked again after the new pickup
  const note = readNote(req.body);
  pushStatus(order, ORDER_STATUS.READY, role, 'New pickup after "not received"');
  order.issue.status = 'new_pickup';
  order.issue.history.push({ at: new Date(), by: role, action: 'new_pickup', note: `${pickup.pickupDate} ${pickup.pickupSlot.start}${note ? ` · ${note}` : ''}` });
  await order.save();
  await order.populate({ path: 'market', select: 'name slug address latitude longitude' });

  const when = pickupDetails(order, order.market);
  const alert = { type: 'order', title: `New pickup for ${order.orderNumber}`, message: `A new pickup was arranged for pre-order ${order.orderNumber}.\n${when}${note ? `\nNote: ${note}` : ''}`, link: '' };
  if (role !== 'customer') await notify(order.customer._id, { ...alert, link: `/account/orders/${order._id}` }, { email: true });
  if (role !== 'farmer' && order.farmer.user) await notify(order.farmer.user, { ...alert, link: `/farmer/orders/${order._id}` }, { email: true });
  if (role !== 'admin') await tellAdmins(alert);
  res.json({ order, message: 'New pickup arranged. Everyone has been told.' });
}

// POST /api/orders/:id/issue/collected  { note }   (farmer: "the customer did collect it")
export async function farmerSaysCollected(req, res) {
  const { order, role } = await loadIssueOrder(req);
  if (role !== 'farmer') throw new AppError('Only the farmer of this order can say this', 403);
  if (order.issue.status !== 'open') throw new AppError('You can answer while the problem is open', 400);
  const note = readNote(req.body);
  if (!note) throw new AppError('Please tell us what happened, for example who collected it and when', 400);
  order.issue.status = 'disputed';
  order.issue.history.push({ at: new Date(), by: 'farmer', action: 'collected', note });
  await order.save();
  const message = `${order.farmer.stallName} says pre-order ${order.orderNumber} was collected. Note: ${note}`;
  await notify(order.customer._id, { type: 'order', title: `${order.farmer.stallName} says ${order.orderNumber} was collected`, message: `${message}\nThe MarketLink team will look into it and contact you.`, link: `/account/orders/${order._id}` }, { email: true });
  await tellAdmins({ type: 'order', title: `Please check ${order.orderNumber}`, message });
  res.json({ order, message: 'Thank you. The MarketLink team will check it and decide.' });
}

// POST /api/orders/:id/issue/received  { note }   (customer: "I got it after all")
export async function customerGotIt(req, res) {
  const { order, role } = await loadIssueOrder(req);
  if (role !== 'customer') throw new AppError('Only the customer can say this', 403);
  if (!ACTIVE.includes(order.issue.status)) throw new AppError('This problem is already closed', 400);
  Object.assign(order.issue, { status: 'resolved', resolution: 'received', resolvedAt: new Date(), resolvedBy: 'customer' });
  order.issue.history.push({ at: new Date(), by: 'customer', action: 'received', note: readNote(req.body) });
  order.receipt = { status: 'received', at: new Date() };
  if (order.status !== ORDER_STATUS.COMPLETED) {
    pushStatus(order, ORDER_STATUS.COMPLETED, 'customer', 'Received after all');
    order.completedAt = new Date();
  }
  await order.save();
  if (order.farmer.user) await notify(order.farmer.user, { type: 'order', title: `${order.orderNumber} was received`, message: `${order.customer.name} says they received pre-order ${order.orderNumber} after all. The problem is closed.`, link: `/farmer/orders/${order._id}` });
  await tellAdmins({ type: 'order', title: `${order.orderNumber} is sorted out`, message: `${order.customer.name} received pre-order ${order.orderNumber} after all.` });
  res.json({ order, message: 'Glad you got it! The problem is closed.' });
}

// POST /api/orders/:id/issue/resolve  { outcome: received | cancelled | farmer_right, note }   (admin)
export async function resolveIssue(req, res) {
  const { order, role } = await loadIssueOrder(req);
  if (role !== 'admin') throw new AppError('Only an administrator can close a problem', 403);
  if (!ACTIVE.includes(order.issue.status)) throw new AppError('This problem is already closed', 400);
  const outcome = String(req.body.outcome || '');
  const labels = { received: 'The customer received the order', cancelled: 'The order was cancelled', farmer_right: 'The order was collected (the farmer is right)' };
  if (!labels[outcome]) throw new AppError('Choose how the problem ended', 400);
  const note = readNote(req.body);
  Object.assign(order.issue, { status: 'resolved', resolution: outcome, resolvedAt: new Date(), resolvedBy: 'admin' });
  order.issue.history.push({ at: new Date(), by: 'admin', action: 'resolved', note: `${labels[outcome]}${note ? ` · ${note}` : ''}` });
  if (outcome === 'cancelled' && order.status !== ORDER_STATUS.CANCELLED) pushStatus(order, ORDER_STATUS.CANCELLED, 'admin', note || 'Not received');
  await order.save();
  const message = `The MarketLink team closed the problem with pre-order ${order.orderNumber}: ${labels[outcome]}.${note ? ` Note: ${note}` : ''}`;
  await notify(order.customer._id, { type: 'order', title: `Problem with ${order.orderNumber} closed`, message, link: `/account/orders/${order._id}` }, { email: true });
  if (order.farmer.user) await notify(order.farmer.user, { type: 'order', title: `Problem with ${order.orderNumber} closed`, message, link: `/farmer/orders/${order._id}` }, { email: true });
  res.json({ order, message: 'Problem closed. The customer and the farmer have been told.' });
}

// GET /api/admin/order-issues?status=active|open|new_pickup|disputed|resolved|all&search=
export async function listIssues(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const status = String(req.query.status || 'active');
  const filter = { 'issue.status': status === 'all' ? { $exists: true } : status === 'active' ? { $in: ACTIVE } : status };
  if (req.query.search) filter.orderNumber = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [orders, total, counts] = await Promise.all([
    Order.find(filter)
      .select('orderNumber customer farmer market items totalAmount pickupDate pickupSlot status issue receipt completedAt')
      .populate([
        { path: 'customer', select: 'name email phone' },
        { path: 'farmer', select: 'stallName slug phone' },
        { path: 'market', select: 'name' },
      ])
      .sort({ 'issue.openedAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $match: { 'issue.status': { $exists: true } } }, { $group: { _id: '$issue.status', n: { $sum: 1 } } }]),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json({ orders, total, page, pages: Math.ceil(total / limit), counts: { ...byStatus, active: ACTIVE.reduce((n, s) => n + (byStatus[s] || 0), 0) } });
}
