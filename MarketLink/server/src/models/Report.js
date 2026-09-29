import mongoose from 'mongoose';

export const REPORT_TYPES = ['platform_overview', 'orders_summary', 'revenue_by_market', 'top_farmers', 'sales_by_category', 'customer_activity', 'inventory_status', 'city_overview', 'reviews_moderation', 'product_performance', 'pickup_times', 'cancellations', 'pickup_problems', 'market_attendance', 'offers', 'farmer_signups', 'demand', 'engagement'];

// A saved snapshot of a generated report so admins can look at it again later.
const reportSchema = new mongoose.Schema(
  {
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportType: { type: String, enum: REPORT_TYPES, required: true },
    title: String,
    from: Date,
    to: Date,
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'generatedAt', updatedAt: false } }
);

export default mongoose.model('Report', reportSchema);
