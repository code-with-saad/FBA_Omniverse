// Shared constants used across models, controllers and the seed script.

export const ROLES = Object.freeze({ CUSTOMER: 'customer', FARMER: 'farmer', ADMIN: 'admin' });

// Account status. Farmers start as "pending" until an admin approves them.
export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended', // farmer blocked by admin
  INACTIVE: 'inactive', // customer deactivated by admin
});

// Days are stored as numbers so they match JavaScript's Date#getDay() (0 = Sunday).
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const UNITS = ['kg', 'g', 'lb', 'dozen', 'piece', 'bunch', 'litre', 'pack', 'jar', 'loaf', 'box'];

export const PRODUCT_STATUS = Object.freeze({
  AVAILABLE: 'available',
  SOLD_OUT: 'sold_out',
  UNAVAILABLE: 'unavailable', // temporarily hidden by the farmer
});

// Order life-cycle: placed -> accepted -> ready -> completed
// Side exits: declined (by farmer) and cancelled (by customer before cut-off).
export const ORDER_STATUS = Object.freeze({
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  READY: 'ready',
  COMPLETED: 'completed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
});

// Orders that still hold stock / a pickup slot.
export const OPEN_ORDER_STATUSES = [ORDER_STATUS.PLACED, ORDER_STATUS.ACCEPTED, ORDER_STATUS.READY];

export const NOTIFICATION_TYPES = ['order', 'restock', 'stock', 'announcement', 'review', 'account', 'moderation', 'system'];

// Version of the Terms & Conditions (the "last updated" date shown on /terms)
export const TERMS_VERSION = '2026-09-24';
