import { Notification, User } from '../models/index.js';
import { sendMail } from './mailer.js';

/**
 * Creates an in-app notification and (optionally) sends the same message by e-mail.
 * @param {object} user  User document or id
 */
export async function notify(user, { type = 'system', title, message, link }, { email = false } = {}) {
  const userDoc = user?.email ? user : await User.findById(user).select('email name');
  if (!userDoc) return;
  // A notification must never break the action that caused it (placing an order, adjusting stock...)
  try {
    await Notification.create({ user: userDoc._id, type, title, message, link });
  } catch (err) {
    console.error(`[notify] Could not save the "${title}" notification: ${err.message}`);
  }
  if (email) {
    const linkLabel = type === 'order' ? 'View the order' : type === 'account' ? 'Open my account' : 'Open MarketLink';
    await sendMail({ to: userDoc.email, subject: title, message: userDoc.name ? `Hi ${userDoc.name},\n${message}` : message, link, linkLabel });
  }
}

/** Sends the same in-app notification to many users at once. */
export async function notifyMany(userIds, { type = 'system', title, message, link }) {
  const unique = [...new Set(userIds.map(String))];
  if (!unique.length) return 0;
  try {
    await Notification.insertMany(unique.map((user) => ({ user, type, title, message, link })));
  } catch (err) {
    console.error(`[notify] Could not save the "${title}" notifications: ${err.message}`);
    return 0;
  }
  return unique.length;
}
