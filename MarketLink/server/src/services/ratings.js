import { Review, Product, Farmer } from '../models/index.js';
import { round2 } from '../utils/helpers.js';

function summarise(reviews) {
  const count = reviews.length;
  const avg = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  return { ratingAvg: round2(avg), ratingCount: count };
}

/** Re-calculates the average rating of a product and / or farmer after a review changes. */
export async function refreshRatings({ productId, farmerId }) {
  if (productId) {
    const reviews = await Review.find({ product: productId, type: 'product', isRemoved: false }).select('rating').lean();
    await Product.updateOne({ _id: productId }, summarise(reviews));
  }
  if (farmerId) {
    // A farmer's rating includes both stall reviews and reviews of the farmer's products.
    const reviews = await Review.find({ farmer: farmerId, isRemoved: false }).select('rating').lean();
    await Farmer.updateOne({ _id: farmerId }, summarise(reviews));
  }
}
