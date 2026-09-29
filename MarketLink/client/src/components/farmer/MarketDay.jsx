import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useFetch from '../../hooks/useFetch';
import { TodayBadge } from '../../utils/marketToday';
import { ConfirmModal } from '../common/Modal';
import { formatDateKey, formatTime, time12, toDateKey } from '../../utils/format';
import { t } from '../../i18n';

const DAYS_AHEAD = 14;

// Why the farmer cannot come (the MarketLink team sees it in the attendance report)
export const ABSENCE_REASONS = [
  ['sick', 'Sick or unwell'],
  ['transport', 'Transport problem'],
  ['weather', 'Bad weather'],
  ['harvest', 'Nothing ready to sell'],
  ['family', 'Family matter'],
  ['other', 'Other reason'],
];
const SHOW_DAYS = 6;

/** The farmer's market days from their pickup times: [{ key, windows: [{ market, start, end }] }] for the next two weeks. */
function marketDays(windows = []) {
  const out = [];
  for (let i = 0; i <= DAYS_AHEAD; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const list = windows.filter((w) => w.day === d.getDay()).sort((a, b) => a.start.localeCompare(b.start));
    if (list.length) out.push({ key: toDateKey(d), windows: list });
  }
  return out;
}

const place = (windows) =>
  windows
    .map((w) => `${w.market?.name || t('Market')} · ${time12(w.start)} - ${time12(w.end)}`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

/**
 * "Your market day" on the farmer dashboard. Customers see from the pickup times whether the farmer
 * is at the market; here the farmer can confirm it ("I'm at the market", a check-in) or say they cannot
 * come today or on a coming market day. Customers with a pickup on a day the farmer cannot come are told.
 */
export default function MarketDay() {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const { data, setData } = useFetch('/farmer/me');
  const [asking, setAsking] = useState(null); // date key the farmer wants to close
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [busy, setBusy] = useState('');
  const farmer = data?.farmer;
  const days = useMemo(() => marketDays(farmer?.pickupWindows), [farmer?.pickupWindows]);
  if (!farmer) return <div className="panel market-day is-loading mb-4" aria-hidden="true" />;

  const today = toDateKey();
  const blocked = new Set(farmer.blockedDates || []);
  const todayWindows = days.find((d) => d.key === today)?.windows || [];
  const coming = days.filter((d) => d.key !== today).slice(0, SHOW_DAYS);
  const away = blocked.has(today);
  const checkedIn = !away && farmer.checkIn?.date === today;

  async function save(date, status) {
    setBusy(`${date}:${status}`);
    try {
      const res = await api.post('/farmer/market-day', status === 'away' ? { date, status, reason, note: reasonNote } : { date, status });
      setData((d) => ({ ...d, farmer: { ...d.farmer, blockedDates: res.blockedDates, checkIn: res.checkIn } }));
      setAsking(null);
      setReason('');
      setReasonNote('');
      toast(res.message, status === 'away' ? 'info' : 'success');
      refresh?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }
  const spin = (key, icon) => (busy === key ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className={`bi ${icon}`} aria-hidden="true" />);

  return (
    <section className={`panel market-day mb-4 ${away ? 'is-away' : ''} ${checkedIn ? 'is-here' : ''}`} aria-labelledby="md-title">
      <div className="md-top">
        <div className="md-today">
          <span className="md-eyebrow">
            {t('Today')} · {formatDateKey(today)}
          </span>
          <h2 id="md-title" className="md-title">
            {t('Your market day')}
          </h2>
          {todayWindows.length > 0 ? (
            <p className="md-where">
              <i className="bi bi-shop" aria-hidden="true" /> {place(todayWindows)}
            </p>
          ) : (
            <p className="md-where text-muted-2">
              {coming.length ? t('No market today. Next market day: {date}.', { date: formatDateKey(coming[0].key) }) : t('No market days yet. Add your pickup times first.')}
            </p>
          )}
          <div className="md-sees">
            <span>{t('Customers see:')}</span> <TodayBadge farmer={farmer} />
          </div>
        </div>

        {todayWindows.length > 0 && (
          <div className="md-actions">
            {away ? (
              <>
                <span className="md-state is-away">
                  <i className="bi bi-x-circle-fill" aria-hidden="true" /> {t('You told customers you are not coming today')}
                </span>
                <button type="button" className="btn btn-white" onClick={() => save(today, 'normal')} disabled={Boolean(busy)}>
                  {spin(`${today}:normal`, 'bi-arrow-counterclockwise')} {t('I can come after all')}
                </button>
              </>
            ) : checkedIn ? (
              <>
                <span className="md-state is-here">
                  <i className="bi bi-geo-alt-fill" aria-hidden="true" /> {t('Checked in at {time}', { time: formatTime(farmer.checkIn.at) })}
                </span>
                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-white btn-sm" onClick={() => save(today, 'normal')} disabled={Boolean(busy)}>
                    {spin(`${today}:normal`, 'bi-arrow-counterclockwise')} {t('Undo check-in')}
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setAsking(today)} disabled={Boolean(busy)}>
                    <i className="bi bi-calendar-x" aria-hidden="true" /> {t('I had to leave')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary btn-lg md-checkin" onClick={() => save(today, 'here')} disabled={Boolean(busy)}>
                  {spin(`${today}:here`, 'bi-geo-alt-fill')} {t("I'm at the market")}
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={() => setAsking(today)} disabled={Boolean(busy)}>
                  <i className="bi bi-calendar-x" aria-hidden="true" /> {t('I cannot come to the market today')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {coming.length > 0 && (
        <div className="md-coming">
          <h3 className="md-subtitle">{t('Coming market days')}</h3>
          <ul className="md-days">
            {coming.map((d) => {
              const off = blocked.has(d.key);
              return (
                <li key={d.key} className={off ? 'is-off' : ''}>
                  <div className="min-w-0">
                    <strong>{formatDateKey(d.key)}</strong>
                    <span className="md-day-where">{place(d.windows)}</span>
                  </div>
                  <button
                    type="button"
                    className={`md-toggle ${off ? 'is-off' : ''}`}
                    aria-pressed={!off}
                    aria-label={
                      off
                        ? t('Not coming on {date}. Press if you can come after all.', { date: formatDateKey(d.key) })
                        : t('Coming on {date}. Press if you cannot come.', { date: formatDateKey(d.key) })
                    }
                    onClick={() => (off ? save(d.key, 'normal') : setAsking(d.key))}
                    disabled={Boolean(busy)}
                  >
                    {busy.startsWith(d.key) ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className={`bi ${off ? 'bi-x-lg' : 'bi-check-lg'}`} aria-hidden="true" />}{' '}
                    {off ? t('Not coming') : t('Coming')}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="md-note">
            {t('Customers with a pickup on a day you cannot come get a notification and an e-mail.')} <Link to="/farmer/pickup">{t('Pickup times and closed dates')}</Link>
          </p>
        </div>
      )}

      <ConfirmModal
        open={Boolean(asking)}
        title={asking === today ? t('Not at the market today?') : t('Not coming on {date}?', { date: formatDateKey(asking || today) })}
        message={
          asking === today
            ? t('Customers will see that you are not at the market today, and everyone with a pickup today gets a notification and an e-mail.')
            : t('Customers will see that you are not at the market that day, and everyone with a pickup that day gets a notification and an e-mail.')
        }
        confirmLabel={t('Yes, I cannot come')}
        danger
        busy={Boolean(busy)}
        confirmDisabled={!reason}
        onConfirm={() => save(asking, 'away')}
        onClose={() => setAsking(null)}
      >
        <span className="form-label d-block" id="md-reason-label">
          {t('Why can you not come?')}
        </span>
        <div className="offer-choices md-reasons" role="radiogroup" aria-labelledby="md-reason-label">
          {ABSENCE_REASONS.map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={reason === key} className={`offer-choice ${reason === key ? 'active' : ''}`} onClick={() => setReason(key)}>
              {t(label)}
            </button>
          ))}
        </div>
        <label className="form-label mt-3" htmlFor="md-reason-note">
          {t('A few words for the MarketLink team')} <span className="text-muted-2 fw-normal">{t('(optional)')}</span>
        </label>
        <input id="md-reason-note" className="form-control" maxLength={300} value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder={t('e.g. The truck broke down on the highway')} />
        <p className="small text-muted-2 mt-2 mb-0">{t('Only the MarketLink team sees the reason.')}</p>
      </ConfirmModal>
    </section>
  );
}
