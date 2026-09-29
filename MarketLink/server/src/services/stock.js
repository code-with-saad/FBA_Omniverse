import { Product, Farmer, Order, RestockRequest, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { OPEN_ORDER_STATUSES, PRODUCT_STATUS } from '../utils/constants.js';
import { isoWeekKey } from '../utils/dates.js';
import { round2 } from '../utils/helpers.js';
import { notify, notifyMany } from './notify.js';
import { sendMail } from './mailer.js';
import { checkLowStock, recordMovements } from './inventory.js';
import { assertQuantityAllowed, roundQty, stepOf } from '../utils/quantity.js';

/** Merge duplicate lines and validate quantities: [{productId, quantity}] */
export function normaliseItems(rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new AppError('Your order has no items', 400);
  const merged = new Map();
  for (const line of rawItems) {
    const id = String(line.productId || line.product || '');
    const qty = roundQty(line.quantity);
    if (!id || !Number.isFinite(qty) || qty <= 0 || qty > 9999) {
      throw new AppError('Each item needs a quantity between 0 and 9999', 400);
    }
    merged.set(id, roundQty((merged.get(id) || 0) + qty));
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

async function markSoldOutIfEmpty(productId) {
  await Product.updateOne(
    { _id: productId, quantityAvailable: { $lte: 0 }, status: PRODUCT_STATUS.AVAILABLE },
    { $set: { status: PRODUCT_STATUS.SOLD_OUT, quantityAvailable: 0 } }
  );
}

/**
 * Reserves stock for an order. Every decrement is atomic (only succeeds when enough
 * stock is left), so two customers can never buy the same last item.
 * On any failure all previous reservations are rolled back.
 */
export async function reserveItems(farmerId, rawItems) {
  const items = normaliseItems(rawItems);
  const reserved = [];
  try {
    for (const { productId, quantity } of items) {
      // whole units unless sold by weight, at least the smallest amount, at most the per-order limit
      const rules = await Product.findById(productId).select('name unit sellByWeight minQuantity maxPerOrder').lean();
      if (rules) assertQuantityAllowed(rules, quantity);
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          farmer: farmerId,
          isRemoved: false,
          farmerActive: true,
          status: PRODUCT_STATUS.AVAILABLE,
          quantityAvailable: { $gte: quantity },
        },
        { $inc: { quantityAvailable: -quantity } },
        { returnDocument: 'after' }
      );
      if (!product) {
        const current = await Product.findById(productId).select('name quantityAvailable status farmer');
        if (!current || String(current.farmer) !== String(farmerId)) throw new AppError('A product in your cart no longer exists', 400);
        if (current.status !== PRODUCT_STATUS.AVAILABLE || current.quantityAvailable <= 0) {
          throw new AppError(`${current.name} is currently not available`, 409);
        }
        throw new AppError(`Only ${current.quantityAvailable} of ${current.name} left in stock`, 409);
      }
      reserved.push({ product, quantity });
      if (product.quantityAvailable <= 0) await markSoldOutIfEmpty(product._id);
    }
  } catch (err) {
    await releaseItems(reserved.map((r) => ({ product: r.product._id, quantity: r.quantity })));
    throw err;
  }

  return reserved.map(({ product, quantity }) => ({
    product: product._id,
    name: product.name,
    nameUr: product.nameUr || undefined,
    image: product.image,
    unit: product.unit,
    price: product.price,
    quantity,
    step: stepOf(product),
    maxPerOrder: product.maxPerOrder || 0,
    subtotal: round2(product.price * quantity),
  }));
}

/** Puts stock back (cancelled / declined / modified orders). */
export async function releaseItems(items = []) {
  for (const item of items) {
    const id = item.product?._id || item.product;
    await Product.updateOne({ _id: id }, { $inc: { quantityAvailable: item.quantity } });
    await Product.updateOne(
      { _id: id, status: PRODUCT_STATUS.SOLD_OUT, quantityAvailable: { $gt: 0 } },
      { $set: { status: PRODUCT_STATUS.AVAILABLE } }
    );
  }
}

/** Undo a releaseItems() call (used when modifying an order fails half-way). */
export async function retakeItems(items = []) {
  for (const item of items) {
    const id = item.product?._id || item.product;
    await Product.updateOne({ _id: id }, { $inc: { quantityAvailable: -item.quantity } });
    await markSoldOutIfEmpty(id);
  }
}

/**
 * Tell customers that a product is back in stock: an in-app notification for everyone who favourited it,
 * and a notification plus an e-mail for everyone who pressed "Remind me" (guests get the e-mail only).
 * Each reminder is sent once and then removed.
 */
export async function notifyRestock(product) {
  const alert = {
    type: 'restock',
    title: `${product.name} is back in stock`,
    message: `Good news! ${product.name} is available again. Pre-order before it sells out.`,
    link: `/products/${product.slug || product._id}`,
  };
  const reminders = await RestockRequest.find({ product: product._id }).lean();
  const reminded = new Set();
  for (const r of reminders) {
    try {
      if (r.user) {
        await notify(r.user, alert, { email: true });
        reminded.add(String(r.user));
      } else {
        await sendMail({ to: r.email, subject: alert.title, message: alert.message, link: alert.link, linkLabel: 'Pre-order now' });
      }
    } catch (err) {
      console.error(`[restock] Could not remind ${r.email}: ${err.message}`);
    }
  }
  if (reminders.length) await RestockRequest.deleteMany({ _id: { $in: reminders.map((r) => r._id) } });
  const fans = await User.find({ favoriteProducts: product._id }).select('_id').lean();
  return notifyMany(
    fans.map((u) => u._id).filter((id) => !reminded.has(String(id))),
    alert
  ) + reminders.length;
}

/**
 * Recurring weekly stock: resets quantityAvailable of every product to its
 * templateQuantity minus what open pre-orders already reserved
 * (products the farmer marked "unavailable" are skipped).
 */
export async function applyWeeklyTemplate(farmer, { notifyFans = true } = {}) {
  const products = await Product.find({ farmer: farmer._id, isRemoved: false, templateQuantity: { $gt: 0 } });

  // Stock already promised to open pre-orders is subtracted, so the reset can never oversell.
  const openOrders = await Order.find({ farmer: farmer._id, status: { $in: OPEN_ORDER_STATUSES } }).select('items').lean();
  const reserved = new Map();
  for (const order of openOrders) {
    for (const item of order.items) reserved.set(String(item.product), (reserved.get(String(item.product)) || 0) + item.quantity);
  }

  let updated = 0;
  const restocked = [];
  const movements = [];
  for (const product of products) {
    if (product.status === PRODUCT_STATUS.UNAVAILABLE) continue;
    const wasEmpty = product.quantityAvailable <= 0;
    const before = product.quantityAvailable;
    product.quantityAvailable = Math.max(0, product.templateQuantity - (reserved.get(String(product._id)) || 0));
    if (product.status === PRODUCT_STATUS.SOLD_OUT && product.quantityAvailable > 0) product.status = PRODUCT_STATUS.AVAILABLE;
    await product.save();
    movements.push({ product, change: product.quantityAvailable - before, type: 'template', reason: 'Weekly stock template', by: 'system' });
    updated += 1;
    if (wasEmpty && product.quantityAvailable > 0) restocked.push(product);
  }
  await Farmer.updateOne({ _id: farmer._id }, { templateLastAppliedWeek: isoWeekKey() });
  await recordMovements(movements);
  await checkLowStock(products.map((p) => p._id));

  if (notifyFans && updated) {
    for (const p of restocked) await notifyRestock(p);
    const fans = await User.find({ favoriteFarmers: farmer._id }).select('_id').lean();
    await notifyMany(
      fans.map((u) => u._id),
      {
        type: 'restock',
        title: `Fresh weekly stock at ${farmer.stallName}`,
        message: `${farmer.stallName} has published this week's harvest. Browse and pre-order now.`,
        link: `/farmers/${farmer.slug}`,
      }
    );
  }
  return updated;
}

/** Copies market / day info from the farmer profile onto all of the farmer's products. */
export async function syncFarmerProducts(farmer, farmerActive) {
  const update = { markets: farmer.markets, days: farmer.operatingDays };
  if (typeof farmerActive === 'boolean') update.farmerActive = farmerActive;
  await Product.updateMany({ farmer: farmer._id }, { $set: update });
}
