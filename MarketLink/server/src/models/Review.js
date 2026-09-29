import mongoose from 'mongoose';

const { Schema } = mongoose;

// A review is either about a single product or about the farmer (stall) in general.
// "Verified purchase" = the customer bought it: the review is tied to one of their completed orders.
// Customers can also review without buying; those reviews show as "Unverified".
const reviewSchema = new Schema(
  {
    type: { type: String, enum: ['product', 'farmer'], required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    farmer: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    verified: { type: Boolean, default: false },
    rating: { type: Number, required: [true, 'Rating is required'], min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    response: {
      text: { type: String, trim: true, maxlength: 1000 },
      at: Date,
    },
    isRemoved: { type: Boolean, default: false },
    removedReason: String,
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, isRemoved: 1 });
reviewSchema.index({ farmer: 1, isRemoved: 1 });
reviewSchema.index({ customer: 1, order: 1 });

export default mongoose.model('Review', reviewSchema);
