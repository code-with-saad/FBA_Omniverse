import { slugify } from './helpers.js';

/** Returns a slug that is not used yet in the given collection ("farm", "farm-2", ...). */
export async function uniqueSlug(Model, text, excludeId) {
  const base = slugify(text) || 'item';
  let slug = base;
  for (let i = 2; ; i += 1) {
    const filter = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
     
    if (!(await Model.exists(filter))) return slug;
    slug = `${base}-${i}`;
  }
}
