import { CURRENCY } from '../config';
import { bilingual, isUrdu } from '../i18n';

export const DAY_NAMES = bilingual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ']);
export const DAY_SHORT = bilingual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ']);
export const DAY_LETTER = bilingual(['S', 'M', 'T', 'W', 'T', 'F', 'S'], ['ا', 'پ', 'م', 'ب', 'ج', 'ج', 'ہ']);
export const MONTHS = bilingual(
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر']
);

const comma = () => (isUrdu() ? '، ' : ', ');

export function monthsLabel(months = []) {
  const list = [...new Set(months)].sort((a, b) => a - b);
  if (!list.length || list.length === 12) return isUrdu() ? 'سارا سال' : 'All year';
  if (list.length === 1) return MONTHS[list[0] - 1];
  for (const start of list) {
    const run = list.map((_, i) => ((start - 1 + i) % 12) + 1);
    if (run.every((m) => list.includes(m))) return `${MONTHS[start - 1]} ${isUrdu() ? 'سے' : 'to'} ${MONTHS[run[run.length - 1] - 1]}`;
  }
  return list.map((m) => MONTHS[m - 1]).join(comma());
}

export function offerPercent(product) {
  const was = Number(product?.compareAtPrice);
  const now = Number(product?.price);
  return was > now && now > 0 ? Math.round((1 - now / was) * 100) : 0;
}

export function money(value) {
  const n = Number(value) || 0;
  const amount = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return isUrdu() ? `${amount}\u00a0روپے` : `${CURRENCY}\u00a0${amount}`;
}

export function moneyCompact(value) {
  const n = Number(value) || 0;
  if (n < 100000) return money(Math.round(n));
  return isUrdu() ? `${compactNumber(n)}\u00a0روپے` : `${CURRENCY}\u00a0${compactNumber(n)}`;
}

export function compactNumber(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateKey(key, { withYear = false } = {}) {
  if (!key) return '';
  const d = parseDateKey(key);
  return `${DAY_SHORT[d.getDay()]}${comma()}${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

export function formatDate(value, { time = false } = {}) {
  if (!value) return '';
  const d = new Date(value);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return time ? `${base}${comma()}${formatTime(d)}` : base;
}

function urduPeriod(h) {
  if (h >= 5 && h < 12) return 'صبح';
  if (h >= 12 && h < 15) return 'دوپہر';
  if (h >= 15 && h < 18) return 'سہ پہر';
  if (h >= 18 && h < 20) return 'شام';
  return 'رات';
}

function clock(h, m) {
  const mm = String(m).padStart(2, '0');
  if (isUrdu()) return `${urduPeriod(h)} ${h % 12 || 12}:${mm}`;
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'pm' : 'am'}`;
}

export function formatTime(date) {
  const d = new Date(date);
  return clock(d.getHours(), d.getMinutes());
}

export function time12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return clock(h, m);
}

export function timeAgo(value) {
  const ur = isUrdu();
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return ur ? 'ابھی ابھی' : 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return ur ? `${minutes} منٹ پہلے` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ur ? `${hours} گھنٹے پہلے` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return ur ? `${days} دن پہلے` : `${days}d ago`;
  return formatDate(value);
}

export function timeUntil(value) {
  const ur = isUrdu();
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return ur ? 'ابھی' : 'now';
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) {
    const min = Math.max(1, Math.round(ms / 60000));
    return ur ? `${min} منٹ میں` : `in ${min} min`;
  }
  if (hours < 48) return ur ? `${hours} گھنٹوں میں` : `in ${hours} h`;
  const days = Math.round(hours / 24);
  return ur ? `${days} دن میں` : `in ${days} days`;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export const ORDER_STATUS_META = bilingual(
  {
    placed: { label: 'Placed', icon: 'bi-receipt' },
    accepted: { label: 'Accepted', icon: 'bi-hand-thumbs-up' },
    ready: { label: 'Ready for pickup', icon: 'bi-bag-check' },
    completed: { label: 'Completed', icon: 'bi-check2-circle' },
    declined: { label: 'Declined', icon: 'bi-x-circle' },
    cancelled: { label: 'Cancelled', icon: 'bi-slash-circle' },
  },
  {
    placed: { label: 'دیا گیا', icon: 'bi-receipt' },
    accepted: { label: 'منظور', icon: 'bi-hand-thumbs-up' },
    ready: { label: 'وصولی کے لیے تیار', icon: 'bi-bag-check' },
    completed: { label: 'مکمل', icon: 'bi-check2-circle' },
    declined: { label: 'مسترد', icon: 'bi-x-circle' },
    cancelled: { label: 'منسوخ', icon: 'bi-slash-circle' },
  }
);

export const PRODUCT_STATUS_LABEL = bilingual(
  { available: 'Available', sold_out: 'Sold out', unavailable: 'Unavailable' },
  { available: 'دستیاب', sold_out: 'ختم ہو گیا', unavailable: 'دستیاب نہیں' }
);

const COVERS = [
  'linear-gradient(135deg, #d9efc2 0%, #f7e9b8 100%)',
  'linear-gradient(135deg, #ffe0cf 0%, #fde9b9 100%)',
  'linear-gradient(135deg, #d4ecf7 0%, #e3f3d4 100%)',
  'linear-gradient(135deg, #f6dcea 0%, #fbeccd 100%)',
  'linear-gradient(135deg, #e0e9c2 0%, #cfe7d6 100%)',
  'linear-gradient(135deg, #fbe7c6 0%, #f3d6c4 100%)',
];
const DARK_COVERS = [
  'linear-gradient(135deg, #173b2c 0%, #2e7d4f 100%)',
  'linear-gradient(135deg, #1d3f4a 0%, #2f7d6b 100%)',
  'linear-gradient(135deg, #3b2f17 0%, #9a6b2c 100%)',
  'linear-gradient(135deg, #22381f 0%, #5f8f35 100%)',
  'linear-gradient(135deg, #3a1f2b 0%, #a0485c 100%)',
];

function hash(text = '') {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export const coverFor = (name) => COVERS[hash(name) % COVERS.length];
export const darkCoverFor = (name) => DARK_COVERS[hash(name) % DARK_COVERS.length];

export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function nextOccurrence(days = [], from = new Date()) {
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    if (days.includes(d.getDay())) return { date: d, inDays: i };
  }
  return null;
}

export function googleDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function osmDirectionsUrl(lat, lng) {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=15/${lat}/${lng}`;
}

export function assetUrl(path) {
  if (!path) return '';
  return path;
}
