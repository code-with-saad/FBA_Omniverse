import mongoose from 'mongoose';
import Announcement from '../models/Announcement.js';
import Category from '../models/Category.js';
import Faq from '../models/Faq.js';
import Farmer from '../models/Farmer.js';
import Market from '../models/Market.js';
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import { uniqueSlug } from '../utils/slug.js';
import { ensureProductSchema } from './productSchema.js';
import { faqs as seedFaqs } from '../content/faqs.js';
import { announcements as seedAnnouncements, categories as seedCategories, farmers as seedFarmers, markets as seedMarkets, urduDescriptions } from '../seed/data.js';
import { produceInfo } from './describe.js';

/**
 * Small data fixes that run once at start-up. They only touch documents that still need them,
 * so running them again does nothing.
 */
export async function runMigrations() {
  // Products created before readable URLs existed get a slug from their name
  const missing = await Product.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] })
    .select('name')
    .lean();
  for (const p of missing) {
    await Product.updateOne({ _id: p._id }, { slug: await uniqueSlug(Product, p.name, p._id) });
  }
  if (missing.length) console.log(`[db] Added readable URLs to ${missing.length} product(s)`);

  // Reviews written before "Verified purchase" existed were always tied to a completed order
  const verified = await Review.updateMany({ verified: { $exists: false }, order: { $exists: true, $ne: null } }, { $set: { verified: true } });
  if (verified.modifiedCount) console.log(`[db] Marked ${verified.modifiedCount} older review(s) as verified purchases`);

  // Products created before the AI product schema existed get one from the built-in writer
  const noSchema = await Product.find({ $or: [{ 'aiSchema.summary': { $exists: false } }, { 'aiSchema.summary': '' }] }).limit(500);
  for (const p of noSchema) await ensureProductSchema(p, { background: false });
  if (noSchema.length) console.log(`[db] Wrote the product schema of ${noSchema.length} product(s)`);

  // Databases seeded before the Urdu version get the Urdu texts of the standard categories, FAQs
  // and notices (only where the English text is still the original one and no Urdu text exists)
  let urdu = 0;
  const noUr = { $or: [{ nameUr: { $exists: false } }, { nameUr: '' }] };
  for (const c of seedCategories) urdu += (await Category.updateOne({ name: c.name, ...noUr }, { $set: { nameUr: c.nameUr } })).modifiedCount;
  for (const f of seedFaqs) {
    urdu += (await Faq.updateOne({ question: f.question, $or: [{ questionUr: { $exists: false } }, { questionUr: '' }] }, { $set: { questionUr: f.questionUr, answerUr: f.answerUr } })).modifiedCount;
  }
  for (const a of seedAnnouncements) {
    urdu += (await Announcement.updateOne({ title: a.title, $or: [{ titleUr: { $exists: false } }, { titleUr: '' }] }, { $set: { titleUr: a.titleUr, messageUr: a.messageUr } })).modifiedCount;
  }
  // ... the demo farmers' stories, market descriptions and product descriptions (while unchanged)
  const noText = (field) => ({ $or: [{ [field]: { $exists: false } }, { [field]: '' }] });
  for (const f of seedFarmers) if (f.bioUr) urdu += (await Farmer.updateOne({ stallName: f.stallName, bio: f.bio, ...noText('bioUr') }, { $set: { bioUr: f.bioUr } })).modifiedCount;
  for (const m of seedMarkets) if (m.descriptionUr) urdu += (await Market.updateOne({ name: m.name, description: m.description, ...noText('descriptionUr') }, { $set: { descriptionUr: m.descriptionUr } })).modifiedCount;
  for (const p of seedFarmers.flatMap((f) => f.products || [])) {
    if (urduDescriptions[p.name]) urdu += (await Product.updateMany({ name: p.name, description: p.desc, ...noText('descriptionUr') }, { $set: { descriptionUr: urduDescriptions[p.name] } })).modifiedCount;
  }
  if (urdu) console.log(`[db] Added Urdu texts to ${urdu} record(s) (categories, questions, notices, farmers, markets, products)`);

  // Products whose schema was written before the Urdu tips existed get them from the built-in writer
  const noTips = await Product.find({ 'aiSchema.summary': { $exists: true, $ne: '' }, 'aiSchema.source': { $ne: 'farmer' }, ...noText('aiSchema.usesUr') })
    .populate('category', 'name')
    .select('name category')
    .limit(1000)
    .lean();
  for (const p of noTips) {
    const info = produceInfo(p.name, p.category?.name);
    await Product.updateOne({ _id: p._id }, { $set: { 'aiSchema.usesUr': info.useUr, 'aiSchema.storageUr': info.keepUr } });
  }
  if (noTips.length) console.log(`[db] Added Urdu tips to the product schema of ${noTips.length} product(s)`);
}

// Walks every path of a Mongoose schema, including sub-documents and arrays of sub-documents.
function walkPaths(schema, prefix, visit) {
  schema.eachPath((path, type) => {
    if (type.schema) walkPaths(type.schema, `${prefix}${path}.`, visit);
    else visit(`${prefix}${path}`, type);
  });
}

// The JSON-schema node of a dotted path ("statusHistory.status") inside a collection validator.
function validatorNode(jsonSchema, path) {
  let node = jsonSchema;
  for (const part of path.split('.')) {
    node = node?.properties?.[part] ?? node?.items?.properties?.[part];
    if (!node) return null;
  }
  return node;
}

/**
 * Databases prepared with an older copy of database/marketlink-schema.mongodb.js have validators
 * that do not know the values added later (e.g. the notification type "stock"), so MongoDB would
 * answer "Document failed validation". At start-up every allowed-values list (enum) in the
 * validators is extended with the values the current models use.
 */
export async function syncValidators() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const updated = [];
  for (const info of collections) {
    const jsonSchema = info.options?.validator?.$jsonSchema;
    if (!jsonSchema) continue;
    const model = Object.values(mongoose.models).find((m) => m.collection.collectionName === info.name);
    if (!model) continue;
    let dirty = false;
    // Fields the current model no longer requires (e.g. reviews without an order are allowed now)
    if (Array.isArray(jsonSchema.required)) {
      const keep = jsonSchema.required.filter((field) => !model.schema.path(field) || model.schema.path(field).isRequired);
      if (keep.length !== jsonSchema.required.length) {
        jsonSchema.required = keep;
        dirty = true;
      }
    }
    walkPaths(model.schema, '', (path, type) => {
      const values = type.enumValues?.length ? type.enumValues : type.caster?.enumValues;
      if (!values?.length) return;
      const node = validatorNode(jsonSchema, path);
      const target = node?.enum ? node : node?.items?.enum ? node.items : null;
      if (!target) return;
      const missing = values.filter((v) => !target.enum.includes(v));
      if (missing.length) {
        target.enum = [...target.enum, ...missing];
        dirty = true;
      }
    });
    if (dirty) {
      await db.command({ collMod: info.name, validator: { $jsonSchema: jsonSchema }, validationLevel: info.options.validationLevel || 'moderate' });
      updated.push(info.name);
    }
  }
  if (updated.length) console.log(`[db] Updated the database rules (validators) of: ${updated.join(', ')}`);
  return updated;
}
