import { Category, Market } from '../../models/index.js';
import AppError from '../../utils/AppError.js';
import { isValidId, toNumber } from '../../utils/helpers.js';

/** Accepts ["a","b"] or "a, b" and returns a clean list. */
export function toList(value, max = 10) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))].slice(0, max);
}

/**
 * Reads the optional farm details sent at sign-up or from the stall profile:
 * bio, farming practices (tags), categories grown, markets and map location.
 * Only the keys present in the body are returned.
 */
export async function readFarmDetails(body) {
  const data = {};
  if (body.bio !== undefined) data.bio = String(body.bio).trim().slice(0, 1200);
  if (body.bioUr !== undefined) data.bioUr = String(body.bioUr).trim().slice(0, 1500);
  if (body.tags !== undefined) data.tags = toList(body.tags, 8).map((t) => t.slice(0, 40));

  if (body.categories !== undefined) {
    const ids = toList(body.categories, 20).filter(isValidId);
    const found = await Category.find({ _id: { $in: ids }, isActive: true }).select('_id').lean();
    data.categories = found.map((c) => c._id);
  }
  if (body.markets !== undefined) {
    const ids = toList(body.markets, 20).filter(isValidId);
    const found = await Market.find({ _id: { $in: ids }, isActive: true }).select('_id').lean();
    data.markets = found.map((m) => m._id);
  }

  const lat = toNumber(body.latitude);
  const lng = toNumber(body.longitude);
  if (lat !== undefined || lng !== undefined) {
    if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new AppError('Please provide a valid map location (latitude and longitude)', 400);
    }
    data.latitude = lat;
    data.longitude = lng;
  }
  return data;
}
