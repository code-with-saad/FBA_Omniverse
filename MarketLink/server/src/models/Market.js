import mongoose from 'mongoose';

const marketSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Market name is required'], trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1000 },
    descriptionUr: { type: String, trim: true, maxlength: 1200 }, // the same text in Urdu (optional)
    address: { type: String, required: [true, 'Address is required'], trim: true },
    city: { type: String, trim: true, default: '' }, // name of a city from the cities collection
    // What is sold at this market (chosen from the product categories)
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    mapProvider: { type: String, enum: ['openstreetmap', 'google'], default: 'openstreetmap' },
    mapLink: { type: String, trim: true }, // optional embedded / external map link
    operatingDays: [{ type: Number, min: 0, max: 6 }],
    openTime: { type: String, default: '07:00' },
    closeTime: { type: String, default: '13:00' },
    image: { type: String },
    imageCredit: { author: String, source: String, license: String }, // photographer of a licensed stock photo
    isActive: { type: Boolean, default: true },
    liveNoticeDate: String, // the day customers were last told "open today" (YYYY-MM-DD)
  },
  { timestamps: true }
);

marketSchema.index({ isActive: 1, city: 1 });
marketSchema.index({ categories: 1 });

export default mongoose.model('Market', marketSchema);
