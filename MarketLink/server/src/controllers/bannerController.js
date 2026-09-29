import { Product, SiteBanner } from '../models/index.js';
import { HOME_OFFER_DEFAULTS } from '../models/SiteBanner.js';
import AppError from '../utils/AppError.js';
import { toBool, toNumber } from '../utils/helpers.js';
import { fileUrl } from '../middleware/upload.js';

const TEXT_FIELDS = ['tag', 'tagUr', 'title', 'titleUr', 'text', 'textUr', 'buttonLabel', 'buttonLabelUr', 'link'];

/** The biggest saving farmers really offer this week (null when nobody runs an offer). */
async function liveDeals() {
  const [best] = await Product.aggregate([
    { $match: { ...Product.publicFilter(), quantityAvailable: { $gt: 0 }, $expr: { $gt: ['$compareAtPrice', '$price'] } } },
    { $project: { off: { $round: [{ $multiply: [{ $subtract: [1, { $divide: ['$price', '$compareAtPrice'] }] }, 100] }, 0] } } },
    { $group: { _id: null, maxPercent: { $max: '$off' }, count: { $sum: 1 } } },
  ]);
  return best ? { maxPercent: best.maxPercent, count: best.count } : null;
}

async function homeOffer() {
  const saved = await SiteBanner.findOne({ key: HOME_OFFER_DEFAULTS.key }).lean();
  const banner = { ...HOME_OFFER_DEFAULTS, ...Object.fromEntries(Object.entries(saved || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)) };
  const deals = await liveDeals();
  banner.shownPercent = banner.autoPercent && deals ? deals.maxPercent : banner.percent;
  banner.deals = deals;
  return banner;
}

// GET /api/banners/home-offer  (public)
export async function getHomeOffer(req, res) {
  res.json({ banner: await homeOffer() });
}

// PUT /api/admin/banners/home-offer  (multipart: the text fields, percent, autoPercent, isActive, image)
export async function updateHomeOffer(req, res) {
  const update = {};
  for (const field of TEXT_FIELDS) if (req.body[field] !== undefined) update[field] = String(req.body[field]).trim();
  if (update.link && !/^\/(?!\/)/.test(update.link)) throw new AppError('The button link must be a page on this site, starting with "/"', 400);
  if (req.body.percent !== undefined) {
    const percent = toNumber(req.body.percent);
    if (percent === undefined || percent < 0 || percent > 90) throw new AppError('The percent must be between 0 and 90', 400);
    update.percent = Math.round(percent);
  }
  if (req.body.autoPercent !== undefined) update.autoPercent = toBool(req.body.autoPercent);
  if (req.body.isActive !== undefined) update.isActive = toBool(req.body.isActive);
  if (req.file) update.image = fileUrl('banners', req.file);
  else if (toBool(req.body.resetImage)) update.image = HOME_OFFER_DEFAULTS.image;
  update.updatedBy = req.user._id;
  await SiteBanner.findOneAndUpdate({ key: HOME_OFFER_DEFAULTS.key }, { $set: update }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  res.json({ banner: await homeOffer(), message: 'Offer banner saved' });
}
