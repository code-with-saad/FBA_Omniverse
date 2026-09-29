import mongoose from 'mongoose';
import AppError from './AppError.js';

/** Escape user input before using it inside a RegExp (prevents ReDoS / regex injection). */
export function escapeRegex(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" filter for a search box. */
export function containsRegex(text) {
  return { $regex: escapeRegex(String(text).trim()), $options: 'i' };
}

export function isValidId(id) {
  return mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(String(id))) === String(id);
}

export function assertId(id, label = 'id') {
  if (!isValidId(id)) throw new AppError(`Invalid ${label}`, 400);
  return String(id);
}

/** Create a URL friendly slug: "Green Acres Farm" -> "green-acres-farm" */
export function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Read ?page=&limit= safely. */
export function getPagination(query, defaultLimit = 12, maxLimit = 60) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function toNumber(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Accepts "1,3,5", ["1","3"] or 1 and returns [1,3,5]. */
export function toNumberList(value) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map(Number).filter((n) => Number.isFinite(n));
}

export function toBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

/** Keep only the listed keys from an object (used to whitelist request bodies). */
export function pick(obj = {}, keys = []) {
  const out = {};
  for (const key of keys) if (obj[key] !== undefined) out[key] = obj[key];
  return out;
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw new AppError(`Please provide: ${missing.join(', ')}`, 400);
}

/** Great-circle distance between two coordinates in kilometres (Haversine formula). */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
