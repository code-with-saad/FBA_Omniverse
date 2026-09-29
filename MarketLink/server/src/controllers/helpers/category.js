import { Category, Market } from '../../models/index.js';
import { escapeRegex, isValidId } from '../../utils/helpers.js';

/** Ids of the active markets in a city (used by the "location" filters). */
export async function marketIdsInCity(city) {
  const markets = await Market.find({ isActive: true, city: { $regex: `^${escapeRegex(String(city).trim())}$`, $options: 'i' } })
    .select('_id')
    .lean();
  return markets.map((m) => m._id);
}

/** Accepts a category id or slug and returns the category (or null). */
export async function resolveCategory(value) {
  if (!value) return null;
  const filter = isValidId(value) ? { _id: value } : { slug: String(value).toLowerCase() };
  return Category.findOne(filter).lean();
}
