import mongoose from 'mongoose';
import multer from 'multer';
import env from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Converts every thrown error into a consistent JSON response: { message, details? }
 
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = Object.values(details)[0] || 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || (String(err.message).match(/index: (\w+?)_/) || [])[1] || '';
    message = field === 'email' || /email/.test(err.message) ? 'An account with this e-mail already exists' : `This ${field || 'value'} is already in use`;
  } else if (err?.code === 121) {
    // MongoDB JSON-schema validator (database/marketlink-schema.mongodb.js) rejected the document
    status = 400;
    message = 'The database rejected this change (Document failed validation). Restart the server so it can update the database rules, or run database/marketlink-schema.mongodb.js again.';
    console.error('[db] Document failed validation:', JSON.stringify(err.errInfo?.details || {}).slice(0, 600));
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 2 MB' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  if (status >= 500) console.error('[error]', err);
  const body = { message: status >= 500 && env.isProd ? 'Internal server error' : message };
  if (details) body.details = details;
  res.status(status).json(body);
}
