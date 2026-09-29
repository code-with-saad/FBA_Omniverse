import { Order } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { OPEN_ORDER_STATUSES, DAY_NAMES } from '../utils/constants.js';
import {
  addDays,
  combineDateTime,
  isDateKey,
  minutesToTime,
  parseDateKey,
  startOfDay,
  timeToMinutes,
  toDateKey,
} from '../utils/dates.js';

/** Splits a window (09:00-11:00) into slots of `slotMinutes` (09:00-09:30, 09:30-10:00 ...). */
export function generateSlots(window, slotMinutes) {
  const start = timeToMinutes(window.start);
  const end = timeToMinutes(window.end);
  if (end <= start) return [];
  if (end - start < slotMinutes) return [{ start: window.start, end: window.end }];
  const slots = [];
  for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
    slots.push({ start: minutesToTime(t), end: minutesToTime(t + slotMinutes) });
  }
  return slots;
}

const slotKey = (date, start, market) => `${date}|${start}|${market}`;

async function countBookings(farmerId, dateKeys, excludeOrderId) {
  const filter = { farmer: farmerId, status: { $in: OPEN_ORDER_STATUSES }, pickupDate: { $in: dateKeys } };
  if (excludeOrderId) filter._id = { $ne: excludeOrderId };
  const orders = await Order.find(filter).select('pickupDate pickupSlot market').lean();
  const counts = new Map();
  for (const o of orders) {
    const key = slotKey(o.pickupDate, o.pickupSlot.start, String(o.market));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * Upcoming pickup dates of a farmer with every slot and its remaining capacity.
 * The farmer document must have `pickupWindows.market` populated.
 */
export async function getAvailability(farmer, { days = 14, excludeOrderId, now = new Date() } = {}) {
  const today = startOfDay(now);
  const candidates = [];
  const blocked = new Set(farmer.blockedDates || []);
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i);
    if (blocked.has(toDateKey(date))) continue; // farmer is not at the market that day
    const windows = (farmer.pickupWindows || []).filter((w) => w.day === date.getDay() && w.market);
    if (windows.length) candidates.push({ date, windows });
  }
  const counts = await countBookings(farmer._id, candidates.map((c) => toDateKey(c.date)), excludeOrderId);
  const cutoffMs = (farmer.orderCutoffHours || 0) * 3600 * 1000;

  const result = [];
  for (const { date, windows } of candidates) {
    const dateKey = toDateKey(date);
    const windowList = windows
      .map((w) => {
        const marketId = String(w.market._id || w.market);
        const slots = generateSlots(w, farmer.slotMinutes || 30).map((s) => {
          const pickupAt = combineDateTime(dateKey, s.start);
          const cutoffAt = new Date(pickupAt.getTime() - cutoffMs);
          const booked = counts.get(slotKey(dateKey, s.start, marketId)) || 0;
          const remaining = Math.max(0, (farmer.slotCapacity || 1) - booked);
          return { ...s, cutoffAt, remaining, available: now < cutoffAt && remaining > 0 };
        });
        return {
          market: w.market._id ? { _id: w.market._id, name: w.market.name, address: w.market.address } : { _id: w.market },
          start: w.start,
          end: w.end,
          slots,
        };
      })
      .filter((w) => w.slots.some((s) => s.available));
    if (windowList.length) {
      result.push({ date: dateKey, day: date.getDay(), dayName: DAY_NAMES[date.getDay()], windows: windowList });
    }
  }
  return result;
}

/**
 * Checks that the requested pickup (date + slot start + market) is valid for this farmer
 * and still open. Returns the details that are stored on the order.
 */
export async function validatePickup(farmer, { date, slotStart, marketId, excludeOrderId, now = new Date(), ignoreCutoff = false }) {
  if (!isDateKey(date)) throw new AppError('Please choose a valid pickup date', 400);
  if ((farmer.blockedDates || []).includes(date)) throw new AppError('The farmer is not at the market on this date. Please choose another day', 400);
  const day = parseDateKey(date).getDay();
  const windows = (farmer.pickupWindows || []).filter(
    (w) => w.day === day && (!marketId || String(w.market._id || w.market) === String(marketId))
  );
  let chosen = null;
  for (const w of windows) {
    const slot = generateSlots(w, farmer.slotMinutes || 30).find((s) => s.start === slotStart);
    if (slot) {
      chosen = { window: w, slot };
      break;
    }
  }
  if (!chosen) throw new AppError('The selected pickup slot is not offered by this farmer', 400);

  const pickupAt = combineDateTime(date, chosen.slot.start);
  const cutoffAt = new Date(pickupAt.getTime() - (farmer.orderCutoffHours || 0) * 3600 * 1000);
  // A new pickup for an order that already exists (after "not received") only has to be in the future
  if (ignoreCutoff ? now >= pickupAt : now >= cutoffAt) throw new AppError('The order cut-off time for this slot has passed. Please pick a later slot', 400);

  const marketKey = String(chosen.window.market._id || chosen.window.market);
  const counts = await countBookings(farmer._id, [date], excludeOrderId);
  if ((counts.get(slotKey(date, chosen.slot.start, marketKey)) || 0) >= (farmer.slotCapacity || 1)) {
    throw new AppError('This pickup slot is fully booked. Please choose another slot', 409);
  }
  return { market: marketKey, pickupDate: date, pickupSlot: chosen.slot, pickupAt, cutoffAt };
}
