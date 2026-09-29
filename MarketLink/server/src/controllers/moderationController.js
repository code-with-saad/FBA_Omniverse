import { ContentFlag, Farmer, Product, Review, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { USER_STATUS } from '../utils/constants.js';
import { assertId } from '../utils/helpers.js';
import { notify } from '../services/notify.js';
import { refreshRatings } from '../services/ratings.js';
import { syncFarmerProducts } from '../services/stock.js';

const targetOf = (flag) => ({ targetType: flag.targetType, [flag.targetType]: flag[flag.targetType] });

/**
 * PATCH /api/admin/moderation/:id  { action: dismiss | remove | restore | suspend, note }
 * Resolves a report: removes (or restores) the review / listing, suspends the stall, or
 * dismisses the report. All open reports about the same content are closed together.
 */
export async function resolveFlag(req, res) {
  const flag = await ContentFlag.findById(assertId(req.params.id, 'report'));
  if (!flag) throw new AppError('Report not found', 404);
  const action = req.body.action;
  const note = req.body.note ? String(req.body.note).trim().slice(0, 300) : '';
  let result = 'none';

  if (action === 'remove' || action === 'restore') {
    const remove = action === 'remove';
    if (flag.targetType === 'review') {
      const review = await Review.findById(flag.review);
      if (!review) throw new AppError('The review no longer exists', 404);
      review.isRemoved = remove;
      review.removedReason = remove ? note || 'Violates review guidelines' : undefined;
      await review.save();
      await refreshRatings({ productId: review.product, farmerId: review.farmer });
      if (!remove) await notify(review.customer, { type: 'review', title: 'Your review is published', message: 'Thanks for waiting - your review passed the check and is now visible.', link: '/account/reviews' });
    } else if (flag.targetType === 'product') {
      const product = await Product.findById(flag.product).populate('farmer', 'user');
      if (!product) throw new AppError('The listing no longer exists', 404);
      product.isRemoved = remove;
      product.removedReason = remove ? note || 'Violates platform guidelines' : undefined;
      await product.save();
      await notify(product.farmer.user, {
        type: 'moderation',
        title: remove ? `Listing removed: ${product.name}` : `Listing restored: ${product.name}`,
        message: remove ? `After a report, an administrator removed "${product.name}". Reason: ${product.removedReason}` : `"${product.name}" is visible again.`,
        link: '/farmer/products',
      });
    } else {
      throw new AppError('Use "suspend" for a farmer report', 400);
    }
    result = remove ? 'removed' : 'restored';
  } else if (action === 'suspend') {
    const farmer = await Farmer.findById(flag.farmer);
    if (!farmer) throw new AppError('Farmer not found', 404);
    await User.updateOne({ _id: farmer.user }, { status: USER_STATUS.SUSPENDED });
    farmer.isActive = false;
    await farmer.save();
    await syncFarmerProducts(farmer, false);
    await notify(farmer.user, { type: 'account', title: 'Your stall has been suspended', message: `${farmer.stallName} was suspended after a report.${note ? ` Reason: ${note}` : ''}`, link: '/farmer' }, { email: true });
    result = 'suspended';
  } else if (action !== 'dismiss') {
    throw new AppError('Unknown action', 400);
  }

  const status = action === 'dismiss' ? 'dismissed' : 'resolved';
  await ContentFlag.updateMany({ ...targetOf(flag), status: 'open' }, { status, action: result, resolutionNote: note, resolvedBy: req.user._id, resolvedAt: new Date() });
  // Also covers a report that was already closed (e.g. restoring content removed earlier)
  Object.assign(flag, { status, action: result, resolutionNote: note, resolvedBy: req.user._id, resolvedAt: new Date() });
  await flag.save();
  res.json({ flag, message: status === 'dismissed' ? 'Report dismissed' : `Done: ${result}` });
}

// GET /api/admin/moderation/summary  (counters above the moderation queue)
export async function moderationSummary(req, res) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [open, held, byType, resolved, removedReviews, removedProducts] = await Promise.all([
    ContentFlag.countDocuments({ status: 'open' }),
    ContentFlag.countDocuments({ status: 'open', reason: 'auto_language' }),
    ContentFlag.aggregate([{ $match: { status: 'open' } }, { $group: { _id: '$targetType', n: { $sum: 1 } } }]),
    ContentFlag.countDocuments({ status: { $ne: 'open' }, resolvedAt: { $gte: since } }),
    Review.countDocuments({ isRemoved: true }),
    Product.countDocuments({ isRemoved: true }),
  ]);
  const types = Object.fromEntries(byType.map((t) => [t._id, t.n]));
  res.json({ open, held, reviews: types.review || 0, products: types.product || 0, farmers: types.farmer || 0, resolved30: resolved, removedReviews, removedProducts });
}
