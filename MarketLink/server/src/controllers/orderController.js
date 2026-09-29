import { Farmer, Market, Order, Product, User } from '../models/index.js';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import { ORDER_STATUS, OPEN_ORDER_STATUSES, PRODUCT_STATUS, ROLES } from '../utils/constants.js';
import { assertId, getPagination, round2 } from '../utils/helpers.js';
import { validatePickup } from '../services/slots.js';
import { assertNoPickupClash } from '../services/pickupClash.js';
import { releaseItems, reserveItems, retakeItems } from '../services/stock.js';
import { notify } from '../services/notify.js';
import { canCustomerModify, canViewOrder, generateOrderNumber, pickupDetails, pushStatus, reviewState } from '../services/orders.js';
import { changeMovements, checkLowStock, orderMovements, recordMovements } from '../services/inventory.js';

const ORDER_POPULATE = [
  { path: 'farmer', select: 'stallName slug logo phone email address latitude longitude orderCutoffHours user' },
  { path: 'market', select: 'name slug address latitude longitude openTime closeTime' },
  { path: 'customer', select: 'name email phone address' },
];

async function loadFarmerForOrder(farmerId) {
  assertId(farmerId, 'farmer');
  const farmer = await Farmer.findOne({ _id: farmerId, isActive: true });
  if (!farmer) throw new AppError('This farmer is not accepting orders right now', 400);
  return farmer;
}

/**
 * Creates one pre-order per farmer group for `customer`. Used by the checkout (by: 'customer')
 * and by administrators placing an order for a customer (by: 'admin').
 * groups: [{ farmerId, marketId, pickupDate, slotStart, items: [{ productId, quantity }], note }]
 */
export async function createPreOrders(customer, rawGroups, { by = 'customer' } = {}) {
  const groups = Array.isArray(rawGroups) ? rawGroups : [];
  if (!groups.length) throw new AppError('Your cart is empty', 400);
  if (groups.length > 10) throw new AppError('Too many farmers in one checkout', 400);

  // 1) Validate every farmer + pickup slot first (no side effects yet)
  const prepared = [];
  for (const group of groups) {
    const farmer = await loadFarmerForOrder(group.farmerId);
    const pickup = await validatePickup(farmer, {
      date: group.pickupDate,
      slotStart: group.slotStart,
      marketId: group.marketId,
    });
    prepared.push({ farmer, pickup, group });
  }
  // the customer cannot collect at two markets at the same time
  const marketNames = new Map((await Market.find({ _id: { $in: prepared.map((p) => p.pickup.market) } }).select('name').lean()).map((m) => [String(m._id), m.name]));
  await assertNoPickupClash(
    customer._id,
    prepared.map(({ farmer, pickup }) => ({ date: pickup.pickupDate, market: pickup.market, start: pickup.pickupSlot.start, farmerName: farmer.stallName, marketName: marketNames.get(String(pickup.market)) }))
  );

  // 2) Reserve stock and create the orders. Roll everything back if one group fails.
  const created = [];
  try {
    for (const { farmer, pickup, group } of prepared) {
      const items = await reserveItems(farmer._id, group.items);
      try {
        const order = await Order.create({
          orderNumber: await generateOrderNumber(),
          customer: customer._id,
          placedBy: by === 'admin' ? 'admin' : 'customer',
          farmer: farmer._id,
          market: pickup.market,
          items,
          totalAmount: round2(items.reduce((sum, i) => sum + i.subtotal, 0)),
          pickupDate: pickup.pickupDate,
          pickupSlot: pickup.pickupSlot,
          pickupAt: pickup.pickupAt,
          cutoffAt: pickup.cutoffAt,
          customerNote: group.note ? String(group.note).slice(0, 500) : undefined,
          status: ORDER_STATUS.PLACED,
          statusHistory: [{ status: ORDER_STATUS.PLACED, by, note: by === 'admin' ? 'Placed by an administrator' : undefined }],
        });
        created.push({ order, farmer });
      } catch (err) {
        await releaseItems(items);
        throw err;
      }
    }
  } catch (err) {
    for (const { order } of created) {
      await releaseItems(order.items);
      await Order.deleteOne({ _id: order._id });
    }
    throw err;
  }

  // 3) Inventory log + low-stock alerts for the farmers
  for (const { order } of created) await recordMovements(orderMovements(order, -1, 'order_reserved', by));
  await checkLowStock(created.flatMap(({ order }) => order.items.map((i) => i.product)));

  // 4) Notifications (in-app + e-mail order confirmation with route-friendly pickup details)
  for (const { order, farmer } of created) {
    const market = await Market.findById(order.market).select('name address latitude longitude').lean();
    await notify(
      customer,
      {
        type: 'order',
        title: `Pre-order ${order.orderNumber} placed`,
        message: `${by === 'admin' ? 'MarketLink placed this pre-order for you' : 'Your pre-order has been placed'} with ${farmer.stallName}. Total: ${env.currency} ${order.totalAmount} (pay at pickup).\n${pickupDetails(order, market)}`,
        link: `/account/orders/${order._id}`,
      },
      { email: true }
    );
    await notify(
      farmer.user,
      {
        type: 'order',
        title: `New pre-order ${order.orderNumber}`,
        message: `${customer.name} placed a pre-order${by === 'admin' ? ' (entered by an administrator)' : ''} for ${order.pickupDate} ${order.pickupSlot.start}-${order.pickupSlot.end}.`,
        link: `/farmer/orders?focus=${order._id}`,
      },
      { email: true }
    );
  }

  return created.map(({ order }) => order);
}

// POST /api/orders  (customer checkout)
export async function placeOrders(req, res) {
  res.status(201).json({ orders: await createPreOrders(req.user, req.body.groups) });
}

function statusFilter(value) {
  if (!value || value === 'all') return undefined;
  if (value === 'active') return { $in: OPEN_ORDER_STATUSES };
  if (value === 'past') return { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DECLINED, ORDER_STATUS.CANCELLED] };
  const list = String(value).split(',').filter((s) => Object.values(ORDER_STATUS).includes(s));
  return list.length ? { $in: list } : undefined;
}

// GET /api/orders/my?status=active|past|placed,...
export async function myOrders(req, res) {
  const { page, limit, skip } = getPagination(req.query, 10, 50);
  const filter = { customer: req.user._id };
  const status = statusFilter(req.query.status);
  if (status) filter.status = status;
  // ?numbers=ML-1,ML-2: the orders of one checkout (the confirmation page after a reload or from a bookmark)
  if (req.query.numbers) filter.orderNumber = { $in: String(req.query.numbers).split(',').map((n) => n.trim()).filter(Boolean).slice(0, 10) };
  const [orders, total] = await Promise.all([
    Order.find(filter).populate(ORDER_POPULATE.slice(0, 2)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  const now = new Date();
  res.json({
    orders: orders.map((o) => ({ ...o, canModify: canCustomerModify(o, now) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// GET /api/orders/to-confirm  (completed pre-orders of the last 30 days the customer has not confirmed yet)
export async function ordersToConfirm(req, res) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const orders = await Order.find({ customer: req.user._id, status: ORDER_STATUS.COMPLETED, 'receipt.status': { $exists: false }, completedAt: { $gte: since } })
    .populate('farmer', 'stallName slug logo')
    .sort({ completedAt: -1 })
    .limit(5)
    .lean();
  res.json({ orders });
}

// POST /api/orders/:id/receipt  { received: true|false, note }
// The customer confirms that they received a pre-order the farmer marked as picked up. "Not received"
// tells the farmer and the MarketLink team so they can sort it out.
export async function confirmReceipt(req, res) {
  const order = await Order.findOne({ _id: assertId(req.params.id, 'order'), customer: req.user._id }).populate('farmer', 'stallName user');
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== ORDER_STATUS.COMPLETED) throw new AppError('You can confirm an order after the farmer marks it as picked up', 400);
  if (order.receipt?.status) throw new AppError('You already answered for this order', 400);
  const received = req.body.received === true || req.body.received === 'true';
  const note = String(req.body.note || '').trim().slice(0, 500);
  order.receipt = { status: received ? 'received' : 'not_received', note: note || undefined, at: new Date() };
  const hadIssue = Boolean(order.issue?.status);
  if (received && hadIssue && order.issue.status !== 'resolved') {
    // collected at the new pickup: the problem is over
    Object.assign(order.issue, { status: 'resolved', resolution: 'collected_after_new_pickup', resolvedAt: new Date(), resolvedBy: 'customer' });
    order.issue.history.push({ by: 'customer', action: 'received', note: note || undefined });
  }
  if (!received && !hadIssue) {
    order.issue = { status: 'open', reason: 'not_received', note: note || undefined, openedAt: new Date(), timesReported: 1, history: [{ at: new Date(), by: 'customer', action: 'reported', note: note || undefined }] };
  } else if (!received) {
    // not received again after a new pickup: the problem opens again
    Object.assign(order.issue, { status: 'open', note: note || order.issue.note, timesReported: (order.issue.timesReported || 1) + 1, resolution: undefined, resolvedAt: undefined, resolvedBy: undefined });
    order.issue.history.push({ at: new Date(), by: 'customer', action: 'reported_again', note: note || undefined });
  }
  await order.save();
  if (!received) {
    const again = order.issue.timesReported > 1;
    const alert = {
      type: 'order',
      title: `Customer did not receive ${order.orderNumber}`,
      message: `${req.user.name} says they did not receive pre-order ${order.orderNumber}.${note ? ` Note: ${note}` : ''} Please get in touch with them.`,
    };
    if (order.farmer?.user) await notify(order.farmer.user, { ...alert, link: `/farmer/orders/${order._id}` }, { email: true });
    const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
    for (const a of admins) await notify(a._id, { ...alert, title: again ? `Not received again: ${order.orderNumber}` : alert.title, link: '/admin/pickup-problems' }, { email: again });
  }
  if (received && hadIssue && order.farmer?.user) {
    await notify(order.farmer.user, { type: 'order', title: `${order.orderNumber} was received`, message: `${req.user.name} confirmed that they received pre-order ${order.orderNumber}. The problem is closed.`, link: `/farmer/orders/${order._id}` });
  }
  res.json({
    order: { _id: order._id, receipt: order.receipt, issue: order.issue },
    message: received ? 'Thank you for confirming!' : 'Sorry about that. We told the farmer and the MarketLink team. You can also choose a new pickup time on the order page.',
  });
}

// GET /api/orders/:id  (customer who owns it, household member, farmer of the order, or admin)
export async function getOrder(req, res) {
  assertId(req.params.id, 'order');
  const order = await Order.findById(req.params.id).populate(ORDER_POPULATE).lean();
  if (!order) throw new AppError('Order not found', 404);

  let allowed = false;
  if (req.user.role === ROLES.FARMER) {
    const farmer = await Farmer.findOne({ user: req.user._id }).select('_id').lean();
    allowed = canViewOrder(order, req.user, farmer?._id);
  } else {
    allowed = canViewOrder(order, req.user);
    if (!allowed && req.user.role === ROLES.CUSTOMER && req.user.household) {
      const owner = await User.findById(order.customer._id).select('household').lean();
      allowed = String(owner?.household) === String(req.user.household);
    }
  }
  if (!allowed) throw new AppError('Order not found', 404);

  const isOwner = String(order.customer._id) === String(req.user._id);
  if (order.farmer) delete order.farmer.user;
  res.json({
    order: {
      ...order,
      canModify: isOwner && canCustomerModify(order),
      review: isOwner ? await reviewState(order, req.user._id) : null,
    },
  });
}

function assertModifiable(order, action) {
  if (canCustomerModify(order)) return;
  if (![ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED].includes(order.status)) {
    throw new AppError(`An order that is ${order.status} can no longer be ${action}`, 400);
  }
  throw new AppError(`The farmer's cut-off time has passed, so this order can no longer be ${action}`, 400);
}

async function loadOwnOrder(req) {
  assertId(req.params.id, 'order');
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

// PUT /api/orders/:id  -> modify items and/or pickup slot before the cut-off
export async function modifyOrder(req, res) {
  const order = await loadOwnOrder(req);
  assertModifiable(order, 'modified');

  const farmer = await loadFarmerForOrder(order.farmer);
  const { items, pickupDate, slotStart, marketId, note } = req.body;
  const changes = [];

  // New pickup slot (validated first because it has no side effects)
  let pickup;
  if (pickupDate || slotStart) {
    pickup = await validatePickup(farmer, {
      date: pickupDate || order.pickupDate,
      slotStart: slotStart || order.pickupSlot.start,
      marketId: marketId || order.market,
      excludeOrderId: order._id,
    });
    if (pickup.pickupDate !== order.pickupDate || pickup.pickupSlot.start !== order.pickupSlot.start || String(pickup.market) !== String(order.market)) {
      changes.push('pickup slot');
      const market = await Market.findById(pickup.market).select('name').lean();
      await assertNoPickupClash(order.customer?._id || order.customer, [{ date: pickup.pickupDate, market: pickup.market, start: pickup.pickupSlot.start, farmerName: farmer.stallName, marketName: market?.name }], { excludeOrderIds: [order._id] });
    }
  }

  // New items: give back the old stock, then reserve the new quantities
  if (Array.isArray(items)) {
    const oldItems = order.items.map((i) => ({ product: i.product, quantity: i.quantity }));
    await releaseItems(oldItems);
    try {
      order.items = await reserveItems(farmer._id, items);
    } catch (err) {
      await retakeItems(oldItems); // restore the original reservation
      throw err;
    }
    order.totalAmount = round2(order.items.reduce((sum, i) => sum + i.subtotal, 0));
    changes.push('items');
    await recordMovements(changeMovements(oldItems, order.items, order, 'customer'));
    await checkLowStock([...oldItems, ...order.items].map((i) => i.product));
  }

  if (pickup) {
    order.market = pickup.market;
    order.pickupDate = pickup.pickupDate;
    order.pickupSlot = pickup.pickupSlot;
    order.pickupAt = pickup.pickupAt;
    order.cutoffAt = pickup.cutoffAt;
  }
  if (note !== undefined) order.customerNote = String(note).slice(0, 500);

  if (!changes.length) {
    await order.save(); // only the note changed
    return res.json({ order });
  }

  // A modified order must be accepted again by the farmer
  const wasAccepted = order.status === ORDER_STATUS.ACCEPTED;
  pushStatus(order, ORDER_STATUS.PLACED, 'customer', `Modified by customer (${changes.join(', ')})`);
  await order.save();

  await notify(farmer.user, {
    type: 'order',
    title: `Pre-order ${order.orderNumber} was modified`,
    message: `${req.user.name} changed the ${changes.join(' and ')}.${wasAccepted ? ' Please review and accept it again.' : ''}`,
    link: `/farmer/orders?focus=${order._id}`,
  });

  res.json({ order });
}

// POST /api/orders/:id/cancel
export async function cancelOrder(req, res) {
  const order = await loadOwnOrder(req);
  assertModifiable(order, 'cancelled');
  await releaseItems(order.items);
  await recordMovements(orderMovements(order, 1, 'order_released', 'customer'));
  await checkLowStock(order.items.map((i) => i.product));
  pushStatus(order, ORDER_STATUS.CANCELLED, 'customer', req.body?.reason ? String(req.body.reason).slice(0, 200) : undefined);
  await order.save();

  const farmer = await Farmer.findById(order.farmer).select('user stallName');
  await notify(farmer.user, {
    type: 'order',
    title: `Pre-order ${order.orderNumber} cancelled`,
    message: `${req.user.name} cancelled the pre-order for ${order.pickupDate}. Stock has been returned to your inventory.`,
    link: `/farmer/orders?focus=${order._id}`,
  });
  await notify(req.user, {
    type: 'order',
    title: `Pre-order ${order.orderNumber} cancelled`,
    message: `Your pre-order with ${farmer.stallName} has been cancelled.`,
    link: `/account/orders/${order._id}`,
  });
  res.json({ order });
}

// GET /api/orders/:id/reorder  -> current availability of the items of a past order
export async function reorderItems(req, res) {
  const order = await loadOwnOrder(req);
  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } })
    .populate('farmer', 'stallName slug isActive')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = order.items.map((line) => {
    const p = byId.get(String(line.product));
    const available =
      p && !p.isRemoved && p.farmerActive && p.farmer?.isActive && p.status === PRODUCT_STATUS.AVAILABLE && p.quantityAvailable > 0;
    return {
      productId: String(line.product),
      name: line.name,
      quantity: available ? Math.min(line.quantity, p.quantityAvailable) : line.quantity,
      available: Boolean(available),
      product: p
        ? {
            _id: p._id,
            name: p.name,
            nameUr: p.nameUr,
            price: p.price,
            unit: p.unit,
            image: p.image,
            quantityAvailable: p.quantityAvailable,
            farmer: p.farmer ? { _id: p.farmer._id, stallName: p.farmer.stallName, slug: p.farmer.slug } : null,
          }
        : null,
    };
  });
  res.json({ items });
}

// GET /api/orders/family  -> orders of other household members (optional family sharing)
export async function familyOrders(req, res) {
  if (!req.user.household) return res.json({ orders: [] });
  const members = await User.find({ household: req.user.household, _id: { $ne: req.user._id } }).select('_id name').lean();
  const orders = await Order.find({ customer: { $in: members.map((m) => m._id) } })
    .populate(ORDER_POPULATE)
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  res.json({ orders: orders.map((o) => ({ ...o, farmer: { ...o.farmer, user: undefined } })) });
}

