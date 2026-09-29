import { Announcement, Category, Faq, Farmer, Market, Product, SiteBanner } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { ROLES } from '../utils/constants.js';
import { isValidId } from '../utils/helpers.js';
import { builtinSchema } from '../services/productSchema.js';
import { writeUrdu } from '../services/urduWriter.js';

const KINDS = ['name', 'product-description', 'farm-bio', 'market-description', 'text'];
const str = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const ids = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).filter(isValidId);

/** English -> Urdu pairs the site already has (FAQs, announcements, banners, categories, products): reused for general texts. */
async function knownPhrases() {
  const [faqs, notes, banners, cats, products] = await Promise.all([
    Faq.find({}).select('question questionUr answer answerUr').lean(),
    Announcement.find({}).select('title titleUr message messageUr').lean(),
    SiteBanner.find({}).lean(),
    Category.find({}).select('name nameUr').lean(),
    Product.find({ nameUr: { $nin: [null, ''] } }).select('name nameUr').limit(500).lean(),
  ]);
  const map = new Map();
  const add = (en, ur) => {
    if (!en || !ur) return;
    map.set(String(en).trim().toLowerCase(), String(ur).trim());
    // single sentences too, when both texts have the same number of sentences
    const a = String(en).split(/(?<=[.!?])\s+/);
    const b = String(ur).split(/(?<=[۔؟!])\s+/);
    if (a.length > 1 && a.length === b.length) a.forEach((s, i) => map.set(s.trim().toLowerCase(), b[i].trim()));
  };
  for (const f of faqs) add(f.question, f.questionUr), add(f.answer, f.answerUr);
  for (const n of notes) add(n.title, n.titleUr), add(n.message, n.messageUr);
  for (const b of banners) for (const k of ['tag', 'title', 'text', 'buttonLabel']) add(b[k], b[`${k}Ur`]);
  for (const c of cats) add(c.name, c.nameUr);
  for (const p of products) add(p.name, p.nameUr);
  return map;
}

// POST /api/ai/urdu  { kind, text, details, variant }   (farmers and admins: "Write in Urdu" next to the Urdu boxes)
export async function writeInUrdu(req, res) {
  const kind = str(req.body.kind, 40);
  if (!KINDS.includes(kind)) throw new AppError('Unknown kind of text', 400);
  const text = str(req.body.text, 2500);
  const d = req.body.details || {};
  const variant = Number(req.body.variant) || 0;
  let details = {};

  if (kind === 'name' && text.length < 2) throw new AppError('Type the English name first', 400);
  if (kind === 'text' && text.length < 2) throw new AppError('Type the English text first', 400);
  if (kind === 'product-description') {
    const name = str(d.name, 100);
    if (name.length < 2) throw new AppError('Type the product name first', 400);
    let farmer = req.user.role === ROLES.FARMER ? await Farmer.findOne({ user: req.user._id }).select('stallName tags').lean() : null;
    if (!farmer && isValidId(d.farmerId)) farmer = await Farmer.findById(d.farmerId).select('stallName tags').lean();
    const category = isValidId(d.category) ? (await Category.findById(d.category).select('name').lean())?.name : str(d.category, 60);
    details = { name, nameUr: str(d.nameUr, 100), category: category || '', unit: str(d.unit, 20), stallName: farmer?.stallName || '', practices: farmer?.tags || [], season: builtinSchema({ name, category: category || '' }).season, variant };
  }
  if (kind === 'farm-bio') {
    const stallName = str(d.stallName, 100);
    if (stallName.length < 2) throw new AppError('Type the stall / farm name first', 400);
    const [cats, markets] = await Promise.all([Category.find({ _id: { $in: ids(d.categories) } }).select('name slug').lean(), Market.find({ _id: { $in: ids(d.markets) } }).select('name').lean()]);
    const tags = Array.isArray(d.tags) ? d.tags : String(d.tags || '').split(',');
    details = { stallName, city: str(d.city, 60), categories: cats.map((c) => c.name), categorySlugs: cats.map((c) => c.slug), practices: tags.map((t) => str(t, 40)).filter(Boolean).slice(0, 6), markets: markets.map((m) => m.name), variant };
  }
  if (kind === 'market-description') {
    const name = str(d.name, 100);
    if (name.length < 2) throw new AppError('Type the market name first', 400);
    details = { name, city: str(d.city, 60), operatingDays: (Array.isArray(d.operatingDays) ? d.operatingDays : []).map(Number).filter((n) => n >= 0 && n <= 6), openTime: str(d.openTime, 5), closeTime: str(d.closeTime, 5) };
  }

  const result = await writeUrdu(kind, text, details, kind === 'text' ? await knownPhrases() : undefined);
  if (!result.text) {
    return res.json({ ...result, message: 'This text could not be written in Urdu automatically. Add an ANTHROPIC_API_KEY on the server for AI translation, or type the Urdu yourself.' });
  }
  res.json({ ...result, message: result.complete ? undefined : 'Some words were kept in English. Please check the Urdu before saving.' });
}
