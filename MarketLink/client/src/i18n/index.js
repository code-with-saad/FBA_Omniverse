import { createElement } from 'react';
import UR from './ur';
import SERVER_TEMPLATES from './server';

/**
 * Tiny translation layer. English is the source language: `t('Add to basket')` returns the Urdu text
 * from ./ur.js when the site is in Urdu and the English text otherwise (so a missing translation
 * never breaks a page). `{name}` placeholders are filled from the second argument.
 *
 * The language is kept in localStorage and a cookie (so the server sends Urdu page titles too);
 * `?lang=ur` / `?lang=en` in a link switches it. Changing the language re-renders the whole app.
 */

export const LANGS = {
  en: { label: 'English', short: 'EN', dir: 'ltr', htmlLang: 'en' },
  ur: { label: 'اردو', short: 'اردو', dir: 'rtl', htmlLang: 'ur' },
};

const KEY = 'marketlink_lang';

function readInitial() {
  if (typeof window === 'undefined') return 'en';
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (LANGS[fromUrl]) return fromUrl;
    const saved = localStorage.getItem(KEY);
    if (LANGS[saved]) return saved;
  } catch {
    // storage blocked: fall back to the cookie or English
  }
  const cookie = document.cookie.match(/(?:^|; )ml_lang=(en|ur)/);
  return cookie ? cookie[1] : 'en';
}

let current = readInitial();
// A ?lang= link also becomes the saved choice, so the next pages stay in that language
try {
  if (typeof window !== 'undefined' && LANGS[new URLSearchParams(window.location.search).get('lang')]) setStoredLang(current);
} catch {
  // ignore
}
// Pages that always stay in English (the admin area) set this while they are open
let forcedEnglish = false;

export const getLang = () => (forcedEnglish ? 'en' : current);
export const isUrdu = () => getLang() === 'ur';

export function setStoredLang(lang) {
  if (!LANGS[lang]) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // ignore
  }
  document.cookie = `ml_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}

export function setForcedEnglish(value) {
  forcedEnglish = Boolean(value);
}

/** Puts lang / dir on <html> for the language in use. */
export function applyDocumentLang() {
  const lang = getLang();
  const html = document.documentElement;
  html.lang = LANGS[lang].htmlLang;
  html.dir = LANGS[lang].dir;
}

// Missing Urdu texts are collected here (tests read window.__mlMissing)
const missing = new Set();
if (typeof window !== 'undefined') window.__mlMissing = missing;

export function t(text, vars) {
  if (text === undefined || text === null) return '';
  let out = String(text);
  if (getLang() === 'ur') {
    const ur = UR[out];
    if (ur !== undefined) out = ur;
    // (text that is already in Urdu, e.g. a message translated before it reached a toast, is not missing)
    else if (/[a-z]/i.test(out) && !/[\u0600-\u06ff]/.test(out)) missing.add(out);
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  return out;
}

/** Same text in both languages, picked here (for long texts kept next to their component). */
export const pick = (en, ur) => (getLang() === 'ur' && ur ? ur : en);

/**
 * An array (or object) that reads from the English or the Urdu version depending on the language in
 * use, so constants like DAY_NAMES keep working everywhere without changes at the call sites.
 */
export function bilingual(en, ur) {
  return new Proxy(Array.isArray(en) ? [] : {}, {
    get(_, key) {
      const src = getLang() === 'ur' ? ur : en;
      const value = src[key];
      return typeof value === 'function' ? value.bind(src) : value;
    },
    has: (_, key) => key in en,
    ownKeys: () => Reflect.ownKeys(getLang() === 'ur' ? ur : en),
    getOwnPropertyDescriptor: (_, key) => Object.getOwnPropertyDescriptor(getLang() === 'ur' ? ur : en, key),
  });
}

// ---------------------------------------------------------------- content from the database

/** Product name in the language in use (the farmer's Urdu name when there is one). */
export const productName = (p) => (getLang() === 'ur' && p?.nameUr ? p.nameUr : p?.name || '');

const CATEGORY_UR = {
  vegetables: 'سبزیاں',
  fruits: 'پھل',
  'dairy-eggs': 'دودھ اور انڈے',
  'baked-goods': 'بیکری',
  'herbs-greens': 'ہرے پتے اور جڑی بوٹیاں',
  'honey-preserves': 'شہد اور مربے',
  'grains-pulses': 'اناج اور دالیں',
  'flowers-plants': 'پھول اور پودے',
};

/** Category name in the language in use. */
export const categoryName = (c) => (getLang() === 'ur' ? c?.nameUr || CATEGORY_UR[c?.slug] || c?.name || '' : c?.name || '');

const UNIT_UR = { kg: 'کلو', g: 'گرام', ml: 'ملی لیٹر', lb: 'پاؤنڈ', dozen: 'درجن', piece: 'عدد', bunch: 'گٹھی', litre: 'لیٹر', pack: 'پیکٹ', jar: 'جار', loaf: 'ڈبل روٹی', box: 'ڈبہ' };

/** Unit name (kg, dozen, bunch ...) in the language in use. */
export const unitName = (u) => (getLang() === 'ur' ? UNIT_UR[u] || u : u || '');

/** FAQ / announcement text in the language in use (`field` + `field`Ur). */
export const localText = (doc, field) => (getLang() === 'ur' && doc?.[`${field}Ur`] ? doc[`${field}Ur`] : doc?.[field] || '');

/** "a, b and c" style list joined with the comma of the language in use. */
export const listText = (items) => items.filter(Boolean).join(getLang() === 'ur' ? '، ' : ', ');

/**
 * A translated sentence with bold parts: t() plus <b>…</b> in the text becomes <strong>, so a sentence
 * with a highlighted word stays one text (word order differs between English and Urdu).
 */
export function rich(text, vars) {
  return t(text, vars)
    .split(/<b>(.*?)<\/b>/)
    .map((part, i) => (i % 2 ? createElement('strong', { key: i }, part) : part));
}

// The server templates as patterns: "{name}" matches any text (built on first use)
let serverPatterns = null;
function patterns() {
  if (!serverPatterns) {
    serverPatterns = SERVER_TEMPLATES.map((tpl) => {
      const names = [];
      const source = tpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\w+)\\\}/g, (m, name) => {
        names.push(name);
        return '(.+?)';
      });
      return { tpl, names, re: new RegExp(`^${source}$`) };
    });
    // The longest fixed text first, so "... changed the {what}. Please review ..." wins over "... changed the {what}."
    const fixed = (p) => p.tpl.replace(/\{\w+\}/g, '').length;
    serverPatterns.sort((a, b) => fixed(b) - fixed(a));
  }
  return serverPatterns;
}

/**
 * A text written by the server (notification, message or error) in the language in use. Known
 * sentences are translated; names, numbers and dates inside them are kept. Each line is looked at
 * on its own, and unknown text is shown as it is.
 */
export function tServer(text) {
  if (text === undefined || text === null) return '';
  if (getLang() !== 'ur') return String(text);
  return String(text)
    .split('\n')
    .map((line) => {
      if (UR[line] !== undefined) return UR[line];
      for (const p of patterns()) {
        const m = line.match(p.re);
        if (!m) continue;
        const vars = {};
        p.names.forEach((name, i) => {
          vars[name] = UR[m[i + 1]] !== undefined ? UR[m[i + 1]] : m[i + 1];
        });
        return t(p.tpl, vars);
      }
      return line;
    })
    .join('\n');
}
