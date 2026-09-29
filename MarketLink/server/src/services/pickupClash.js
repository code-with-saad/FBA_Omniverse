import { Order } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { OPEN_ORDER_STATUSES } from '../utils/constants.js';
import { timeToMinutes } from '../utils/dates.js';

/**
 * One customer cannot be at two markets at the same time. Pickups on the same day at different markets must
 * start at least PICKUP_GAP_MINUTES apart (time to travel); pickups at the same market can be at the same time
 * (one visit, two stalls). Checked for the pickups of one checkout and against the customer's open pre-orders.
 */
export const PICKUP_GAP_MINUTES = 60;

const time12 = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** { date, market, start } pairs that the same person cannot both make. */
export const pickupsClash = (a, b) => a.date === b.date && String(a.market) !== String(b.market) && Math.abs(timeToMinutes(a.start) - timeToMinutes(b.start)) < PICKUP_GAP_MINUTES;

/**
 * pickups: [{ date, market, start, farmerName, marketName }]. Throws a 400 naming both pickups when two clash.
 * `excludeOrderIds`: open orders being changed (their old pickup does not count).
 */
export async function assertNoPickupClash(customerId, pickups, { excludeOrderIds = [] } = {}) {
  const dates = [...new Set(pickups.map((p) => p.date))];
  const open = await Order.find({ customer: customerId, status: { $in: OPEN_ORDER_STATUSES }, pickupDate: { $in: dates }, _id: { $nin: excludeOrderIds } })
    .select('orderNumber pickupDate pickupSlot market farmer')
    .populate('market', 'name')
    .populate('farmer', 'stallName')
    .lean();
  const existing = open.map((o) => ({ date: o.pickupDate, market: o.market?._id, start: o.pickupSlot.start, farmerName: o.farmer?.stallName, marketName: o.market?.name, orderNumber: o.orderNumber }));
  for (let i = 0; i < pickups.length; i += 1) {
    for (const other of [...pickups.slice(i + 1), ...existing]) {
      if (!pickupsClash(pickups[i], other)) continue;
      const a = pickups[i];
      throw new AppError(
        `You cannot be at two markets at once: ${a.farmerName} at ${a.marketName} (${time12(a.start)}) and ${other.farmerName} at ${other.marketName} (${time12(other.start)})${other.orderNumber ? `, your pre-order ${other.orderNumber},` : ''} on the same day. Choose pickup times at least 1 hour apart, or the same market.`,
        400
      );
    }
  }
}
