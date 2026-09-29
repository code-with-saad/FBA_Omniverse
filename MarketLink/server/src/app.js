import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error.js';
import { CLIENT_DIST, UPLOAD_ROOT } from './utils/paths.js';
import { robots, sendPage, siteOrigin, sitemap } from './services/seo.js';
import { llmsFullTxt, llmsTxt } from './services/aeo.js';
import { bumpOnWrite, cached, cacheStatus } from './services/cache.js';

/** Removes keys that start with "$" or contain "." (blocks NoSQL operator injection). */
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) delete value[key];
      else value[key] = sanitize(value[key]);
    }
  }
  return value;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // OpenStreetMap blocks map tiles (HTTP 403) when the browser sends no Referer,
      // so use the browser's normal policy instead of helmet's "no-referrer".
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // OpenStreetMap tiles + uploaded images
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org', 'https://*.basemaps.cartocdn.com'],
          // OSRM is used to draw driving directions on the map
          connectSrc: ["'self'", 'https://router.project-osrm.org', 'https://nominatim.openstreetmap.org'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          frameSrc: ["'self'", 'https://www.openstreetmap.org', 'https://www.google.com', 'https://maps.google.com'],
          // Don't force https for local / LAN demos over plain http
          upgradeInsecureRequests: null,
        },
      },
    })
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use((req, res, next) => {
    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);
    next();
  });

  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: false }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), cache: cacheStatus().store }));
  app.use('/api', bumpOnWrite); // a change empties the cache before its answer goes out
  app.use('/api', routes);
  app.use('/api', notFound);

  // SEO: search engines read these files; AI assistants read llms.txt (a Markdown summary of the site)
  app.get('/robots.txt', robots);
  app.get('/sitemap.xml', cached(600, 'files'), (req, res, next) => sitemap(req, res).catch(next));
  app.get('/llms.txt', cached(600, 'files'), (req, res, next) => llmsTxt(req, res, siteOrigin(req)).catch(next));
  app.get('/llms-full.txt', cached(600, 'files'), (req, res, next) => llmsFullTxt(req, res, siteOrigin(req)).catch(next));

  // In production the Express server also serves the built React app.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(
      express.static(CLIENT_DIST, {
        index: false,
        setHeaders: (res, filePath) => {
          // Files in /assets have a content hash in their name, so they can be cached "forever"
          res.setHeader('Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      })
    );
    // Photos and the video tour can also come straight from client/public (Vite copies the same files into dist),
    // so a packed copy of the app does not need to carry them twice
    const clientPublic = path.resolve(CLIENT_DIST, '..', 'public');
    for (const dir of ['images', 'media']) app.use(`/${dir}`, express.static(path.join(clientPublic, dir), { index: false, maxAge: '1d' }));
    // Every other URL is a page of the React app: index.html with the page's own title, description and structured data
    app.get(/^\/(?!api|uploads).*/, (req, res, next) => sendPage(req, res).catch(next));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
