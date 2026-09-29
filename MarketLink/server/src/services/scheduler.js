import { Farmer, Product, User } from '../models/index.js';
import { USER_STATUS } from '../utils/constants.js';
import { isoWeekKey } from '../utils/dates.js';
import { applyWeeklyTemplate } from './stock.js';
import { announceMarketsToday } from './customerAlerts.js';
import { bumpCache } from './cache.js';

/**
 * Runs once an hour. At the start of every new week it re-applies the weekly stock
 * template for farmers who enabled "auto apply"; every day it tells customers which markets are open.
 */
export async function runWeeklyTemplates() {
  const week = isoWeekKey();
  const farmers = await Farmer.find({ autoApplyTemplate: true, templateLastAppliedWeek: { $ne: week } });
  let count = 0;
  for (const farmer of farmers) {
    const user = await User.findById(farmer.user).select('status');
    if (user?.status !== USER_STATUS.ACTIVE) continue;
    await applyWeeklyTemplate(farmer);
    count += 1;
  }
  if (count) {
    console.log(`[scheduler] Weekly stock template applied for ${count} farmer(s) (${week})`);
    await bumpCache();
  }
}

/** Offers with an end date end by themselves: the usual price comes back. */
export async function endExpiredOffers(now = new Date()) {
  const products = await Product.find({ offerEndsAt: { $lte: now } });
  for (const product of products) {
    if (product.compareAtPrice > product.price) product.price = product.compareAtPrice;
    product.compareAtPrice = undefined;
    product.offerEndsAt = undefined;
    await product.save();
  }
  if (products.length) {
    console.log(`[scheduler] ${products.length} offer(s) ended`);
    await bumpCache();
  }
  return products.length;
}

export function startScheduler() {
  const run = () => {
    runWeeklyTemplates().catch((err) => console.error('[scheduler]', err.message));
    announceMarketsToday().catch((err) => console.error('[scheduler]', err.message));
    endExpiredOffers().catch((err) => console.error('[scheduler]', err.message));
  };
  setTimeout(run, 5000);
  return setInterval(run, 60 * 60 * 1000);
}
