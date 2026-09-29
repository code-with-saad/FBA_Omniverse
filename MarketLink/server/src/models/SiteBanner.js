import mongoose from 'mongoose';

/**
 * Banners on the website that the MarketLink team edits from the admin panel (for now the
 * "Up to 30% off" offer banner on the home page, key "home-offer"). Empty Urdu fields fall back to English.
 */
const siteBannerSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    isActive: { type: Boolean, default: true },
    percent: { type: Number, min: 0, max: 90, default: 30 },
    // true: show the biggest real offer farmers run this week instead of the fixed percent
    autoPercent: { type: Boolean, default: false },
    tag: { type: String, trim: true, maxlength: 40 },
    tagUr: { type: String, trim: true, maxlength: 60 },
    title: { type: String, trim: true, maxlength: 90 },
    titleUr: { type: String, trim: true, maxlength: 120 },
    text: { type: String, trim: true, maxlength: 220 },
    textUr: { type: String, trim: true, maxlength: 300 },
    buttonLabel: { type: String, trim: true, maxlength: 30 },
    buttonLabelUr: { type: String, trim: true, maxlength: 40 },
    link: { type: String, trim: true, maxlength: 200 }, // a page on this site, e.g. /products?deals=true
    image: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/** What the home offer banner shows until the admin changes it. "{percent}" is replaced by the number. */
export const HOME_OFFER_DEFAULTS = Object.freeze({
  key: 'home-offer',
  isActive: true,
  percent: 30,
  autoPercent: false,
  tag: "This week's offers",
  tagUr: 'اس ہفتے کی رعایتیں',
  title: 'Up to {percent}% off fresh vegetables',
  titleUr: 'تازہ سبزیوں پر {percent}% تک رعایت',
  text: 'Picked this week by farmers near you. Pre-order now and collect it on market day. Offers end when the stock runs out.',
  textUr: 'اس ہفتے آپ کے قریب کے کسانوں نے توڑی ہیں۔ ابھی پیشگی آرڈر دیں اور مارکیٹ کے دن وصول کریں۔ اسٹاک ختم ہوتے ہی رعایت ختم۔',
  buttonLabel: 'Shop the offers',
  buttonLabelUr: 'رعایتیں دیکھیں',
  link: '/products?deals=true',
  image: '/images/banners/deal-vegetables.webp',
});

export default mongoose.model('SiteBanner', siteBannerSchema);
