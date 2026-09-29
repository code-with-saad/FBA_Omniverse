import { ContentFlag, Farmer, Order, Product, Review, User } from '../models/index.js';
import { FLAG_REASONS } from '../models/ContentFlag.js';
import { needsModeration } from '../services/moderation.js';
import { ROLES } from '../utils/constants.js';
import AppError from '../utils/AppError.js';
import { ORDER_STATUS, OPEN_ORDER_STATUSES } from '../utils/constants.js';
import { assertId, getPagination, isValidId } from '../utils/helpers.js';
import { refreshRatings } from '../services/ratings.js';
import { notify } from '../services/notify.js';

// GET /api/reviews?product=&farmer=
export async function listReviews(req, res) {
  const { page, limit, skip } = getPagination(req.query, 10, 50);
  const filter = { isRemoved: false };
  if (isValidId(req.query.product)) {
    filter.product = req.query.product;
    filter.type = 'product';
  }
  if (isValidId(req.query.farmer)) filter.farmer = req.query.farmer;
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate('customer', 'name avatar').populate('product', 'name nameUr slug').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
  ]);
  res.json({ reviews, total, page, pages: Math.ceil(total / limit) });
}

// Latest completed order of this customer with the product (or from the farmer) that has no review for it yet.
async function purchaseOf(customerId, { productId, farmerId }) {
  const filter = { customer: customerId, status: ORDER_STATUS.COMPLETED };
  if (productId) filter['items.product'] = productId;
  else filter.farmer = farmerId;
  const [orders, reviewed] = await Promise.all([
    Order.find(filter).sort({ completedAt: -1, createdAt: -1 }).select('_id farmer items orderNumber').limit(50).lean(),
    Review.find({ customer: customerId, type: productId ? 'product' : 'farmer', ...(productId ? { product: productId } : { farmer: farmerId }), order: { $exists: true } }).select('order').lean(),
  ]);
  const done = new Set(reviewed.map((r) => String(r.order)));
  return orders.find((o) => !done.has(String(o._id))) || null;
}

/**
 * POST /api/reviews  { type: 'product'|'farmer', productId? | farmerId?, orderId?, rating, comment }
 * One review per customer per product / stall. When the customer bought it (a completed order)
 * the review is a "Verified purchase"; otherwise it is saved as "Unverified".
 */
export async function createReview(req, res) {
  const type = req.body.type === 'farmer' ? 'farmer' : 'product';
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError('Please choose a rating from 1 to 5 stars', 400);

  let order = null;
  let productId;
  let farmerId;
  if (req.body.orderId) {
    // From the order page: the order must be the customer's and completed
    order = await Order.findOne({ _id: assertId(req.body.orderId, 'order'), customer: req.user._id }).lean();
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== ORDER_STATUS.COMPLETED) throw new AppError('You can review an order after it has been completed', 400);
    farmerId = order.farmer;
    if (type === 'product') {
      productId = assertId(req.body.productId, 'product');
      if (!order.items.some((i) => String(i.product) === productId)) throw new AppError('This product is not part of the order', 400);
    }
  } else if (type === 'product') {
    productId = assertId(req.body.productId, 'product');
    const product = await Product.findOne({ _id: productId, isRemoved: false }).select('farmer').lean();
    if (!product) throw new AppError('Product not found', 404);
    farmerId = product.farmer;
    order = await purchaseOf(req.user._id, { productId });
  } else {
    farmerId = assertId(req.body.farmerId, 'farmer');
    if (!(await Farmer.exists({ _id: farmerId }))) throw new AppError('Farmer not found', 404);
    order = await purchaseOf(req.user._id, { farmerId });
  }

  const comment = req.body.comment ? String(req.body.comment).trim().slice(0, 1000) : undefined;
  const verified = Boolean(order);
  const target = { customer: req.user._id, type, ...(type === 'product' ? { product: productId } : { farmer: farmerId }) };
  if (verified) {
    // Buyers can review each completed order once
    if (await Review.exists({ ...target, order: order._id })) throw new AppError('You have already reviewed this', 409);
  } else if (await Review.exists(target)) {
    // Without a purchase: one review per product / stall
    throw new AppError('You have already reviewed this', 409);
  }
  // Content moderation: reviews with offensive words are held until an admin checks them
  const word = needsModeration(comment);
  const review = await Review.create({
    type,
    product: productId,
    farmer: farmerId,
    customer: req.user._id,
    order: order?._id,
    verified,
    rating,
    comment,
    ...(word ? { isRemoved: true, removedReason: 'Held for moderation' } : {}),
  });
  // A verified review replaces an earlier unverified one of the same customer
  if (verified) await Review.deleteMany({ ...target, verified: { $ne: true }, _id: { $ne: review._id } });
  if (word) {
    await ContentFlag.create({ targetType: 'review', review: review._id, farmer: farmerId, product: productId, reason: 'auto_language', note: `Contains "${word}"` });
    const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
    for (const a of admins) await notify(a._id, { type: 'moderation', title: 'Review held for moderation', message: `A review by ${req.user.name} contains "${word}" and is waiting for a check.`, link: '/admin/moderation' });
    return res.status(201).json({ review, held: true, message: 'Thanks! Your review will appear after a quick check by our team.' });
  }
  await refreshRatings({ productId, farmerId });

  const farmer = await Farmer.findById(farmerId).select('user').lean();
  const productName = productId ? order?.items?.find((i) => String(i.product) === String(productId))?.name || (await Product.findById(productId).select('name').lean())?.name : null;
  if (farmer) {
    await notify(farmer.user, {
      type: 'review',
      title: `New ${rating}-star review${verified ? '' : ' (unverified)'}`,
      message: `${req.user.name} reviewed ${productName || 'your stall'}: "${(review.comment || '').slice(0, 80)}"`,
      link: '/farmer/reviews',
    });
  }
  res.status(201).json({ review, message: verified ? 'Thanks for your review! It shows as a verified purchase.' : 'Thanks for your review! It shows as unverified because you have not bought this on MarketLink yet.' });
}

// Latest completed order of this customer for which the product / farmer has not been reviewed yet.
async function reviewableOrders(customerId) {
  const [orders, reviews] = await Promise.all([
    Order.find({ customer: customerId, status: ORDER_STATUS.COMPLETED }).populate('farmer', 'stallName slug logo').sort({ completedAt: -1, createdAt: -1 }).lean(),
    Review.find({ customer: customerId, verified: true }).select('type product farmer').lean(),
  ]);
  const reviewedProducts = new Set(reviews.filter((r) => r.type === 'product').map((r) => String(r.product)));
  const reviewedFarmers = new Set(reviews.filter((r) => r.type === 'farmer').map((r) => String(r.farmer)));
  const pending = [];
  const seen = new Set();
  for (const o of orders) {
    const fid = String(o.farmer?._id || o.farmer);
    if (!reviewedFarmers.has(fid) && !seen.has(`f${fid}`)) {
      seen.add(`f${fid}`);
      pending.push({ type: 'farmer', orderId: o._id, orderNumber: o.orderNumber, completedAt: o.completedAt || o.updatedAt, farmer: o.farmer });
    }
    for (const i of o.items) {
      const pid = String(i.product);
      if (reviewedProducts.has(pid) || seen.has(`p${pid}`)) continue;
      seen.add(`p${pid}`);
      pending.push({ type: 'product', orderId: o._id, orderNumber: o.orderNumber, completedAt: o.completedAt || o.updatedAt, farmer: o.farmer, product: { _id: i.product, name: i.name, nameUr: i.nameUr, image: i.image, unit: i.unit } });
    }
  }
  return pending;
}

// GET /api/reviews/mine  (customer: things to review + reviews already written)
export async function myReviews(req, res) {
  const [pending, written] = await Promise.all([
    reviewableOrders(req.user._id),
    Review.find({ customer: req.user._id }).populate('product', 'name nameUr slug image').populate('farmer', 'stallName slug logo').sort({ createdAt: -1 }).lean(),
  ]);
  const slugs = await Product.find({ _id: { $in: pending.filter((p) => p.product).map((p) => p.product._id) } }).select('slug').lean();
  const slugOf = new Map(slugs.map((p) => [String(p._id), p.slug]));
  pending.forEach((p) => {
    if (p.product) p.product.slug = slugOf.get(String(p.product._id));
  });
  res.json({ pending, written });
}

// GET /api/reviews/eligible?product=ID | ?farmer=ID
// -> { canReview, verified, orderId?, orderNumber? } or { canReview: false, reason }
export async function reviewEligibility(req, res) {
  if (req.user.role !== ROLES.CUSTOMER) return res.json({ canReview: false, reason: 'Only customers can write reviews.' });
  const productId = isValidId(req.query.product) ? req.query.product : null;
  const farmerId = !productId && isValidId(req.query.farmer) ? req.query.farmer : null;
  if (!productId && !farmerId) throw new AppError('Choose a product or a farmer', 400);
  const target = { customer: req.user._id, ...(productId ? { type: 'product', product: productId } : { type: 'farmer', farmer: farmerId }) };
  const thanks = { canReview: false, reason: 'You have already reviewed this. Thank you!' };
  // On product and stall pages each customer writes one review; a buyer's review is verified.
  // (After more pickups, the order page and "My reviews" still offer a review per order.)
  if (await Review.exists({ ...target, verified: true })) return res.json(thanks);
  const order = await purchaseOf(req.user._id, productId ? { productId } : { farmerId });
  if (order) return res.json({ canReview: true, verified: true, orderId: order._id, orderNumber: order.orderNumber });
  if (await Review.exists(target)) return res.json(thanks);
  res.json({ canReview: true, verified: false });
}

// GET /api/customer/badges  (sidebar counters)
export async function customerBadges(req, res) {
  const [ready, pending] = await Promise.all([Order.countDocuments({ customer: req.user._id, status: ORDER_STATUS.READY }), reviewableOrders(req.user._id)]);
  const open = await Order.countDocuments({ customer: req.user._id, status: { $in: OPEN_ORDER_STATUSES } });
  // The sidebar counter shows recent pickups (last 30 days) that still have something to review
  const recent = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const orders = new Set(pending.filter((p) => new Date(p.completedAt).getTime() >= recent).map((p) => String(p.orderId)));
  res.json({ ready, open, toReview: orders.size });
}

// POST /api/flags  { targetType: review | product | farmer, targetId, reason, note }  (report content)
export async function reportContent(req, res) {
  const targetType = ['review', 'product', 'farmer'].includes(req.body.targetType) ? req.body.targetType : null;
  if (!targetType) throw new AppError('Choose what you are reporting', 400);
  const id = assertId(req.body.targetId, targetType);
  const reason = FLAG_REASONS.includes(req.body.reason) && req.body.reason !== 'auto_language' ? req.body.reason : 'other';
  const target = {};
  if (targetType === 'review') {
    const review = await Review.findById(id).select('product farmer').lean();
    if (!review) throw new AppError('Review not found', 404);
    Object.assign(target, { review: id, product: review.product, farmer: review.farmer });
  } else if (targetType === 'product') {
    const product = await Product.findById(id).select('farmer').lean();
    if (!product) throw new AppError('Product not found', 404);
    Object.assign(target, { product: id, farmer: product.farmer });
  } else {
    if (!(await Farmer.exists({ _id: id }))) throw new AppError('Farmer not found', 404);
    target.farmer = id;
  }
  const key = { targetType, [targetType]: id, reporter: req.user._id, status: 'open' };
  if (await ContentFlag.exists(key)) return res.json({ message: 'You already reported this. Our team will look at it.' });
  await ContentFlag.create({ ...target, targetType, reason, note: req.body.note ? String(req.body.note).trim().slice(0, 500) : undefined, reporter: req.user._id });
  const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
  for (const a of admins) await notify(a._id, { type: 'moderation', title: `New report: ${targetType}`, message: `${req.user.name} reported a ${targetType} (${reason.replace('_', ' ')}).`, link: '/admin/moderation' });
  res.status(201).json({ message: 'Thank you. The MarketLink team will review this.' });
}
