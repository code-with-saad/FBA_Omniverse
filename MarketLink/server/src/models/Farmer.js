import mongoose from 'mongoose';
import { timeToMinutes, toDateKey } from '../utils/dates.js';

const { Schema } = mongoose;

// A weekly pickup window, e.g. "Saturday 08:00-12:00 at Clifton Farmers Market".
const pickupWindowSchema = new Schema(
  {
    market: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: true }
);

// Farmer (stall) profile. Login details live in the linked User document.
const farmerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    stallName: { type: String, required: [true, 'Stall / business name is required'], trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    contactPerson: { type: String, required: [true, 'Contact person is required'], trim: true },
    phone: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      match: [/^\+?[\d\s()-]{7,20}$/, 'Please enter a valid contact number'],
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    address: { type: String, required: [true, 'Address is required'], trim: true },
    city: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 1200 },
    bioUr: { type: String, trim: true, maxlength: 1500 }, // the same text in Urdu (optional)
    tags: [{ type: String, trim: true }], // farming practices, e.g. "Pesticide-free"
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }], // what the farmer grows / sells
    logo: String,
    coverImage: String,
    coverCredit: { author: String, source: String, license: String }, // photographer of a licensed stock cover photo

    // Location of the stall / pickup point shown on the map
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },

    markets: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
    operatingDays: [{ type: Number, min: 0, max: 6 }], // derived from pickupWindows
    pickupWindows: [pickupWindowSchema],
    slotMinutes: { type: Number, default: 30, min: 10, max: 240 },
    slotCapacity: { type: Number, default: 6, min: 1, max: 100 }, // max orders per slot
    orderCutoffHours: { type: Number, default: 12, min: 0, max: 168 },
    // Dates the farmer is NOT at the market ("closed this week"), e.g. ["2026-10-02"]
    blockedDates: [{ type: String, match: /^\d{4}-\d{2}-\d{2}$/ }],
    // "I'm at the market": the day the farmer checked in at their stall and when (customers see it)
    checkIn: {
      date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
      at: Date,
    },

    // Recurring weekly stock template
    autoApplyTemplate: { type: Boolean, default: true },
    templateLastAppliedWeek: String,

    // Mirror of user.status === 'active' so public queries don't need to join the users collection
    isActive: { type: Boolean, default: false },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

farmerSchema.index({ isActive: 1 });
farmerSchema.index({ markets: 1 });
farmerSchema.index({ operatingDays: 1 });

// Keep derived fields consistent every time the profile is saved.
farmerSchema.pre('save', function syncDerivedFields() {
  const windows = (this.pickupWindows || []).filter((w) => timeToMinutes(w.end) > timeToMinutes(w.start));
  this.pickupWindows = windows;
  this.operatingDays = [...new Set(windows.map((w) => w.day))].sort();
  const windowMarkets = windows.map((w) => String(w.market));
  const all = new Set([...(this.markets || []).map(String), ...windowMarkets]);
  this.markets = [...all];
  // Keep only upcoming closed dates, without duplicates
  const today = toDateKey();
  this.blockedDates = [...new Set(this.blockedDates || [])].filter((d) => d >= today).sort();
  if (this.checkIn?.date && this.blockedDates.includes(this.checkIn.date)) this.checkIn = undefined; // not coming after all
});

export default mongoose.model('Farmer', farmerSchema);
