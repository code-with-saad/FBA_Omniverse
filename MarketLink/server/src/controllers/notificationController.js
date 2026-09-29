import { Notification } from '../models/index.js';
import { assertId, getPagination } from '../utils/helpers.js';

// GET /api/notifications
export async function listNotifications(req, res) {
  const { page, limit, skip } = getPagination(req.query, 10, 50);
  const filter = { user: req.user._id };
  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, read: false }),
  ]);
  res.json({ notifications, total, unread, page, pages: Math.ceil(total / limit) });
}

// GET /api/notifications/unread-count
export async function unreadCount(req, res) {
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
}

// POST /api/notifications/:id/read
export async function markRead(req, res) {
  await Notification.updateOne({ _id: assertId(req.params.id), user: req.user._id }, { read: true });
  res.json({ ok: true });
}

// POST /api/notifications/read-all
export async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
}

// DELETE /api/notifications/:id
export async function deleteNotification(req, res) {
  await Notification.deleteOne({ _id: assertId(req.params.id), user: req.user._id });
  res.json({ ok: true });
}
