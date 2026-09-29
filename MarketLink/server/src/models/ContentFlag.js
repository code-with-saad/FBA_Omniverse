import mongoose from 'mongoose';

const { Schema } = mongoose;

// Content moderation: something a user reported (or the system flagged automatically).
export const FLAG_REASONS = ['spam', 'offensive', 'misleading', 'wrong_info', 'other', 'auto_language'];

const contentFlagSchema = new Schema(
  {
    targetType: { type: String, enum: ['review', 'product', 'farmer'], required: true },
    review: { type: Schema.Types.ObjectId, ref: 'Review' },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    farmer: { type: Schema.Types.ObjectId, ref: 'Farmer' },
    reason: { type: String, enum: FLAG_REASONS, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    reporter: { type: Schema.Types.ObjectId, ref: 'User' }, // empty for automatic flags
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    action: { type: String, enum: ['none', 'removed', 'restored', 'suspended'], default: 'none' },
    resolutionNote: { type: String, trim: true, maxlength: 300 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

contentFlagSchema.index({ status: 1, createdAt: -1 });
contentFlagSchema.index({ targetType: 1, review: 1, product: 1, farmer: 1 });

export default mongoose.model('ContentFlag', contentFlagSchema);
