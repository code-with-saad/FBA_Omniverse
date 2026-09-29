import { escapeRegex } from './helpers.js';

/**
 * Server-side processing for DataTables (https://datatables.net/manual/server-side).
 *
 * The browser sends { draw, start, length, search: { value }, order: [{ column, dir }], columns: [{ data }] }
 * plus our own `filters` object. This helper turns that into a MongoDB query and answers with
 * { draw, recordsTotal, recordsFiltered, data }.
 */

export const MAX_ROWS = 1000; // "All" in the page-length menu is capped here

export function readDataTableRequest(body = {}) {
  const draw = Number.parseInt(body.draw, 10) || 0;
  const start = Math.max(0, Number.parseInt(body.start, 10) || 0);
  let length = Number.parseInt(body.length, 10);
  if (!Number.isFinite(length) || length === 0) length = 10;
  if (length < 0 || length > MAX_ROWS) length = MAX_ROWS;
  const search = String(body.search?.value ?? body.search ?? '')
    .trim()
    .slice(0, 100);
  const columns = Array.isArray(body.columns) ? body.columns : [];
  const order = (Array.isArray(body.order) ? body.order : [])
    .map((o) => ({
      data: o.name || columns[Number(o.column)]?.data,
      dir: String(o.dir).toLowerCase() === 'asc' ? 1 : -1,
    }))
    .filter((o) => typeof o.data === 'string');
  const filters = body.filters && typeof body.filters === 'object' ? body.filters : {};
  return { draw, start, length, search, order, filters };
}

/** Case-insensitive "contains" regex for the search box. */
export const searchRegex = (text) => new RegExp(escapeRegex(text), 'i');

/**
 * Runs a DataTables query against a Mongoose model.
 * @param {object} opts
 * @param {object} opts.req            Express request (body = DataTables request)
 * @param {import('mongoose').Model} opts.Model
 * @param {object} [opts.base]         filter that always applies (recordsTotal counts this)
 * @param {(filters) => object|Promise<object>} [opts.filter]  extra filter from our filter controls
 * @param {(search) => object|Promise<object>} [opts.search]   filter for the search box text
 * @param {object} opts.sortable       { columnData: 'mongo.field' } columns that can be sorted
 * @param {object} [opts.defaultSort]  e.g. { createdAt: -1 }
 * @param {Function} [opts.query]      (mongooseQuery) => mongooseQuery, e.g. to populate
 * @param {Function} [opts.rows]       async (docs) => rows, to add computed columns
 */
export async function dataTableQuery({ req, Model, base = {}, filter, search, sortable = {}, defaultSort = { createdAt: -1 }, query, rows }) {
  const dt = readDataTableRequest(req.body);
  const parts = [base];
  if (filter) parts.push(await filter(dt.filters));
  if (dt.search && search) parts.push(await search(dt.search));
  const where = parts.filter((p) => p && Object.keys(p).length);
  const mongoFilter = where.length > 1 ? { $and: where } : where[0] || {};

  const sort = {};
  for (const o of dt.order) if (sortable[o.data]) sort[sortable[o.data]] = o.dir;
  const finalSort = Object.keys(sort).length ? { ...sort, _id: 1 } : { ...defaultSort, _id: 1 };

  let q = Model.find(mongoFilter).sort(finalSort).skip(dt.start).limit(dt.length).lean();
  if (query) q = query(q);
  const [docs, recordsTotal, recordsFiltered] = await Promise.all([q, Model.countDocuments(base), Model.countDocuments(mongoFilter)]);
  return {
    draw: dt.draw,
    recordsTotal,
    recordsFiltered,
    data: rows ? await rows(docs) : docs,
  };
}

/** Date range filter { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } for a date field. */
export function dateRange(field, from, to) {
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(from || ''))) range.$gte = new Date(`${from}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(to || ''))) range.$lte = new Date(`${to}T23:59:59.999`);
  return Object.keys(range).length ? { [field]: range } : {};
}
