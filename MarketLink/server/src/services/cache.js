import Redis from 'ioredis';
import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Cache for the public read-only API (categories, markets, farmers, products, stats, FAQs, banners ...),
 * the sitemap / llms.txt files and the admin reports.
 *
 * With REDIS_URL in server/.env the answers are kept in Redis (shared by every server instance); without it,
 * or while Redis cannot be reached, they are kept in this process's memory. Nothing a person does is ever
 * served stale: every change made through the API (a new product, an order, a saved profile, a check-in ...)
 * moves the cache "version" on before the answer is sent, so the next read builds fresh answers.
 * Changes made outside the API (the seed script) are noticed through a stamp in the database.
 */

const PREFIX = 'ml:cache:';
const VERSION_KEY = `${PREFIX}version`;
const MAX_MEMORY_ENTRIES = 500;

let redis = null;
let redisReady = false;
let localVersion = 1;
const memory = new Map(); // key -> { value, expires }
let dataStamp; // the last "data changed" stamp seen in the database

export function initCache() {
  if (!env.redisUrl) {
    console.log('[cache] REDIS_URL not set: caching in memory');
    return;
  }
  redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 4000, retryStrategy: (n) => Math.min(n * 1000, 15000) });
  redis.on('ready', () => {
    redisReady = true;
    console.log('[cache] Redis connected');
  });
  redis.on('error', (err) => {
    if (redisReady) console.warn('[cache] Redis unavailable, caching in memory until it is back:', err.message);
    redisReady = false;
  });
  redis.on('end', () => {
    redisReady = false;
  });
}

export const cacheStatus = () => ({ store: redisReady ? 'redis' : 'memory', entries: redisReady ? undefined : memory.size });

/** The seed script (and other tools that write straight to MongoDB) leave a stamp; a new stamp empties the cache. */
export async function markDataChanged(db = mongoose.connection.db) {
  await db?.collection('meta').updateOne({ _id: 'data-version' }, { $set: { at: new Date() } }, { upsert: true });
  if (env.redisUrl) {
    const client = new Redis(env.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
    try {
      await client.connect();
      await client.incr(VERSION_KEY);
    } catch {
      // Redis not running: the server notices the stamp instead
    } finally {
      client.disconnect();
    }
  }
}

async function checkDataStamp() {
  try {
    const doc = await mongoose.connection.db?.collection('meta').findOne({ _id: 'data-version' });
    const stamp = doc?.at ? new Date(doc.at).getTime() : null;
    if (dataStamp !== undefined && stamp !== dataStamp) await bumpCache();
    dataStamp = stamp;
  } catch {
    // no database yet: nothing to compare
  }
}

async function currentVersion() {
  await checkDataStamp();
  if (redisReady) {
    try {
      return (await redis.get(VERSION_KEY)) || '0';
    } catch {
      // fall through to the memory version
    }
  }
  return `m${localVersion}`;
}

/** Everything cached so far is out of date (called after every change). */
export async function bumpCache() {
  localVersion += 1;
  memory.clear();
  if (redisReady) {
    try {
      await redis.incr(VERSION_KEY);
    } catch {
      // Redis went away; the memory cache was emptied above
    }
  }
}

async function read(key) {
  if (redisReady) {
    try {
      return await redis.get(key);
    } catch {
      return null;
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

async function write(key, value, ttl) {
  if (redisReady) {
    try {
      await redis.set(key, value, 'EX', ttl);
    } catch {
      // not cached this time
    }
    return;
  }
  if (memory.size >= MAX_MEMORY_ENTRIES) memory.delete(memory.keys().next().value);
  memory.set(key, { value, expires: Date.now() + ttl * 1000 });
}

/**
 * Express middleware for GET routes whose answer is the same for everyone: the answer is kept for `ttl`
 * seconds (or until the next change). `scope` separates caches (e.g. "admin"). Adds X-Cache: HIT / MISS.
 */
export function cached(ttl = 60, scope = 'public') {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    let key;
    try {
      key = `${PREFIX}${await currentVersion()}:${scope}:${req.hostname}${req.originalUrl}`;
      const hit = await read(key);
      if (hit) {
        const { type, body } = JSON.parse(hit);
        res.set('X-Cache', 'HIT');
        if (type) res.set('Content-Type', type);
        return res.send(body);
      }
    } catch {
      return next();
    }
    res.set('X-Cache', 'MISS');
    const send = res.send.bind(res);
    let stored = false;
    res.send = (body) => {
      if (!stored && res.statusCode === 200 && (typeof body === 'string' || Buffer.isBuffer(body))) {
        stored = true;
        write(key, JSON.stringify({ type: res.get('Content-Type'), body: String(body) }), ttl);
      }
      return send(body);
    };
    return next();
  };
}

// Writes that do not change what the cached pages show
const NO_CHANGE = /^\/(auth\/(login|logout|forgot-password|reset-password)|assistant|ai\/|contact$|flags$|newsletter)/;

/** API middleware: after a successful change the cache version moves on before the answer goes out. */
export function bumpOnWrite(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || NO_CHANGE.test(req.path)) return next();
  const json = res.json.bind(res);
  let bumped = false;
  res.json = (body) => {
    if (bumped || res.statusCode >= 400) return json(body);
    bumped = true;
    bumpCache().finally(() => json(body));
    return res;
  };
  // answers that are not JSON (e.g. 204) still empty the cache
  res.on('finish', () => {
    if (!bumped && res.statusCode < 400) bumpCache();
  });
  return next();
}
