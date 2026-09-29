import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { User, Farmer } from '../models/index.js';
import { mailMode, sendMail } from '../services/mailer.js';
import AppError from '../utils/AppError.js';
import { ROLES, TERMS_VERSION, USER_STATUS } from '../utils/constants.js';
import { pick, requireFields, toBool } from '../utils/helpers.js';
import { readFarmDetails } from './helpers/farmDetails.js';
import { uniqueSlug } from '../utils/slug.js';
import { isoWeekKey } from '../utils/dates.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { fileUrl } from '../middleware/upload.js';
import { UPLOAD_ROOT } from '../utils/paths.js';
import { notifyMany } from '../services/notify.js';
import { resolveCity } from './adminToolsController.js';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

function checkPassword(password) {
  if (!PASSWORD_RULE.test(String(password || ''))) {
    throw new AppError('Password must be at least 8 characters and contain letters and numbers', 400);
  }
}

// Both sign-up forms must tick "I agree to the Terms & Conditions"
function requireTerms(body) {
  if (!toBool(body.acceptTerms)) {
    throw new AppError('Please accept the Terms & Conditions to create an account', 400);
  }
  return { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION };
}

async function buildSession(user) {
  const data = { user: user.toSafeJSON() };
  if (user.role === ROLES.FARMER) {
    data.farmer = await Farmer.findOne({ user: user._id }).select('stallName slug logo').lean();
  }
  return data;
}

async function startSession(req, res, user) {
  user.lastLoginAt = new Date();
  await user.save();
  setAuthCookie(req, res, signToken(user));
  return buildSession(user);
}

// POST /api/auth/register  (customer sign up)
export async function registerCustomer(req, res) {
  requireFields(req.body, ['name', 'email', 'password', 'phone', 'address']);
  checkPassword(req.body.password);
  const terms = requireTerms(req.body);
  const user = await User.create({
    ...pick(req.body, ['name', 'email', 'password', 'phone', 'address', 'city']),
    ...terms,
    role: ROLES.CUSTOMER,
    status: USER_STATUS.ACTIVE,
  });
  res.status(201).json(await startSession(req, res, user));
}

// A readable one-time password for accounts created at checkout, e.g. "Mango4827kq"
function generatePassword() {
  const words = ['Mango', 'Tomato', 'Basket', 'Carrot', 'Harvest', 'Honey', 'Market', 'Garden', 'Orchard', 'Spinach'];
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const pickFrom = (chars, n) => Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `${words[crypto.randomInt(words.length)]}${crypto.randomInt(1000, 10000)}${pickFrom(letters, 3)}`;
}

/**
 * POST /api/auth/quick-account  { firstName, lastName, email, phone, address, city?, acceptTerms }
 * Checkout without an account: creates a customer account, e-mails a generated password and
 * signs the customer in, so the pre-order can be placed straight away.
 */
export async function quickAccount(req, res) {
  requireFields(req.body, ['firstName', 'lastName', 'email', 'phone', 'address']);
  const terms = requireTerms(req.body);
  const email = String(req.body.email).toLowerCase().trim();
  if (await User.exists({ email })) {
    throw new AppError('An account with this e-mail already exists. Please log in to continue with your order.', 409, { exists: true });
  }
  const name = `${String(req.body.firstName).trim()} ${String(req.body.lastName).trim()}`.slice(0, 80);
  const password = generatePassword();
  const city = req.body.city ? await resolveCity(req.body.city) : undefined;
  const user = await User.create({
    name,
    email,
    password,
    phone: req.body.phone,
    address: req.body.address,
    city,
    ...terms,
    role: ROLES.CUSTOMER,
    status: USER_STATUS.ACTIVE,
  });
  const mail = await sendMail({
    to: user.email,
    subject: 'Your account and password',
    message: `Hi ${req.body.firstName},\nWelcome to MarketLink! We created an account for you so you can place your pre-order and follow it.\n\nYour login\nE-mail: ${user.email}\nPassword: ${password}\n\nFor your safety, change this password in Profile & family after you log in.`,
    link: '/login',
    linkLabel: 'Log in to MarketLink',
  });
  await notifyMany([user._id], {
    type: 'account',
    title: 'Welcome to MarketLink',
    message: 'Your account was created at checkout. We e-mailed your password; you can change it in Profile & family.',
    link: '/account/profile',
  });
  const session = await startSession(req, res, user);
  res.status(201).json({ ...session, passwordSent: Boolean(mail), ...(mailMode() === 'console' ? { mailNote: 'E-mail is in console mode: the password was printed in the server terminal.' } : {}) });
}

// POST /api/auth/register-farmer  (farmer / stall sign up, needs admin approval)
export async function registerFarmer(req, res) {
  requireFields(req.body, ['stallName', 'contactPerson', 'phone', 'email', 'address', 'password']);
  checkPassword(req.body.password);
  const terms = requireTerms(req.body);
  const { stallName, contactPerson, phone, email, address, password } = req.body;
  const city = await resolveCity(req.body.city); // must be one of the cities in the dropdown
  // Optional details: bio, practices, what they grow, markets and map pin (validated before creating anything)
  const details = await readFarmDetails(req.body);

  const user = await User.create({
    name: contactPerson,
    email,
    password,
    phone,
    address,
    city,
    ...terms,
    role: ROLES.FARMER,
    status: USER_STATUS.PENDING,
  });
  try {
    await Farmer.create({
      user: user._id,
      stallName,
      slug: await uniqueSlug(Farmer, stallName),
      contactPerson,
      phone,
      email: user.email,
      address,
      city,
      ...details,
      templateLastAppliedWeek: isoWeekKey(), // automatic weekly refresh starts next week
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // keep data consistent if the profile fails validation
    throw err;
  }

  const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
  await notifyMany(
    admins.map((a) => a._id),
    {
      type: 'account',
      title: 'New farmer registration',
      message: `${stallName} (${contactPerson}) registered and is waiting for approval.`,
      link: '/admin/farmers?status=pending',
    }
  );

  res.status(201).json(await startSession(req, res, user));
}

async function verifyCredentials(email, password) {
  requireFields({ email, password }, ['email', 'password']);
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(String(password)))) {
    throw new AppError('Incorrect e-mail or password', 401);
  }
  if (user.status === USER_STATUS.SUSPENDED) throw new AppError('Your account has been suspended. Please contact support', 403);
  if (user.status === USER_STATUS.INACTIVE) throw new AppError('Your account has been deactivated. Please contact support', 403);
  return user;
}

// POST /api/auth/login  (one login for customers, farmers and administrators; the role decides where they go)
export async function login(req, res) {
  const user = await verifyCredentials(req.body.email, req.body.password);
  res.json(await startSession(req, res, user));
}

// POST /api/auth/logout
export function logout(req, res) {
  clearAuthCookie(req, res);
  res.json({ message: 'Logged out' });
}

// GET /api/auth/me  -> { user: null } for visitors who are not logged in
export async function me(req, res) {
  if (!req.user) return res.json({ user: null });
  res.json(await buildSession(req.user));
}

// PUT /api/auth/me
export async function updateMe(req, res) {
  const allowed = pick(req.body, ['name', 'phone', 'address', 'city']);
  for (const key of ['name', 'phone', 'address']) {
    if (key in allowed && !String(allowed[key]).trim()) throw new AppError(`${key} cannot be empty`, 400);
  }
  Object.assign(req.user, allowed);
  await req.user.save();
  res.json(await buildSession(req.user));
}

// Deletes an uploaded profile photo from disk (only files inside uploads/avatars)
async function deleteAvatarFile(url) {
  if (!url || !url.startsWith('/uploads/avatars/')) return;
  await fs.unlink(path.join(UPLOAD_ROOT, 'avatars', path.basename(url))).catch(() => {});
}

// PUT /api/auth/avatar  (multipart, field "avatar")
export async function updateAvatar(req, res) {
  if (!req.file) throw new AppError('Please choose a JPG, PNG or WEBP image', 400);
  const old = req.user.avatar;
  req.user.avatar = fileUrl('avatars', req.file);
  await req.user.save();
  await deleteAvatarFile(old);
  res.json(await buildSession(req.user));
}

// DELETE /api/auth/avatar
export async function removeAvatar(req, res) {
  const old = req.user.avatar;
  req.user.avatar = undefined;
  await req.user.save();
  await deleteAvatarFile(old);
  res.json(await buildSession(req.user));
}

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// POST /api/auth/forgot-password  { email }
// Always answers the same way so nobody can find out which e-mails are registered.
export async function forgotPassword(req, res) {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) throw new AppError('Please enter your e-mail address', 400);
  const user = await User.findOne({ email });
  if (user && ![USER_STATUS.SUSPENDED, USER_STATUS.INACTIVE].includes(user.status)) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordHash = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // valid for 30 minutes
    await user.save();
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      message: `Hi ${user.name},\nWe received a request to reset your MarketLink password. Use the button below within 30 minutes to choose a new one.\nIf you did not ask for this, you can ignore this e-mail - your password stays the same.`,
      link: `${origin}/reset-password/${token}`,
      linkLabel: 'Choose a new password',
    });
  }
  res.json({ message: 'If an account exists for this e-mail, a password reset link has been sent.', emailMode: mailMode() });
}

// POST /api/auth/reset-password  { token, password }
export async function resetPassword(req, res) {
  requireFields(req.body, ['token', 'password']);
  checkPassword(req.body.password);
  const user = await User.findOne({ resetPasswordHash: hashToken(req.body.token), resetPasswordExpires: { $gt: new Date() } }).select(
    '+resetPasswordHash +resetPasswordExpires'
  );
  if (!user) throw new AppError('This reset link is invalid or has expired. Please request a new one', 400);
  user.password = req.body.password;
  user.resetPasswordHash = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ message: 'Your password has been changed. You can now log in.' });
}

// PUT /api/auth/password
export async function changePassword(req, res) {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  checkPassword(req.body.newPassword);
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(String(req.body.currentPassword)))) {
    throw new AppError('Current password is incorrect', 400);
  }
  user.password = req.body.newPassword;
  await user.save();
  res.json({ message: 'Password updated successfully' });
}
