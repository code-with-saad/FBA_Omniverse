import { Farmer, Order, Product, StockMovement } from '../models/index.js';
import { OPEN_ORDER_STATUSES, PRODUCT_STATUS } from '../utils/constants.js';
import { notify } from './notify.js';

/**
 * Writes inventory log entries. `entries`: [{ product: id or doc, change, type, reason?, order?, by }]
 * The quantity after the change is read from the product, so call this after updating stock.
 */
export async function recordMovements(entries = []) {
  const list = entries.filter((e) => e && Number(e.change));
  if (!list.length) return;
  const ids = [...new Set(list.map((e) => String(e.product?._id || e.product)))];
  const products = await Product.find({ _id: { $in: ids } }).select('farmer name nameUr unit quantityAvailable').lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const docs = list
    .map((e) => {
      const p = byId.get(String(e.product?._id || e.product));
      if (!p) return null;
      return {
        farmer: p.farmer,
        product: p._id,
        productName: p.name,
        productNameUr: p.nameUr,
        unit: p.unit,
        change: Number(e.change),
        quantityAfter: Math.max(0, p.quantityAvailable),
        type: e.type,
        reason: e.reason,
        order: e.order?._id || e.order,
        orderNumber: e.order?.orderNumber || e.orderNumber,
        by: e.by || 'system',
      };
    })
    .filter(Boolean);
  if (docs.length) await StockMovement.insertMany(docs);
}

/** Log entries for all items of an order: sign -1 when stock is reserved, +1 when it is released. */
export function orderMovements(order, sign, type, by) {
  return (order.items || []).map((i) => ({ product: i.product, change: sign * i.quantity, type, order, by }));
}

/** Net change per product when a customer modifies an order (old items released, new ones reserved). */
export function changeMovements(oldItems, newItems, order, by) {
  const net = new Map();
  for (const i of oldItems) net.set(String(i.product), (net.get(String(i.product)) || 0) + i.quantity);
  for (const i of newItems) net.set(String(i.product), (net.get(String(i.product)) || 0) - i.quantity);
  return [...net].map(([product, change]) => ({ product, change, type: 'order_changed', order, by }));
}

/**
 * Low-stock alerts: when a product falls to its alert level the farmer gets an in-app
 * notification and an e-mail (Nodemailer). The alert is sent once and re-armed after restocking.
 */
export async function checkLowStock(productIds = []) {
  const ids = [...new Set(productIds.map((id) => String(id?._id || id)))];
  if (!ids.length) return 0;
  const products = await Product.find({ _id: { $in: ids } }).select('farmer name unit quantityAvailable lowStockThreshold lowStockAlertedAt soldOutAlertedAt status isRemoved');
  let sent = 0;
  for (const p of products) {
    const threshold = p.lowStockThreshold ?? 5;
    const low = p.quantityAvailable <= threshold;
    const soldOut = p.quantityAvailable <= 0;
    const watched = !p.isRemoved && p.status !== PRODUCT_STATUS.UNAVAILABLE;
    // One alert when the stock reaches the alert level, and one more if it then sells out
    const alert = watched && (soldOut ? !p.soldOutAlertedAt : low && !p.lowStockAlertedAt);
    if (alert) {
      const farmer = await Farmer.findById(p.farmer).select('user stallName').lean();
      if (!farmer) continue;
      await notify(
        farmer.user,
        {
          type: 'stock',
          title: soldOut ? `${p.name} is sold out` : `Low stock: ${p.name}`,
          message: soldOut
            ? `${p.name} has no stock left, so customers cannot pre-order it. Add stock in Inventory when you have more.`
            : `Only ${p.quantityAvailable} ${p.unit} of ${p.name} left at ${farmer.stallName} (alert level ${threshold}). Restock it in Inventory before it sells out.`,
          link: '/farmer/inventory',
        },
        { email: true }
      );
      p.lowStockAlertedAt = p.lowStockAlertedAt || new Date();
      if (soldOut) p.soldOutAlertedAt = new Date();
      await p.save();
      sent += 1;
      continue;
    }
    // Restocked: arm the alerts again
    let changed = false;
    if (!soldOut && p.soldOutAlertedAt) {
      p.soldOutAlertedAt = undefined;
      changed = true;
    }
    if (!low && p.lowStockAlertedAt) {
      p.lowStockAlertedAt = undefined;
      changed = true;
    }
    if (changed) await p.save();
  }
  return sent;
}

/** Stock promised to open pre-orders, per product id. */
export async function reservedByProduct(farmerId) {
  const orders = await Order.find({ farmer: farmerId, status: { $in: OPEN_ORDER_STATUSES } }).select('items').lean();
  const reserved = new Map();
  for (const o of orders) for (const i of o.items) reserved.set(String(i.product), (reserved.get(String(i.product)) || 0) + i.quantity);
  return reserved;
}
