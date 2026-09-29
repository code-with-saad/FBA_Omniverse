/**
 * Exports every collection to /database/sample-data/<collection>.json
 * (the demo / test data used in the project).  Usage:  npm run export-data
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import * as models from '../models/index.js';
import { SERVER_ROOT } from '../utils/paths.js';

const outDir = path.resolve(SERVER_ROOT, '..', 'database', 'sample-data');

async function main() {
  await connectDB();
  fs.mkdirSync(outDir, { recursive: true });
  for (const Model of Object.values(models)) {
    const docs = await Model.find().lean();
    if (Model.modelName === 'User') {
      docs.forEach((d) => {
        d.password = '<bcrypt hash>';
        delete d.resetPasswordHash;
        delete d.resetPasswordExpires;
      });
    }
    // Unsubscribe links are secret, so the tokens are not exported
    if (Model.modelName === 'Subscriber') docs.forEach((d) => (d.token = '<secret>'));
    const file = path.join(outDir, `${Model.collection.collectionName}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2));
    console.log(`[export] ${Model.collection.collectionName}: ${docs.length} documents`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
