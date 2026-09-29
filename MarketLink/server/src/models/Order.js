import mongoose from 'mongoose';
import { ORDER_STATUS } from '../utils/constants.js';

const { Schema } = mongoose;

// Price / name are copied into the order so history stays correct even if the product changes later.
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    nameUr: String, // the Urdu name at order time (shown when the site is in Urdu)
    image: String,
    unit: String,
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0.01 }, // 0.25 = 250 g of a kg product sold by weight
    step: Number, // the smallest amount / step of this product when the order was placed (1 for pieces)
    maxPerOrder: Number, // the most one customer may take per order (0 or empty = no limit)
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusEntrySchema = new Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS) },
    at: { type: Date, default: Date.now },
    by: String, // customer | farmer | admin | system
    note: String,
  },
  { _id: false }
);

// One order = one farmer + one pickup slot. A cart with several farmers creates several orders.
const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    farmer: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true },
    market: { type: Schema.Types.ObjectId, ref: 'Market', required: true }, // pickup point
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, 'Order must contain at least one item'] },
    totalAmount: { type: Number, required: true, min: 0 },
    pickupDate: { type: String, required: true }, // "YYYY-MM-DD"
    pickupSlot: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    pickupAt: { type: Date, required: true },
    cutoffAt: { type: Date, required: true }, // after this the customer can no longer modify / cancel
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PLACED },
    statusHistory: [statusEntrySchema],
    customerNote: { type: String, trim: true, maxlength: 500 },
    // Who entered the pre-order: the customer at checkout or an administrator for them
    placedBy: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    farmerNote: { type: String, trim: true, maxlength: 500 },
    paymentMethod: { type: String, default: 'pay_at_pickup' }, // no online payment by design
    completedAt: Date,
    // After the farmer marks it picked up, the customer confirms whether they really received it
    receipt: {
      status: { type: String, enum: ['received', 'not_received'] },
      note: { type: String, trim: true, maxlength: 500 },
      at: Date,
    },
    // "I did not receive it": the problem stays on the order until it is sorted out. The farmer or the
    // customer can arrange a new pickup, the farmer can say it was collected, and an admin decides.
    issue: {
      status: { type: String, enum: ['open', 'new_pickup', 'disputed', 'resolved'] },
      reason: { type: String, default: 'not_received' },
      note: { type: String, trim: true, maxlength: 500 }, // the customer's words
      openedAt: Date,
      timesReported: { type: Number, default: 0 },
      resolution: { type: String, enum: ['received', 'collected_after_new_pickup', 'cancelled', 'farmer_right'] },
      resolvedAt: Date,
      resolvedBy: String,
      history: [
        {
          _id: false,
          at: { type: Date, default: Date.now },
          by: String, // customer | farmer | admin
          action: String, // reported | new_pickup | collected | received | resolved
          note: String,
        },
      ],
    },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ farmer: 1, status: 1, pickupDate: 1 });
orderSchema.index({ market: 1 });
orderSchema.index({ 'issue.status': 1 });

export default mongoose.model('Order', orderSchema);
