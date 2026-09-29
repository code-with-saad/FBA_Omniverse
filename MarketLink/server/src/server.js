import env from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { startScheduler } from './services/scheduler.js';
import { runMigrations, syncValidators } from './services/migrations.js';
import { verifyMail } from './services/mailer.js';
import { initCache } from './services/cache.js';

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] Could not connect to MongoDB:', err.message);
    console.error('    Check MONGO_URI in server/.env and make sure MongoDB is running.');
    process.exit(1);
  }
  await syncValidators().catch((err) => console.error('[db] Could not update the database validators:', err.message));
  await runMigrations().catch((err) => console.error('[db] Start-up data fix failed:', err.message));
  initCache();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[server] MarketLink API running on http://localhost:${env.port}`);
    verifyMail(); // prints whether e-mails can be sent (never stops the server)
  });
  startScheduler();
}

start();
