import { Farmer, Product, Review } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { containsRegex, getPagination, isValidId, toNumber } from '../utils/helpers.js';
import { getAvailability } from '../services/slots.js';
import { marketIdsInCity, resolveCategory } from './helpers/category.js';

const PUBLIC_FIELDS =
  'stallName slug logo coverImage bio bioUr tags address city latitude longitude markets operatingDays blockedDates checkIn ratingAvg ratingCount createdAt';

export async function findActiveFarmer(idOrSlug) {
  const filter = isValidId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  const farmer = await Farmer.findOne({ ...filter, isActive: true });
  if (!farmer) throw new AppError('Farmer not found', 404);
  return farmer;
}

// GET /api/farmers?search=&market=&day=&category=&sort=
export async function listFarmers(req, res) {
  const { page, limit, skip } = getPagination(req.query, 12);
  const filter = { isActive: true };
  if (req.query.search) {
    filter.$or = [{ stallName: containsRegex(req.query.search) }, { bio: containsRegex(req.query.search) }, { tags: containsRegex(req.query.search) }];
  }
  if (req.query.market && isValidId(req.query.market)) filter.markets = req.query.market;
  else if (req.query.city) filter.markets = { $in: await marketIdsInCity(req.query.city) }; // location filter
  const day = toNumber(req.query.day);
  if (day !== undefined && day >= 0 && day <= 6) filter.operatingDays = day;
  const rating = toNumber(req.query.rating);
  if (rating >= 1 && rating <= 5) filter.ratingAvg = { $gte: rating };
  if (req.query.practice) filter.tags = containsRegex(req.query.practice);

  if (req.query.category) {
    const category = await resolveCategory(req.query.category);
    const farmerIds = category ? await Product.distinct('farmer', { ...Product.publicFilter(), category: category._id }) : [];
    filter._id = { $in: farmerIds };
  }

  const sort = req.query.sort === 'name' ? { stallName: 1 } : req.query.sort === 'newest' ? { createdAt: -1 } : { ratingAvg: -1, ratingCount: -1 };
  const [farmers, total] = await Promise.all([
    Farmer.find(filter).select(PUBLIC_FIELDS).populate('markets', 'name slug').sort({ ...sort, _id: 1 }).skip(skip).limit(limit).lean(),
    Farmer.countDocuments(filter),
  ]);

  // Number of listed products per farmer (for the cards)
  const productCounts = await Promise.all(
    farmers.map((f) => Product.countDocuments({ ...Product.publicFilter(), farmer: f._id }))
  );
  farmers.forEach((f, i) => {
    f.productCount = productCounts[i];
  });

  res.json({ farmers, total, page, pages: Math.ceil(total / limit) });
}

// GET /api/farmers/:idOrSlug
export async function getFarmer(req, res) {
  const farmer = await findActiveFarmer(req.params.idOrSlug);
  await farmer.populate([
    { path: 'markets', select: 'name slug address latitude longitude openTime closeTime operatingDays' },
    { path: 'pickupWindows.market', select: 'name slug' },
    { path: 'categories', select: 'name slug icon color' },
  ]);
  const [products, reviews] = await Promise.all([
    Product.find({ ...Product.publicFilter(), farmer: farmer._id })
      .populate('category', 'name nameUr slug color')
      .sort({ status: 1, name: 1 })
      .lean(),
    Review.find({ farmer: farmer._id, isRemoved: false })
      .populate('customer', 'name avatar')
      .populate('product', 'name nameUr slug')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);

  const data = farmer.toObject();
  delete data.user;
  delete data.templateLastAppliedWeek;
  const isFavorite = Boolean(req.user?.favoriteFarmers?.some((id) => String(id) === String(farmer._id)));
  res.json({ farmer: data, products, reviews, isFavorite });
}

// GET /api/farmers/:id/availability  -> upcoming pickup dates and slots
export async function getFarmerAvailability(req, res) {
  const farmer = await findActiveFarmer(req.params.idOrSlug);
  await farmer.populate('pickupWindows.market', 'name address latitude longitude');
  const excludeOrderId = isValidId(req.query.excludeOrder) ? req.query.excludeOrder : undefined;
  const dates = await getAvailability(farmer, { days: 14, excludeOrderId });
  res.json({
    farmer: { _id: farmer._id, stallName: farmer.stallName, orderCutoffHours: farmer.orderCutoffHours, slotMinutes: farmer.slotMinutes },
    dates,
  });
}
