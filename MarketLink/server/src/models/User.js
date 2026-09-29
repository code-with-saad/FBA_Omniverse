import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, USER_STATUS } from '../utils/constants.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'E-mail is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid e-mail address'],
    },
    // Only the bcrypt hash is stored. select:false keeps it out of normal queries.
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER },
    phone: { type: String, trim: true, match: [/^\+?[\d\s()-]{7,20}$/, 'Please enter a valid contact number'] },
    address: { type: String, trim: true, maxlength: 250 },
    city: { type: String, trim: true, maxlength: 60 },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    avatar: { type: String },

    // Customer-only data
    favoriteFarmers: [{ type: Schema.Types.ObjectId, ref: 'Farmer' }],
    favoriteProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    savedMarkets: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
    // Optional family sharing: members of the same household can see each other's orders.
    household: { type: Schema.Types.ObjectId, ref: 'User' },

    lastLoginAt: Date,
    // Terms & Conditions accepted at sign-up (the version is the "last updated" date of the terms)
    termsAcceptedAt: Date,
    termsVersion: { type: String, trim: true },

    // "Forgot password": only a SHA-256 hash of the one-time token is stored
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

/** Public shape of a user (never includes the password hash). */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject({ virtuals: false });
  delete obj.password;
  delete obj.resetPasswordHash;
  delete obj.resetPasswordExpires;
  delete obj.__v;
  return obj;
};

export default mongoose.model('User', userSchema);
