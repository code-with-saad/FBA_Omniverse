import AppError from './AppError.js';

/** Quantities are kept to 3 decimals (0.25 kg = 250 g). */
export const roundQty = (n) => Math.round(Number(n) * 1000) / 1000;

/** The step a customer buys in: the smallest amount for products sold by weight, otherwise whole units. */
export const stepOf = (product) => (product.sellByWeight ? roundQty(product.minQuantity || 0.25) : 1);

/** "250 g", "1.5 kg", "2 kg", "3 dozen": a quantity with its unit, the way people say it. */
export function qtyText(quantity, unit = '') {
  const q = roundQty(quantity);
  const small = { kg: 'g', litre: 'ml' }[unit];
  if (small && q < 1) return `${Math.round(q * 1000)} ${small}`;
  const n = Number.isInteger(q) ? String(q) : String(q).replace(/0+$/, '');
  return unit ? `${n} ${unit}` : n;
}

/** "2 × Vine Tomatoes" for pieces, "250 g Green Chillies" for weights (notifications and e-mails). */
export const itemText = (item) => (Number.isInteger(item.quantity) && !{ kg: 1, litre: 1 }[item.unit] ? `${item.quantity} × ${item.name}` : Number.isInteger(item.quantity) ? `${item.quantity} ${item.unit} ${item.name}` : `${qtyText(item.quantity, item.unit)} ${item.name}`);

/**
 * Throws when `quantity` is not something a customer may buy of this product: whole units unless sold by weight,
 * at least the smallest amount, a multiple of it, and at most the per-order limit.
 */
export function assertQuantityAllowed(product, quantity) {
  const q = roundQty(quantity);
  const step = stepOf(product);
  const min = product.sellByWeight ? step : Math.max(1, Math.round(product.minQuantity || 1));
  if (!(q > 0)) throw new AppError(`Choose how much ${product.name} you want`, 400);
  if (!product.sellByWeight && !Number.isInteger(q)) throw new AppError(`${product.name} is sold in whole ${product.unit || 'units'}`, 400);
  if (q < min - 1e-9) throw new AppError(`The smallest amount of ${product.name} is ${qtyText(min, product.unit)}`, 400);
  if (product.sellByWeight && Math.abs(q / step - Math.round(q / step)) > 1e-6) throw new AppError(`${product.name} is sold in steps of ${qtyText(step, product.unit)}`, 400);
  if (product.maxPerOrder > 0 && q > product.maxPerOrder + 1e-9) throw new AppError(`You can order at most ${qtyText(product.maxPerOrder, product.unit)} of ${product.name} per pre-order`, 400);
  return q;
}

/** Keeps a product's buying rules consistent (called before saving): by weight only for kg / litre, whole steps otherwise. */
export function checkQuantityRules(product) {
  if (product.sellByWeight && !['kg', 'litre'].includes(product.unit)) throw new AppError('Selling by weight works for products priced per kg or per litre', 400);
  if (product.sellByWeight) {
    if (!(product.minQuantity > 0) || product.minQuantity > 1000) throw new AppError('The smallest amount must be between 10 g and 1000 kg', 400);
    if (product.minQuantity < 0.01) throw new AppError('The smallest amount must be at least 10 g', 400);
  } else {
    if (!product.minQuantity || product.minQuantity < 1) product.minQuantity = 1;
    if (!Number.isInteger(product.minQuantity)) throw new AppError(`The smallest amount must be a whole number of ${product.unit || 'units'} (or turn on selling by weight)`, 400);
    if (product.maxPerOrder && !Number.isInteger(product.maxPerOrder)) product.maxPerOrder = Math.floor(product.maxPerOrder);
  }
  if (product.maxPerOrder > 0 && product.maxPerOrder < product.minQuantity) throw new AppError('The most per order cannot be less than the smallest amount', 400);
}
