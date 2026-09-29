import { Order, Product, StockMovement } from '../models/index.js';
import { MOVEMENT_TYPES } from '../models/StockMovement.js';
import AppError from '../utils/AppError.js';
import { ORDER_STATUS, PRODUCT_STATUS } from '../utils/constants.js';
import { assertId, isValidId, round2, toNumber } from '../utils/helpers.js';
import { dateRange } from '../utils/dataTable.js';
import { checkLowStock, recordMovements, reservedByProduct } from '../services/inventory.js';
import { notifyRestock } from '../services/stock.js';

// Reasons a farmer can pick when adjusting stock by hand
const ADJUST_REASONS = {
  restock: 'Harvest / restock',
  stall_sale: 'Sold at the stall',
  waste: 'Damaged or spoiled',
  correction: 'Stock count correction',
  adjustment: 'Other',
};

// GET /api/farmer/inventory  (stock, reserved, alert levels and value of every product)
export async function inventory(req, res) {
  const products = await Product.find({ farmer: req.farmer._id, deletedByFarmer: { $ne: true } })
    .populate('category', 'name nameUr slug color')
    .sort({ name: 1 })
    .lean();
  const reserved = await reservedByProduct(req.farmer._id);
  const last = await StockMovement.find({ farmer: req.farmer._id }).sort({ createdAt: -1 }).limit(500).select('product createdAt').lean();
  const lastMove = new Map();
  for (const m of last) if (!lastMove.has(String(m.product))) lastMove.set(String(m.product), m.createdAt);

  const rows = products.map((p) => {
    const threshold = p.lowStockThreshold ?? 5;
    const state = p.isRemoved ? 'removed' : p.status === PRODUCT_STATUS.UNAVAILABLE ? 'unavailable' : p.quantityAvailable <= 0 ? 'out' : p.quantityAvailable <= threshold ? 'low' : 'ok';
    return {
      _id: p._id,
      name: p.name,
      nameUr: p.nameUr,
      slug: p.slug,
      image: p.image,
      category: p.category,
      unit: p.unit,
      price: p.price,
      status: p.status,
      isRemoved: p.isRemoved,
      quantityAvailable: p.quantityAvailable,
      templateQuantity: p.templateQuantity,
      lowStockThreshold: threshold,
      reserved: reserved.get(String(p._id)) || 0,
      totalSold: p.totalSold,
      value: round2(p.price * p.quantityAvailable),
      state,
      lastMovementAt: lastMove.get(String(p._id)) || p.updatedAt,
    };
  });
  const live = rows.filter((r) => !r.isRemoved);
  res.json({
    products: rows,
    totals: {
      products: live.length,
      units: live.reduce((s, r) => s + r.quantityAvailable, 0),
      value: round2(live.reduce((s, r) => s + r.value, 0)),
      reserved: live.reduce((s, r) => s + r.reserved, 0),
      low: live.filter((r) => r.state === 'low').length,
      out: live.filter((r) => r.state === 'out').length,
    },
    reasons: ADJUST_REASONS,
  });
}

// GET /api/farmer/inventory/movements?product=&type=&from=&to=
export async function movements(req, res) {
  const filter = { farmer: req.farmer._id, ...dateRange('createdAt', req.query.from, req.query.to) };
  if (isValidId(req.query.product)) filter.product = req.query.product;
  if (MOVEMENT_TYPES.includes(req.query.type)) filter.type = req.query.type;
  const list = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
  res.json({ movements: list, types: MOVEMENT_TYPES });
}

async function ownProduct(req) {
  const product = await Product.findOne({ _id: assertId(req.params.id, 'product'), farmer: req.farmer._id, deletedByFarmer: { $ne: true } });
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

// POST /api/farmer/inventory/:id/adjust  { mode: add | remove | set, quantity, reason, note }
export async function adjustStock(req, res) {
  const product = await ownProduct(req);
  const qty = toNumber(req.body.quantity);
  if (qty === undefined || qty < 0 || !Number.isInteger(qty) || qty > 100000) throw new AppError('Enter a whole number of units', 400);
  const mode = ['add', 'remove', 'set'].includes(req.body.mode) ? req.body.mode : 'add';
  const reason = Object.keys(ADJUST_REASONS).includes(req.body.reason) ? req.body.reason : mode === 'add' ? 'restock' : 'correction';
  const before = product.quantityAvailable;
  let after = mode === 'add' ? before + qty : mode === 'remove' ? before - qty : qty;
  if (after < 0) throw new AppError(`You only have ${before} ${product.unit} in stock`, 400);
  after = Math.floor(after);
  if (after === before) throw new AppError('The stock stays the same', 400);

  const wasEmpty = before <= 0 || product.status === PRODUCT_STATUS.SOLD_OUT;
  product.quantityAvailable = after;
  if (after <= 0 && product.status === PRODUCT_STATUS.AVAILABLE) product.status = PRODUCT_STATUS.SOLD_OUT;
  if (after > 0 && product.status === PRODUCT_STATUS.SOLD_OUT) product.status = PRODUCT_STATUS.AVAILABLE;
  await product.save();

  const note = req.body.note ? String(req.body.note).trim().slice(0, 150) : '';
  await recordMovements([{ product, change: after - before, type: reason, reason: note ? `${ADJUST_REASONS[reason]}: ${note}` : ADJUST_REASONS[reason], by: 'farmer' }]);
  await checkLowStock([product._id]);
  if (wasEmpty && after > 0 && product.status === PRODUCT_STATUS.AVAILABLE) await notifyRestock(product);
  res.json({ product, message: `${product.name}: ${before} → ${after} ${product.unit}` });
}

// PUT /api/farmer/inventory/:id/threshold  { lowStockThreshold }
export async function setThreshold(req, res) {
  const product = await ownProduct(req);
  const n = toNumber(req.body.lowStockThreshold);
  if (n === undefined || n < 0 || n > 100000) throw new AppError('Alert level must be 0 or more', 400);
  product.lowStockThreshold = Math.floor(n);
  product.lowStockAlertedAt = undefined; // re-check with the new level
  await product.save();
  await checkLowStock([product._id]);
  res.json({ product });
}

// GET /api/farmer/badges  (sidebar counters)
export async function farmerBadges(req, res) {
  const [newOrders, products] = await Promise.all([
    Order.countDocuments({ farmer: req.farmer._id, status: ORDER_STATUS.PLACED }),
    Product.find({ farmer: req.farmer._id, isRemoved: false, status: { $ne: PRODUCT_STATUS.UNAVAILABLE } }).select('quantityAvailable lowStockThreshold').lean(),
  ]);
  res.json({ newOrders, lowStock: products.filter((p) => p.quantityAvailable <= (p.lowStockThreshold ?? 5)).length });
}
