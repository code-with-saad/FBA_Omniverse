import mongoose from 'mongoose';
import { PRODUCT_STATUS, UNITS } from '../utils/constants.js';

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true },
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 100 },
    nameUr: { type: String, trim: true, maxlength: 100 }, // Urdu name, shown when the site is in Urdu
    slug: { type: String, trim: true, lowercase: true }, // readable URL: /products/sindhri-mangoes
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    // The usual price when the farmer runs an offer (shown struck through with the % off); empty = no offer
    compareAtPrice: { type: Number, min: [0, 'Price cannot be negative'] },
    offerEndsAt: Date, // optional: the offer ends by itself at this time (the usual price comes back)
    unit: { type: String, enum: UNITS, default: 'kg' },
    quantityAvailable: { type: Number, default: 0, min: [0, 'Quantity cannot be negative'] },
    // How customers may buy it: by weight (grams of a kg product, ml of a litre), the smallest amount
    // (also the step: 250 g, 500 g, 750 g ...) and the most one customer may take per order (0 = no limit)
    sellByWeight: { type: Boolean, default: false },
    minQuantity: { type: Number, default: 1, min: [0.01, 'The smallest amount must be more than 0'] },
    maxPerOrder: { type: Number, default: 0, min: 0 },
    templateQuantity: { type: Number, default: 0, min: 0 }, // weekly recurring stock
    // Inventory: an alert (e-mail + notification) is sent when stock drops to this level
    lowStockThreshold: { type: Number, default: 5, min: 0, max: 100000 },
    lowStockAlertedAt: Date, // set when the alert was sent; cleared again after restocking
    soldOutAlertedAt: Date, // a second alert when the product sells out
    description: { type: String, trim: true, maxlength: 1500 },
    descriptionUr: { type: String, trim: true, maxlength: 1800 }, // the same text in Urdu (optional)
    // Search engine (SEO) details set by the farmer; empty values fall back to the name and description
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 170 },
    keywords: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
      default: [],
    },
    // Product schema (schema.org) details written by AI (Claude or the built-in writer) or by the farmer:
    // an answer-first summary, the season in Pakistan, a storage tip and what it is best for
    aiSchema: {
      summary: { type: String, trim: true, maxlength: 300 },
      season: { type: String, trim: true, maxlength: 80 },
      storage: { type: String, trim: true, maxlength: 200 },
      uses: { type: String, trim: true, maxlength: 200 },
      // What it is best for and how to keep it, in Urdu (the built-in writer / Claude write these too)
      usesUr: { type: String, trim: true, maxlength: 250 },
      storageUr: { type: String, trim: true, maxlength: 250 },
      source: { type: String, enum: ['claude', 'builtin', 'farmer'] },
      generatedAt: Date,
    },
    image: String,
    // Extra photos for the gallery on the product page (the main photo is `image`)
    gallery: [
      {
        url: { type: String, required: true },
        credit: { author: String, source: String, license: String },
      },
    ],
    // Attribution for licensed stock photos (seed data); cleared when the farmer uploads their own image
    imageCredit: {
      author: String,
      source: String,
      license: String,
    },
    status: { type: String, enum: Object.values(PRODUCT_STATUS), default: PRODUCT_STATUS.AVAILABLE },

    // Admin moderation (isRemoved) and farmer deletion of products that have order history
    isRemoved: { type: Boolean, default: false },
    removedReason: String,
    deletedByFarmer: { type: Boolean, default: false },

    // Copied from the farmer profile so products can be filtered by market / day quickly
    markets: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
    days: [{ type: Number, min: 0, max: 6 }],
    farmerActive: { type: Boolean, default: true }, // false while farmer is pending / suspended

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// An offer ends when the price is raised to (or above) the usual price
productSchema.pre('save', function endOffer() {
  if (this.compareAtPrice != null && !(this.compareAtPrice > this.price)) this.compareAtPrice = undefined;
  if (this.compareAtPrice == null && this.offerEndsAt) this.offerEndsAt = undefined;
});

productSchema.index({ slug: 1 });
productSchema.index({ farmer: 1, isRemoved: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ markets: 1 });
productSchema.index({ days: 1 });
productSchema.index({ keywords: 1 });

// Selling out is automatic: when quantity hits zero the product shows as "sold out",
// and when stock is added again it becomes available.
productSchema.pre('save', function syncStockStatus() {
  if (this.quantityAvailable <= 0 && this.status === PRODUCT_STATUS.AVAILABLE) {
    this.status = PRODUCT_STATUS.SOLD_OUT;
  } else if (this.quantityAvailable > 0 && this.status === PRODUCT_STATUS.SOLD_OUT && this.isModified('quantityAvailable')) {
    this.status = PRODUCT_STATUS.AVAILABLE;
  }
});

/** Filter used for every public product listing. */
productSchema.statics.publicFilter = function publicFilter() {
  return { isRemoved: false, farmerActive: true, status: { $ne: PRODUCT_STATUS.UNAVAILABLE } };
};

export default mongoose.model('Product', productSchema);
