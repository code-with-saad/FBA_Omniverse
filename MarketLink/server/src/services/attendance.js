import { Farmer, MarketDayLog, Order } from '../models/index.js';
import { OPEN_ORDER_STATUSES, ORDER_STATUS } from '../utils/constants.js';
import { isValidId } from '../utils/helpers.js';
import { addDays, parseDateKey, timeToMinutes, toDateKey } from '../utils/dates.js';

export const REASON_LABEL = {
  sick: 'Sick or unwell',
  transport: 'Transport problem',
  weather: 'Bad weather',
  harvest: 'Nothing ready to sell',
  family: 'Family matter',
  other: 'Other reason',
  closed_date: 'Closed date (set in advance)',
};

/**
 * Every market day of every approved farmer from `from` to `to` (date keys, from their pickup times) and whether
 * they came: "attended" (checked in), "absent" (said they cannot come, with the reason) or "no_check_in".
 * Today's market days that have not ended yet count as "today" until then. Used by the attendance page and the reports.
 */
export async function buildAttendance({ from, to, farmer, market } = {}) {
  const today = toDateKey();
  const lastDay = to > today ? today : to; // attendance is about days that have come

  const farmerFilter = { isActive: true };
  if (farmer && isValidId(farmer)) farmerFilter._id = farmer;
  const farmers = await Farmer.find(farmerFilter).select('stallName slug logo phone pickupWindows').populate('pickupWindows.market', 'name slug').lean();
  const marketId = market && isValidId(market) ? String(market) : null;
  const ids = farmers.map((f) => f._id);

  const [logs, orders, upcoming] = await Promise.all([
    MarketDayLog.find({ farmer: { $in: ids }, date: { $gte: from, $lte: lastDay } }).lean(),
    Order.aggregate([
      { $match: { farmer: { $in: ids }, pickupDate: { $gte: from, $lte: lastDay }, status: { $in: [...OPEN_ORDER_STATUSES, ORDER_STATUS.COMPLETED] } } },
      { $group: { _id: { farmer: '$farmer', date: '$pickupDate' }, n: { $sum: 1 } } },
    ]),
    MarketDayLog.find({ farmer: { $in: ids }, status: 'away', date: { $gt: today, $lte: toDateKey(addDays(new Date(), 30)) } })
      .populate('farmer', 'stallName slug')
      .sort({ date: 1 })
      .lean(),
  ]);
  const logOf = new Map(logs.map((l) => [`${l.farmer}|${l.date}`, l]));
  const ordersOf = new Map(orders.map((o) => [`${o._id.farmer}|${o._id.date}`, o.n]));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const rows = [];
  for (let d = parseDateKey(from); toDateKey(d) <= lastDay; d = addDays(d, 1)) {
    const date = toDateKey(d);
    const weekday = d.getDay();
    for (const f of farmers) {
      const windows = (f.pickupWindows || []).filter((w) => w.day === weekday && (!marketId || String(w.market?._id || w.market) === marketId));
      const log = logOf.get(`${f._id}|${date}`);
      // a closed date or "not coming" on a day without pickup times is not a market day
      if (!windows.length) continue;
      let status = 'no_check_in';
      if (log?.status === 'here') status = 'attended';
      else if (log?.status === 'away') status = 'absent';
      else if (date === today && nowMin < Math.max(...windows.map((w) => timeToMinutes(w.end)))) status = 'today';
      rows.push({
        date,
        farmer: { _id: f._id, stallName: f.stallName, slug: f.slug, phone: f.phone },
        markets: [...new Set(windows.map((w) => w.market?.name).filter(Boolean))],
        start: windows.map((w) => w.start).sort()[0],
        end: windows.map((w) => w.end).sort().at(-1),
        status,
        reason: log?.reason,
        note: log?.note,
        markedAt: log?.at,
        pickups: ordersOf.get(`${f._id}|${date}`) || 0,
      });
    }
  }
  rows.sort((a, b) => (a.date === b.date ? a.farmer.stallName.localeCompare(b.farmer.stallName) : b.date.localeCompare(a.date)));

  const count = (list, s) => list.filter((r) => r.status === s).length;
  const decided = (list) => list.filter((r) => r.status !== 'today');
  const rate = (list) => {
    const d = decided(list);
    return d.length ? Math.round((count(d, 'attended') / d.length) * 100) : null;
  };
  const byFarmer = farmers
    .map((f) => {
      const mine = rows.filter((r) => String(r.farmer._id) === String(f._id));
      return { farmer: { _id: f._id, stallName: f.stallName, slug: f.slug }, marketDays: mine.length, attended: count(mine, 'attended'), absent: count(mine, 'absent'), noCheckIn: count(mine, 'no_check_in'), rate: rate(mine) };
    })
    .filter((f) => f.marketDays > 0)
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
  const byReason = {};
  for (const r of rows) if (r.status === 'absent') byReason[r.reason || 'other'] = (byReason[r.reason || 'other'] || 0) + 1;

  return {
    from,
    to,
    summary: { marketDays: rows.length, attended: count(rows, 'attended'), absent: count(rows, 'absent'), noCheckIn: count(rows, 'no_check_in'), today: count(rows, 'today'), rate: rate(rows), pickupsOnAbsentDays: rows.filter((r) => r.status === 'absent').reduce((n, r) => n + r.pickups, 0) },
    rows,
    byFarmer,
    byReason: Object.entries(byReason)
      .map(([reason, n]) => ({ reason, label: REASON_LABEL[reason] || reason, n }))
      .sort((a, b) => b.n - a.n),
    upcoming: upcoming.map((u) => ({ date: u.date, farmer: u.farmer, reason: u.reason, label: REASON_LABEL[u.reason] || u.reason, note: u.note, ordersAffected: u.ordersAffected })),
    reasons: REASON_LABEL,
  };
}
