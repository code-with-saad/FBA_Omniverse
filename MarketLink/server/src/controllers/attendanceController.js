import AppError from '../utils/AppError.js';
import { addDays, isDateKey, parseDateKey, toDateKey } from '../utils/dates.js';
import { buildAttendance } from '../services/attendance.js';

export { REASON_LABEL } from '../services/attendance.js';

/**
 * GET /api/admin/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&farmer=&market=&status=
 * Every market day of every approved farmer in the range and whether they came (see services/attendance.js).
 */
export async function attendanceReport(req, res) {
  const today = toDateKey();
  const to = isDateKey(String(req.query.to || '')) ? String(req.query.to) : today;
  const from = isDateKey(String(req.query.from || '')) ? String(req.query.from) : toDateKey(addDays(new Date(), -29));
  if (from > to) throw new AppError('"From" must be before "to"', 400);
  if ((parseDateKey(to) - parseDateKey(from)) / 86400000 > 180) throw new AppError('Choose at most 180 days', 400);
  const data = await buildAttendance({ from, to, farmer: req.query.farmer, market: req.query.market });
  const status = String(req.query.status || '');
  res.json(status ? { ...data, rows: data.rows.filter((r) => r.status === status) } : data);
}
