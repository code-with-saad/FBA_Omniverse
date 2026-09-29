import { DAY_NAMES, formatTime, time12, toDateKey } from './format';
import { t } from '../i18n';

const minutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
};

export function farmerToday(farmer, marketId) {
  if (!farmer) return { state: 'off', label: '' };
  const now = new Date();
  const day = now.getDay();
  if ((farmer.blockedDates || []).includes(toDateKey(now))) return { state: 'away', label: t('Not at the market today') };
  const windows = (farmer.pickupWindows || []).filter((w) => w.day === day && (!marketId || String(w.market?._id || w.market) === String(marketId)));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const checkedIn = farmer.checkIn?.date === toDateKey(now) && farmer.checkIn.at;
  const hereNow = { state: 'here', checkedIn: true, label: checkedIn ? t('At the market now, checked in at {time}', { time: formatTime(checkedIn) }) : '' };
  if (windows.length) {
    const start = Math.min(...windows.map((w) => minutes(w.start)));
    const end = Math.max(...windows.map((w) => minutes(w.end)));
    const first = windows.find((w) => minutes(w.start) === start);
    const last = windows.find((w) => minutes(w.end) === end);
    if (checkedIn && nowMin <= end) return hereNow;
    if (nowMin < start) return { state: 'later', label: t('At the market today from {time}', { time: time12(first.start) }) };
    if (nowMin <= end) return { state: 'here', label: t('At the market now, until {time}', { time: time12(last.end) }) };
    return { state: 'done', label: t('Was at the market today') };
  }
  if (checkedIn && !marketId) return hereNow;
  if (!marketId && !(farmer.pickupWindows || []).length && (farmer.operatingDays || []).includes(day)) return { state: 'here', label: t('At the market today') };
  const days = marketId ? [...new Set((farmer.pickupWindows || []).filter((w) => String(w.market?._id || w.market) === String(marketId)).map((w) => w.day))] : farmer.operatingDays || [];
  for (let i = 1; i <= 7; i += 1) {
    const d = (day + i) % 7;
    if (days.includes(d)) return { state: 'off', label: i === 1 ? t('At the market tomorrow') : t('Next at the market on {day}', { day: DAY_NAMES[d] }) };
  }
  return { state: 'off', label: '' };
}

export function TodayBadge({ farmer, marketId, className = '' }) {
  const today = farmerToday(farmer, marketId);
  if (!today.label) return null;
  const icon = today.checkedIn ? 'bi-geo-alt-fill' : { here: 'bi-circle-fill', later: 'bi-clock', done: 'bi-check2', away: 'bi-x-circle', off: 'bi-calendar-event' }[today.state];
  return (
    <span className={`today-badge is-${today.state} ${today.checkedIn ? 'is-checked-in' : ''} ${className}`}>
      <i className={`bi ${icon}`} aria-hidden="true" /> {today.label}
    </span>
  );
}
