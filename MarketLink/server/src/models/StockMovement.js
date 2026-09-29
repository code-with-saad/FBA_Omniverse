import mongoose from 'mongoose';

const { Schema } = mongoose;

// Every change to a product's stock, so farmers can see where their stock went (inventory log).
export const MOVEMENT_TYPES = ['initial', 'restock', 'adjustment', 'waste', 'stall_sale', 'correction', 'template', 'order_reserved', 'order_released', 'order_changed'];

const stockMovementSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    productNameUr: String, // the Urdu name at the time (shown when the site is in Urdu)
    unit: String,
    change: { type: Number, required: true }, // + added, - removed
    quantityAfter: { type: Number, required: true, min: 0 },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    reason: { type: String, trim: true, maxlength: 200 },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,
    by: { type: String, enum: ['farmer', 'customer', 'admin', 'system'], default: 'system' },
  },
  { timestamps: true }
);

stockMovementSchema.index({ farmer: 1, createdAt: -1 });
stockMovementSchema.index({ product: 1, createdAt: -1 });

export default mongoose.model('StockMovement', stockMovementSchema);
