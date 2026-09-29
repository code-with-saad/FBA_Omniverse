import { t } from '../i18n';
import { time12 } from './format';

export const PICKUP_GAP_MINUTES = 60;

const minutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return h * 60 + (m || 0);
};

export const pickupsClash = (a, b) => Boolean(a?.start && b?.start) && a.date === b.date && String(a.marketId) !== String(b.marketId) && Math.abs(minutes(a.start) - minutes(b.start)) < PICKUP_GAP_MINUTES;

export const findClash = (pickup, others = []) => others.find((o) => pickupsClash(pickup, o));

export const clashText = (o) => t('{farmer} at {market}, {time}', { farmer: o.farmer, market: o.market, time: time12(o.start) });
