import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    message: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 1000 },
    // The same notice in Urdu (optional; the English text is shown when empty)
    titleUr: { type: String, trim: true, maxlength: 160 },
    messageUr: { type: String, trim: true, maxlength: 1200 },
    audience: { type: String, enum: ['all', 'customer', 'farmer'], default: 'all' },
    // Months (1 = January … 12 = December) in which the banner is shown. Empty means all year,
    // so seasonal notices such as "Mango season is here!" only appear in their own season.
    months: {
      type: [{ type: Number, min: 1, max: 12 }],
      default: [],
    },
    link: { type: String, trim: true, maxlength: 200 }, // optional page on this site, e.g. /products?category=fruits
    isActive: { type: Boolean, default: true }, // shown as a banner on the website
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/** The current month (1-12) in the platform time zone (TZ, Asia/Karachi by default). */
export function currentMonth(date = new Date()) {
  return date.getMonth() + 1;
}

/** Query part that keeps announcements for all year or for the given month. */
export function inSeason(month = currentMonth()) {
  return { $or: [{ months: { $exists: false } }, { months: { $size: 0 } }, { months: month }] };
}

export default mongoose.model('Announcement', announcementSchema);
