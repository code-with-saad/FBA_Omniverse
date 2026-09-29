import mongoose from 'mongoose';

// "Remind me when it is available" on a sold-out product: a notification and an e-mail when it is back
const restockRequestSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // empty for guests (e-mail only)
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
  },
  { timestamps: true }
);

restockRequestSchema.index({ product: 1, email: 1 }, { unique: true });

export default mongoose.model('RestockRequest', restockRequestSchema);
