/**
 * Writes the static SEO files into client/public (so they are also there when the React app is
 * hosted on its own, and in `vite dev`):  sitemap.xml, robots.txt, llms.txt and llms-full.txt.
 * The Express server answers the same URLs live from the database; these files are a snapshot.
 *   npm run seo-files            (uses SITE_URL, then APP_URL, then https://marketlink.onrender.com)
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { SERVER_ROOT } from '../utils/paths.js';
import { buildSitemap, robotsText } from '../services/seo.js';
import { llmsFullText, llmsShortText } from '../services/aeo.js';

const origin = (process.env.SITE_URL || process.env.APP_URL || 'https://marketlink.onrender.com').replace(/\/+$/, '');
const publicDir = path.resolve(SERVER_ROOT, '..', 'client', 'public');

async function main() {
  await connectDB();
  const files = {
    'sitemap.xml': await buildSitemap(origin),
    'robots.txt': robotsText(origin),
    'llms.txt': await llmsShortText(origin),
    'llms-full.txt': await llmsFullText(origin),
  };
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(publicDir, name), text);
    console.log(`[seo] client/public/${name} (${text.length} characters)`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
