import { ORDER_STATUS_META, PRODUCT_STATUS_LABEL, formatDate, formatDateKey, initials, money } from './format';
import { t } from '../i18n';

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const link = (href, text, cls = 'fw-semi') => `<a href="${esc(href)}" data-href="${esc(href)}" class="${cls}">${esc(text)}</a>`;

export function badge(status, label) {
  const raw = label || ORDER_STATUS_META[status]?.label || PRODUCT_STATUS_LABEL[status] || String(status || '');
  return `<span class="status-badge s-${esc(status)}"><span class="dot"></span>${esc(raw.charAt(0).toUpperCase() + raw.slice(1))}</span>`;
}

export const moneyCell = (v) => `<span class="text-nowrap fw-semi">${esc(money(v))}</span>`;
export const dateCell = (v, time = false) => (v ? `<span class="text-nowrap">${esc(formatDate(v, { time }))}</span>` : '<span class="text-muted-2">-</span>');
export const dayCell = (key) => (key ? `<span class="text-nowrap">${esc(formatDateKey(key))}</span>` : '-');
export const muted = (text) => `<span class="fs-7 text-muted-2">${esc(text)}</span>`;

export function person(name, sub, avatar) {
  const pic = avatar ? `<span class="avatar avatar-sm has-photo"><img src="${esc(avatar)}" alt=""></span>` : `<span class="avatar avatar-sm">${esc(initials(name || '?'))}</span>`;
  return `<div class="d-flex align-items-center gap-2">${pic}<div class="min-w-0"><strong class="d-block small text-truncate">${esc(name)}</strong>${sub ? muted(sub) : ''}</div></div>`;
}

export const action = (name, label, cls = 'btn-white', icon = '') =>
  `<button type="button" class="btn btn-sm ${cls}" data-action="${esc(name)}" aria-label="${esc(label || name)}">${icon ? `<i class="bi ${esc(icon)}"></i> ` : ''}${esc(label)}</button>`;

export const display = (fn, plain) => (value, type, row) => {
  if (type === 'display') return fn(value, row);
  const v = plain ? plain(value, row) : value;
  return v ?? '';
};

export function thumbCell(img, title, sub = '', { bg = '', href = '', cls = '' } = {}) {
  const pic = img ? `<img src="${esc(img)}" alt="" class="${cls}">` : '<i class="bi bi-image"></i>';
  const name = href ? link(href, title, 'fw-semi small d-block') : `<strong class="small d-block">${esc(title)}</strong>`;
  return `<div class="d-flex align-items-center gap-2"><span class="thumb-sm" style="${bg ? `background:${esc(bg)}` : ''}">${pic}</span><div class="min-w-0">${name}${sub ? `<span class="fs-7 text-muted-2">${sub}</span>` : ''}</div></div>`;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_TITLES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const dayDotsCell = (days = []) =>
  `<span class="day-dots" aria-label="Open on ${esc(days.map((d) => DAY_TITLES[d]).join(', ') || t('no days'))}">${DAY_LETTERS.map((l, i) => `<span class="d ${days.includes(i) ? 'on' : ''}" title="${DAY_TITLES[i]}">${l}</span>`).join('')}</span>`;

export const numberInput = (field, value, label, disabled = false) =>
  `<input type="number" min="0" class="form-control form-control-sm dt-input" style="width:84px" data-edit="${esc(field)}" value="${esc(value)}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}>`;

export const selectInput = (field, value, options, label, disabled = false) =>
  `<select class="form-select form-select-sm dt-input" style="width:140px" data-edit="${esc(field)}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}>${options
    .map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`)
    .join('')}</select>`;

export const iconAction = (name, label, icon, cls = 'btn-white', disabled = false) =>
  `<button type="button" class="btn btn-sm ${cls} btn-icon" data-action="${esc(name)}" aria-label="${esc(label)}" title="${esc(label)}"${disabled ? ' disabled' : ''}><i class="bi ${esc(icon)}"></i></button>`;

export const linkButton = (href, label, cls = 'btn-white', icon = '') => `<a href="${esc(href)}" data-href="${esc(href)}" class="btn btn-sm ${cls}">${icon ? `<i class="bi ${esc(icon)}"></i> ` : ''}${esc(label)}</a>`;
