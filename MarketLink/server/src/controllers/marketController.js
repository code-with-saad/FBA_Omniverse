import { Category, City, Market, Farmer, Product } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { containsRegex, distanceKm, isValidId, toNumber } from '../utils/helpers.js';

/** Finds a market by slug or id. */
export async function findMarket(idOrSlug, { activeOnly = true } = {}) {
  const filter = isValidId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  if (activeOnly) filter.isActive = true;
  const market = await Market.findOne(filter).populate('categories', 'name nameUr slug color icon').lean();
  if (!market) throw new AppError('Market not found', 404);
  return market;
}

// GET /api/markets?search=&city=&day=&lat=&lng=&radius=
export async function listMarkets(req, res) {
  const { search, city, day } = req.query;
  const filter = { isActive: true };
  if (search) filter.$or = [{ name: containsRegex(search) }, { address: containsRegex(search) }, { city: containsRegex(search) }];
  if (city) filter.city = containsRegex(city);
  const dayNum = toNumber(day);
  if (dayNum !== undefined && dayNum >= 0 && dayNum <= 6) filter.operatingDays = dayNum;
  // Category dropdown: markets where this kind of produce is sold (id or slug)
  if (req.query.category) {
    const category = isValidId(req.query.category) ? { _id: req.query.category } : await Category.findOne({ slug: String(req.query.category) }).select('_id').lean();
    filter.categories = category?._id || null;
  }

  let markets = await Market.find(filter).populate('categories', 'name nameUr slug color icon').sort({ name: 1 }).lean();

  // Number of approved farmers at each market
  const farmers = await Farmer.find({ isActive: true, markets: { $in: markets.map((m) => m._id) } })
    .select('markets')
    .lean();
  const counts = new Map();
  for (const f of farmers) for (const m of f.markets) counts.set(String(m), (counts.get(String(m)) || 0) + 1);
  markets = markets.map((m) => ({ ...m, farmerCount: counts.get(String(m._id)) || 0 }));

  // "Near me": distance from the customer's location, optionally within a radius
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  if (lat !== undefined && lng !== undefined) {
    markets = markets.map((m) => ({ ...m, distanceKm: distanceKm(lat, lng, m.latitude, m.longitude) }));
    const radius = toNumber(req.query.radius);
    if (radius) markets = markets.filter((m) => m.distanceKm <= radius);
    markets.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // City dropdown comes from the cities table
  const cities = await City.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('name').lean();
  res.json({ markets, cities: cities.map((c) => c.name) });
}

// GET /api/markets/:idOrSlug
export async function getMarket(req, res) {
  const market = await findMarket(req.params.idOrSlug);
  const farmers = await Farmer.find({ isActive: true, markets: market._id })
    .select('stallName slug logo coverImage bio bioUr ratingAvg ratingCount operatingDays pickupWindows blockedDates checkIn latitude longitude address tags')
    .sort({ ratingAvg: -1 })
    .lean();

  // Only the pickup windows at this market are relevant on the market page
  for (const f of farmers) f.pickupWindows = f.pickupWindows.filter((w) => String(w.market) === String(market._id));

  const productFilter = { ...Product.publicFilter(), markets: market._id };
  const [products, productCount] = await Promise.all([
    Product.find(productFilter)
      .populate('farmer', 'stallName slug')
      .populate('category', 'name nameUr slug color')
      .sort({ totalSold: -1 })
      .limit(8)
      .lean(),
    Product.countDocuments(productFilter),
  ]);

  const isSaved = Boolean(req.user?.savedMarkets?.some((id) => String(id) === String(market._id)));
  res.json({ market, farmers, products, productCount, isSaved });
}
