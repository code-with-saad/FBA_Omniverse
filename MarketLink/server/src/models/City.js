import mongoose from 'mongoose';

// Cities where MarketLink has (or can have) markets. Used by the city dropdowns and filters.
const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'City name is required'], trim: true, maxlength: 60 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    province: { type: String, trim: true, maxlength: 60, default: '' },
    // Centre of the city, used to centre maps when this city is selected
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

citySchema.index({ name: 1 }, { unique: true });
citySchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('City', citySchema);
