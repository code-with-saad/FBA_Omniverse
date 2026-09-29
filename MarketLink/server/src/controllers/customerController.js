import { Farmer, Market, Notification, Order, Product, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { OPEN_ORDER_STATUSES, ORDER_STATUS, ROLES, USER_STATUS } from '../utils/constants.js';
import { assertId, round2 } from '../utils/helpers.js';
import { notify } from '../services/notify.js';

const LISTS = {
  farmers: { field: 'favoriteFarmers', Model: Farmer, filter: { isActive: true } },
  products: { field: 'favoriteProducts', Model: Product, filter: { isRemoved: false } },
  markets: { field: 'savedMarkets', Model: Market, filter: { isActive: true } },
};

// GET /api/customer/favorites
export async function getFavorites(req, res) {
  const user = await User.findById(req.user._id)
    .populate({ path: 'favoriteFarmers', match: { isActive: true }, select: 'stallName slug logo coverImage bio bioUr ratingAvg ratingCount address operatingDays tags' })
    .populate({
      path: 'favoriteProducts',
      match: { isRemoved: false, farmerActive: true },
      select: 'name nameUr slug price unit image status quantityAvailable ratingAvg ratingCount farmer category',
      populate: [
        { path: 'farmer', select: 'stallName slug' },
        { path: 'category', select: 'name nameUr slug color' },
      ],
    })
    .populate({ path: 'savedMarkets', match: { isActive: true }, select: 'name slug address city latitude longitude operatingDays openTime closeTime image' })
    .lean();
  res.json({
    farmers: user.favoriteFarmers || [],
    products: user.favoriteProducts || [],
    markets: user.savedMarkets || [],
  });
}

// POST /api/customer/favorites/:type/:id  -> toggles a favourite (type = farmers | products | markets)
export async function toggleFavorite(req, res) {
  const config = LISTS[req.params.type];
  if (!config) throw new AppError('Unknown favourite type', 400);
  const id = assertId(req.params.id);
  if (!(await config.Model.exists({ _id: id, ...config.filter }))) throw new AppError('Item not found', 404);

  const list = req.user[config.field];
  const index = list.findIndex((x) => String(x) === id);
  const saved = index === -1;
  if (saved) list.push(id);
  else list.splice(index, 1);
  await req.user.save();
  res.json({ saved, ids: list.map(String) });
}

// GET /api/customer/dashboard
export async function customerDashboard(req, res) {
  const userId = req.user._id;
  const [activeCount, completedOrders, upcoming, notifications] = await Promise.all([
    Order.countDocuments({ customer: userId, status: { $in: OPEN_ORDER_STATUSES } }),
    Order.find({ customer: userId, status: ORDER_STATUS.COMPLETED }).select('totalAmount').lean(),
    Order.find({ customer: userId, status: { $in: OPEN_ORDER_STATUSES } })
      .populate('farmer', 'stallName slug logo')
      .populate('market', 'name address latitude longitude')
      .sort({ pickupAt: 1 })
      .limit(5)
      .lean(),
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Suggestions: favourite products that are in stock, topped up with popular products
  const favIds = req.user.favoriteProducts || [];
  let suggestions = await Product.find({ ...Product.publicFilter(), _id: { $in: favIds }, status: 'available' })
    .populate('farmer', 'stallName slug')
    .populate('category', 'name nameUr slug color')
    .limit(4)
    .lean();
  if (suggestions.length < 4) {
    const more = await Product.find({ ...Product.publicFilter(), status: 'available', _id: { $nin: suggestions.map((s) => s._id) } })
      .populate('farmer', 'stallName slug')
      .populate('category', 'name nameUr slug color')
      .sort({ totalSold: -1 })
      .limit(4 - suggestions.length)
      .lean();
    suggestions = suggestions.concat(more);
  }

  // Favourite farmers with how many products they have in stock this week
  const farmers = await Farmer.find({ _id: { $in: req.user.favoriteFarmers || [] }, isActive: true }).select('stallName slug logo city ratingAvg ratingCount').limit(6).lean();
  const stockCounts = await Product.aggregate([
    { $match: { ...Product.publicFilter(), status: 'available', farmer: { $in: farmers.map((f) => f._id) } } },
    { $group: { _id: '$farmer', n: { $sum: 1 } } },
  ]);
  const inStock = new Map(stockCounts.map((c) => [String(c._id), c.n]));

  res.json({
    stats: {
      activeOrders: activeCount,
      completedOrders: completedOrders.length,
      totalSpent: round2(completedOrders.reduce((s, o) => s + o.totalAmount, 0)),
      favorites: (req.user.favoriteFarmers?.length || 0) + (req.user.favoriteProducts?.length || 0),
      savedMarkets: req.user.savedMarkets?.length || 0,
      favoriteFarmers: req.user.favoriteFarmers?.length || 0,
    },
    upcoming,
    notifications,
    suggestions,
    farmers: farmers.map((f) => ({ ...f, inStock: inStock.get(String(f._id)) || 0 })),
  });
}

// ---------- Optional family (household) sharing ----------

// GET /api/customer/family
export async function getFamily(req, res) {
  if (!req.user.household) return res.json({ household: null, isOwner: false, members: [] });
  const members = await User.find({ household: req.user.household }).select('name email avatar').lean();
  res.json({
    household: req.user.household,
    isOwner: String(req.user.household) === String(req.user._id),
    members: members.map((m) => ({ ...m, isOwner: String(m._id) === String(req.user.household), isMe: String(m._id) === String(req.user._id) })),
  });
}

// POST /api/customer/family  { email }
export async function addFamilyMember(req, res) {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) throw new AppError('Please enter the e-mail of a family member', 400);
  if (req.user.household && String(req.user.household) !== String(req.user._id)) {
    throw new AppError('Only the household owner can add members', 403);
  }
  const member = await User.findOne({ email, role: ROLES.CUSTOMER, status: USER_STATUS.ACTIVE });
  if (!member) throw new AppError('No active customer account found with that e-mail', 404);
  if (String(member._id) === String(req.user._id)) throw new AppError('You are already in your household', 400);
  if (member.household) throw new AppError('This person already belongs to a household', 409);

  const count = await User.countDocuments({ household: req.user._id });
  if (count >= 6) throw new AppError('A household can have up to 6 members', 400);

  req.user.household = req.user._id; // current user becomes the owner
  await req.user.save();
  member.household = req.user._id;
  await member.save();

  await notify(member, {
    type: 'account',
    title: 'You joined a family account',
    message: `${req.user.name} added you to their MarketLink household. You can now see each other's pre-orders.`,
    link: '/account/profile',
  });
  return getFamily(req, res);
}

// DELETE /api/customer/family/:memberId  (owner removes a member, or a member leaves)
export async function removeFamilyMember(req, res) {
  const memberId = assertId(req.params.memberId, 'member');
  const household = req.user.household;
  if (!household) throw new AppError('You are not part of a household', 400);
  const isOwner = String(household) === String(req.user._id);
  const isSelf = memberId === String(req.user._id);
  if (!isOwner && !isSelf) throw new AppError('Only the household owner can remove members', 403);

  if (isOwner && isSelf) {
    // Owner leaves -> the whole household is dissolved
    await User.updateMany({ household }, { $unset: { household: 1 } });
  } else {
    await User.updateOne({ _id: memberId, household }, { $unset: { household: 1 } });
    if ((await User.countDocuments({ household })) <= 1) await User.updateMany({ household }, { $unset: { household: 1 } });
  }
  req.user = await User.findById(req.user._id);
  return getFamily(req, res);
}
