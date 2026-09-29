import { t, unitName } from '../i18n';

export const roundQty = (n) => Math.round(Number(n) * 1000) / 1000;

const SMALL = { kg: 'g', litre: 'ml' };
export const stepOf = (p) => (p?.sellByWeight ? roundQty(p.minQuantity || 0.25) : 1);

export const minOf = (p) => (p?.sellByWeight ? stepOf(p) : Math.max(1, Math.round(p?.minQuantity || 1)));

export function maxOf(p, stock = p?.quantityAvailable) {
  const step = stepOf(p);
  let max = Number.isFinite(stock) ? stock : 9999;
  if (p?.maxPerOrder > 0) max = Math.min(max, p.maxPerOrder);
  return Math.max(0, roundQty(Math.floor(max / step + 1e-9) * step));
}

export const clampQty = (q, p, stock) => {
  const step = stepOf(p);
  const max = maxOf(p, stock);
  const snapped = roundQty(Math.round(Number(q) / step) * step);
  return Math.max(Math.min(minOf(p), max || minOf(p)), Math.min(max || snapped, snapped));
};

export function qtyLabel(quantity, unit = '') {
  const q = roundQty(quantity);
  if (SMALL[unit] && q < 1) return `${Math.round(q * 1000)} ${unitName(SMALL[unit])}`;
  const n = Number.isInteger(q) ? String(q) : String(q).replace(/0+$/, '');
  return unit ? `${n} ${unitName(unit)}` : n;
}

export const itemLabel = (quantity, unit, name) => (Number.isInteger(roundQty(quantity)) && !SMALL[unit] ? `${roundQty(quantity)} × ${name}` : `${qtyLabel(quantity, unit)} ${name}`);

export function weightChoices(p, stock) {
  const step = stepOf(p);
  const max = maxOf(p, stock);
  const wanted = [step, step * 2, 0.5, 1, 2, 5].map(roundQty);
  return [...new Set(wanted)].filter((q) => q >= step - 1e-9 && q <= max + 1e-9 && Math.abs(q / step - Math.round(q / step)) < 1e-6).sort((a, b) => a - b);
}

export function buyingRules(p) {
  const parts = [];
  if (p?.sellByWeight) parts.push(t('Sold from {min} (in steps of {min})', { min: qtyLabel(stepOf(p), p.unit) }));
  else if (minOf(p) > 1) parts.push(t('At least {min} per order', { min: qtyLabel(minOf(p), p.unit) }));
  if (p?.maxPerOrder > 0) parts.push(t('At most {max} per order', { max: qtyLabel(p.maxPerOrder, p.unit) }));
  return parts.join(' · ');
}
