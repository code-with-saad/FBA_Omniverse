import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import AppError from '../utils/AppError.js';
import { UPLOAD_ROOT } from '../utils/paths.js';

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

/**
 * Creates a multer instance that stores images in /uploads/<folder>.
 * Only image types are accepted and the file name is randomised so users cannot
 * overwrite files or upload scripts.
 */
export function imageUpload(folder, maxFiles = 2) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024, files: maxFiles },
    fileFilter: (req, file, cb) => {
      if (ALLOWED[file.mimetype]) cb(null, true);
      else cb(new AppError('Only JPG, PNG, WEBP or GIF images are allowed', 400));
    },
  });
}

/** Public URL for an uploaded file. */
export function fileUrl(folder, file) {
  return file ? `/uploads/${folder}/${file.filename}` : undefined;
}
