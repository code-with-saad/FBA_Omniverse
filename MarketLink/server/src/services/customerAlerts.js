import { Market, User } from '../models/index.js';
import { ROLES, USER_STATUS } from '../utils/constants.js';
import { toDateKey } from '../utils/dates.js';
import { notifyMany } from './notify.js';

const minutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
};
const time12 = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** Active customers who live in `city` or saved one of `marketIds`. */
async function customersFor(city, marketIds = []) {
  const or = [{ savedMarkets: { $in: marketIds } }];
  if (city) or.push({ city });
  const users = await User.find({ role: ROLES.CUSTOMER, status: USER_STATUS.ACTIVE, $or: or }).select('_id').lean();
  return users.map((u) => u._id);
}

/**
 * "Markets open today in Karachi": sent once a day (an hour before the first market opens) to the
 * customers of each city and those who saved one of the markets. Runs from the hourly scheduler.
 */
export async function announceMarketsToday(now = new Date()) {
  const today = toDateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const markets = await Market.find({ isActive: true, operatingDays: now.getDay(), liveNoticeDate: { $ne: today } }).select('name slug city openTime closeTime').lean();
  const byCity = new Map();
  for (const m of markets) if (nowMin >= minutes(m.openTime) - 60 && nowMin < minutes(m.closeTime)) (byCity.get(m.city) || byCity.set(m.city, []).get(m.city)).push(m);
  let sent = 0;
  for (const [city, list] of byCity) {
    const users = await customersFor(city, list.map((m) => m._id));
    const one = list.length === 1 ? list[0] : null;
    sent += await notifyMany(users, {
      type: 'announcement',
      title: one ? `${one.name} is open today` : `${list.length} markets are open today in ${city}`,
      message: one
        ? `${one.name} is open today from ${time12(one.openTime)} to ${time12(one.closeTime)}. Pre-order now and pick up at the stall.`
        : `Open today: ${list.map((m) => `${m.name} (${time12(m.openTime)} to ${time12(m.closeTime)})`).join(', ')}.`,
      link: one ? `/markets/${one.slug}` : '/markets',
    });
    await Market.updateMany({ _id: { $in: list.map((m) => m._id) } }, { liveNoticeDate: today });
  }
  if (sent) console.log(`[alerts] "Market open today" sent to ${sent} customer(s)`);
  return sent;
}

/** "New farmer at Clifton Market": when a stall is approved, customers of its city and markets hear about it. */
export async function announceNewFarmer(farmer) {
  const markets = await Market.find({ _id: { $in: farmer.markets || [] } }).select('name').lean();
  const users = await customersFor(farmer.city, markets.map((m) => m._id));
  const where = markets.length ? ` at ${markets.map((m) => m.name).join(', ')}` : farmer.city ? ` in ${farmer.city}` : '';
  return notifyMany(users, {
    type: 'announcement',
    title: `New farmer${where}: ${farmer.stallName}`,
    message: `${farmer.stallName} just joined MarketLink${where}. See what they grow and pre-order for pickup.`,
    link: `/farmers/${farmer.slug}`,
  });
}
