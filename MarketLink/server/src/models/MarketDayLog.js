import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ABSENCE_REASONS = ['sick', 'transport', 'weather', 'harvest', 'family', 'other', 'closed_date'];

// One line per farmer and market day: "I'm at the market" (here) or "I cannot come" (away, with the reason).
// A market day without a line had no check-in. The admin's attendance report is built from these.
const marketDayLogSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['here', 'away'], required: true },
    reason: { type: String, enum: ABSENCE_REASONS },
    note: { type: String, trim: true, maxlength: 300 },
    at: { type: Date, default: Date.now }, // when the farmer said it
    ordersAffected: { type: Number, default: 0 }, // pickups booked that day when the farmer said they cannot come
  },
  { timestamps: true }
);

marketDayLogSchema.index({ farmer: 1, date: 1 }, { unique: true });
marketDayLogSchema.index({ date: 1, status: 1 });

export default mongoose.model('MarketDayLog', marketDayLogSchema);
