import crypto from 'node:crypto';
import mongoose from 'mongoose';

// E-mail newsletter: the weekly harvest list, seasonal produce and new markets
const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'E-mail is required'],
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid e-mail address'],
    },
    name: { type: String, trim: true, maxlength: 80 },
    source: { type: String, enum: ['home', 'footer', 'checkout', 'admin'], default: 'footer' }, // where they signed up
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
    // Secret used in the "Unsubscribe" link of every e-mail
    token: { type: String, default: () => crypto.randomBytes(18).toString('hex') },
    unsubscribedAt: Date,
  },
  { timestamps: true }
);

subscriberSchema.index({ email: 1 }, { unique: true });
subscriberSchema.index({ token: 1 });

export default mongoose.model('Subscriber', subscriberSchema);
