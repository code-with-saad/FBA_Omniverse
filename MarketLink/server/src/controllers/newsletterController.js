import { Subscriber } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { assertId, requireFields } from '../utils/helpers.js';
import { sendMail } from '../services/mailer.js';
import env from '../config/env.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = ['home', 'footer', 'checkout'];

function unsubscribeUrl(token) {
  return `${env.appUrl}/unsubscribe?token=${token}`;
}

async function sendWelcome(subscriber) {
  const url = unsubscribeUrl(subscriber.token);
  await sendMail({
    to: subscriber.email,
    subject: 'You are on the weekly harvest list',
    message: `${subscriber.name ? `Hi ${subscriber.name},\n` : ''}Thank you for subscribing. Every week we will send you what is fresh at the markets, seasonal produce and new farmers near you.\n\nNo spam, and you can unsubscribe at any time.`,
    link: '/products',
    linkLabel: "See this week's harvest",
    footerHtml: `You are receiving this e-mail because you subscribed to the MarketLink newsletter. <a href="${url}" style="color:#2e7d4f">Unsubscribe</a>`,
    footerText: `To stop these e-mails, open: ${url}`,
    headers: { 'List-Unsubscribe': `<${url}>` },
  });
}

// POST /api/newsletter  { email, name?, source? }
export async function subscribe(req, res) {
  requireFields(req.body, ['email']);
  const email = String(req.body.email).trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) throw new AppError('Please enter a valid e-mail address', 400);
  const name = req.body.name ? String(req.body.name).trim().slice(0, 80) : undefined;
  const source = SOURCES.includes(req.body.source) ? req.body.source : 'footer';

  const existing = await Subscriber.findOne({ email });
  if (existing?.status === 'subscribed') {
    return res.json({ message: 'You are already subscribed. Look out for our weekly harvest e-mail.', already: true });
  }
  let subscriber = existing;
  if (subscriber) {
    subscriber.status = 'subscribed';
    subscriber.unsubscribedAt = undefined;
    if (name) subscriber.name = name;
    await subscriber.save();
  } else {
    subscriber = await Subscriber.create({ email, name, source });
  }
  await sendWelcome(subscriber);
  res.status(201).json({ message: 'Thank you for subscribing! Please check your inbox.' });
}

// POST /api/newsletter/unsubscribe  { token }
export async function unsubscribe(req, res) {
  requireFields(req.body, ['token']);
  const subscriber = await Subscriber.findOne({ token: String(req.body.token) });
  if (!subscriber) throw new AppError('This unsubscribe link is not valid.', 404);
  if (subscriber.status !== 'unsubscribed') {
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();
  }
  res.json({ message: 'You have been unsubscribed. You will not get the newsletter any more.', email: subscriber.email });
}

// DELETE /api/admin/subscribers/:id
export async function deleteSubscriber(req, res) {
  await Subscriber.deleteOne({ _id: assertId(req.params.id, 'subscriber') });
  res.json({ message: 'Subscriber removed' });
}
