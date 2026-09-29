import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { User, Farmer } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { ROLES, USER_STATUS } from '../utils/constants.js';

export const COOKIE_NAME = 'ml_token';

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * The JWT is stored in an httpOnly cookie so JavaScript in the browser cannot read it (XSS protection).
 * The cookie is marked "secure" whenever the site is opened over https (e.g. on the hosting provider).
 */
export function setAuthCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(req, res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: req.secure });
}

function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function loadUser(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.id);
  if (!user) return null;
  // Blocked accounts lose access immediately, even with a valid token.
  if ([USER_STATUS.SUSPENDED, USER_STATUS.INACTIVE].includes(user.status)) return null;
  return user;
}

/** Requires a logged-in user. */
export async function protect(req, res, next) {
  const token = readToken(req);
  if (!token) throw new AppError('Please log in to continue', 401);
  let user;
  try {
    user = await loadUser(token);
  } catch {
    throw new AppError('Your session has expired. Please log in again', 401);
  }
  if (!user) throw new AppError('Your account is not active. Please contact support', 401);
  req.user = user;
  next();
}

/** Attaches req.user when a valid token is present, but never blocks the request. */
export async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = (await loadUser(token)) || undefined;
    } catch {
      req.user = undefined;
    }
  }
  next();
}

/** Role-based access control: authorize('admin'), authorize('farmer', 'admin') ... */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }
    next();
  };
}

/** Loads the farmer profile of the logged-in farmer into req.farmer. */
export async function loadFarmer(req, res, next) {
  if (req.user?.role !== ROLES.FARMER) throw new AppError('Farmer account required', 403);
  const farmer = await Farmer.findOne({ user: req.user._id });
  if (!farmer) throw new AppError('Farmer profile not found', 404);
  req.farmer = farmer;
  next();
}

/** Farmers must be approved by an admin before they can list products or handle orders. */
export function requireApprovedFarmer(req, res, next) {
  if (req.user.status !== USER_STATUS.ACTIVE) {
    throw new AppError('Your stall is awaiting admin approval. You can list products once approved.', 403);
  }
  next();
}
