import env from '../config/env.js';
import { produceInfo } from './describe.js';
import { CATEGORY_UR, CITY_UR, UNIT_UR } from './urdu.js';

/**
 * "Write in Urdu" for the Urdu boxes next to the English ones (product name and description, category name,
 * farm bio, market description, announcements, FAQs and the offer banner).
 *
 * With ANTHROPIC_API_KEY in server/.env Claude translates the English text into natural Urdu. Without a key
 * (or when Claude cannot be reached) a built-in writer is used:
 *  - names are translated word by word from a produce dictionary, with Urdu word order and grammar
 *    ("Fresh Buffalo Milk" becomes "بھینس کا تازہ دودھ", "Sweet Carrots" becomes "میٹھی گاجریں"),
 *  - product descriptions, farm bios and market descriptions are written in Urdu from the details,
 *  - any other text is matched sentence by sentence against the site's own Urdu texts.
 * `complete: false` means some words could not be translated (they are left in English) and a person should check.
 */

// ------------------------------------------------------------------ dictionary
// Nouns: ur (singular), pl (plural form, when it differs), g (gender: m or f), mod ('ka' = "بکری کا دودھ",
// 'wala' = "تل والے بیگل"), obl (the form before کا / کی, e.g. پھلوں), always ('pl' when the Urdu word is plural)
const NOUNS = {
  mango: { ur: 'آم', g: 'm' },
  tomato: { ur: 'ٹماٹر', g: 'm' },
  carrot: { ur: 'گاجر', pl: 'گاجریں', g: 'f' },
  potato: { ur: 'آلو', g: 'm' },
  'sweet potato': { ur: 'شکر قندی', g: 'f' },
  onion: { ur: 'پیاز', g: 'f' },
  'spring onion': { ur: 'ہری پیاز', g: 'f' },
  cucumber: { ur: 'کھیرا', pl: 'کھیرے', g: 'm' },
  brinjal: { ur: 'بینگن', g: 'm' },
  eggplant: { ur: 'بینگن', g: 'm' },
  aubergine: { ur: 'بینگن', g: 'm' },
  capsicum: { ur: 'شملہ مرچ', pl: 'شملہ مرچیں', g: 'f' },
  'capsicum mix': { ur: 'رنگ برنگی شملہ مرچ', g: 'f' },
  'bell pepper': { ur: 'شملہ مرچ', pl: 'شملہ مرچیں', g: 'f' },
  chilli: { ur: 'مرچ', pl: 'مرچیں', g: 'f' },
  chili: { ur: 'مرچ', pl: 'مرچیں', g: 'f' },
  pepper: { ur: 'مرچ', pl: 'مرچیں', g: 'f' },
  okra: { ur: 'بھنڈی', pl: 'بھنڈیاں', g: 'f' },
  bhindi: { ur: 'بھنڈی', g: 'f' },
  cauliflower: { ur: 'پھول گوبھی', g: 'f' },
  cabbage: { ur: 'بند گوبھی', g: 'f' },
  gourd: { ur: 'لوکی', g: 'f' },
  'bottle gourd': { ur: 'لوکی', g: 'f' },
  'bitter gourd': { ur: 'کریلا', pl: 'کریلے', g: 'm' },
  pumpkin: { ur: 'کدو', g: 'm' },
  radish: { ur: 'مولی', pl: 'مولیاں', g: 'f' },
  turnip: { ur: 'شلجم', g: 'm' },
  beetroot: { ur: 'چقندر', g: 'm' },
  spinach: { ur: 'پالک', g: 'f' },
  palak: { ur: 'پالک', g: 'f' },
  fenugreek: { ur: 'میتھی', g: 'f' },
  methi: { ur: 'میتھی', g: 'f' },
  'mustard greens': { ur: 'سرسوں کا ساگ', g: 'm' },
  saag: { ur: 'ساگ', g: 'm' },
  mint: { ur: 'پودینہ', g: 'm' },
  podina: { ur: 'پودینہ', g: 'm' },
  coriander: { ur: 'دھنیا', g: 'm', lead: 'ہرا' },
  dhania: { ur: 'دھنیا', g: 'm' },
  basil: { ur: 'تلسی', g: 'f' },
  lettuce: { ur: 'سلاد', g: 'm' },
  broccoli: { ur: 'بروکلی', g: 'f' },
  mushroom: { ur: 'مشروم', g: 'm' },
  pea: { ur: 'مٹر', g: 'm' },
  peas: { ur: 'مٹر', g: 'm', always: 'pl' },
  matar: { ur: 'مٹر', g: 'm' },
  corn: { ur: 'مکئی', g: 'f' },
  garlic: { ur: 'لہسن', g: 'm' },
  ginger: { ur: 'ادرک', g: 'f' },
  banana: { ur: 'کیلا', pl: 'کیلے', g: 'm' },
  watermelon: { ur: 'تربوز', g: 'm' },
  melon: { ur: 'خربوزہ', pl: 'خربوزے', g: 'm' },
  'cantaloupe melon': { ur: 'خربوزہ', pl: 'خربوزے', g: 'm' },
  cantaloupe: { ur: 'خربوزہ', pl: 'خربوزے', g: 'm' },
  coconut: { ur: 'ناریل', g: 'm' },
  lemon: { ur: 'لیموں', g: 'm' },
  lime: { ur: 'لیموں', g: 'm' },
  orange: { ur: 'مالٹا', pl: 'مالٹے', g: 'm' },
  kinnow: { ur: 'کینو', g: 'm' },
  'kinnow orange': { ur: 'کینو', g: 'm' },
  apple: { ur: 'سیب', g: 'm' },
  pear: { ur: 'ناشپاتی', g: 'f' },
  peach: { ur: 'آڑو', g: 'm' },
  cherry: { ur: 'چیری', g: 'f' },
  strawberry: { ur: 'اسٹرابیری', g: 'f' },
  kiwi: { ur: 'کیوی', g: 'f' },
  guava: { ur: 'امرود', g: 'm' },
  pomegranate: { ur: 'انار', g: 'm' },
  grape: { ur: 'انگور', g: 'm' },
  apricot: { ur: 'خوبانی', pl: 'خوبانیاں', g: 'f' },
  plum: { ur: 'آلو بخارا', pl: 'آلو بخارے', g: 'm' },
  date: { ur: 'کھجور', pl: 'کھجوریں', g: 'f' },
  papaya: { ur: 'پپیتا', pl: 'پپیتے', g: 'm' },
  fig: { ur: 'انجیر', g: 'm' },
  almond: { ur: 'بادام', g: 'm' },
  walnut: { ur: 'اخروٹ', g: 'm' },
  peanut: { ur: 'مونگ پھلی', g: 'f' },
  milk: { ur: 'دودھ', g: 'm' },
  paneer: { ur: 'پنیر', g: 'm' },
  cheese: { ur: 'پنیر', g: 'm' },
  egg: { ur: 'انڈا', pl: 'انڈے', g: 'm' },
  butter: { ur: 'مکھن', g: 'm', mod: 'wala' },
  ghee: { ur: 'گھی', g: 'm' },
  yogurt: { ur: 'دہی', g: 'm' },
  yoghurt: { ur: 'دہی', g: 'm' },
  dahi: { ur: 'دہی', g: 'm' },
  cream: { ur: 'ملائی', g: 'f' },
  lassi: { ur: 'لسی', g: 'f' },
  bread: { ur: 'ڈبل روٹی', g: 'f' },
  loaf: { ur: 'ڈبل روٹی', g: 'f' },
  sourdough: { ur: 'ساؤر ڈو', g: 'f', variety: true },
  naan: { ur: 'نان', g: 'm' },
  roti: { ur: 'روٹی', pl: 'روٹیاں', g: 'f' },
  paratha: { ur: 'پراٹھا', pl: 'پراٹھے', g: 'm' },
  baguette: { ur: 'باگیٹ', g: 'm' },
  croissant: { ur: 'کروسان', g: 'm' },
  bagel: { ur: 'بیگل', g: 'm' },
  bun: { ur: 'بن', g: 'm' },
  rusk: { ur: 'رس', g: 'm' },
  cake: { ur: 'کیک', g: 'm' },
  cookie: { ur: 'کوکی', pl: 'کوکیز', g: 'f' },
  biscuit: { ur: 'بسکٹ', g: 'm' },
  pie: { ur: 'پائی', g: 'f' },
  honey: { ur: 'شہد', g: 'm' },
  jam: { ur: 'جام', g: 'm' },
  marmalade: { ur: 'مربہ', pl: 'مربے', g: 'm' },
  preserve: { ur: 'مربہ', pl: 'مربے', g: 'm' },
  chutney: { ur: 'چٹنی', g: 'f' },
  pickle: { ur: 'اچار', g: 'm' },
  achar: { ur: 'اچار', g: 'm' },
  olive: { ur: 'زیتون', g: 'm' },
  oil: { ur: 'تیل', g: 'm' },
  vinegar: { ur: 'سرکہ', g: 'm' },
  juice: { ur: 'جوس', g: 'm' },
  atta: { ur: 'آٹا', g: 'm' },
  flour: { ur: 'آٹا', g: 'm' },
  wheat: { ur: 'گندم', g: 'f' },
  'whole wheat': { ur: 'گندم', g: 'f' },
  rice: { ur: 'چاول', g: 'm', always: 'pl' },
  bean: { ur: 'لوبیا', g: 'm' },
  'kidney bean': { ur: 'لوبیا', g: 'm' },
  rajma: { ur: 'راجما', g: 'm' },
  lentil: { ur: 'دال', pl: 'دالیں', g: 'f' },
  daal: { ur: 'دال', g: 'f' },
  dal: { ur: 'دال', g: 'f' },
  chickpea: { ur: 'چنا', pl: 'چنے', g: 'm' },
  chana: { ur: 'چنے', g: 'm', always: 'pl' },
  oat: { ur: 'جئی', g: 'f' },
  chocolate: { ur: 'چاکلیٹ', g: 'f' },
  sesame: { ur: 'تل', g: 'm', mod: 'wala' },
  seed: { ur: 'بیج', g: 'm', mod: 'wala' },
  sugar: { ur: 'چینی', g: 'f' },
  jaggery: { ur: 'گڑ', g: 'm' },
  gur: { ur: 'گڑ', g: 'm' },
  sugarcane: { ur: 'گنا', pl: 'گنے', g: 'm' },
  salt: { ur: 'نمک', g: 'm' },
  tea: { ur: 'چائے', g: 'f' },
  spice: { ur: 'مصالحہ', pl: 'مصالحے', g: 'm' },
  nut: { ur: 'گری دار میوہ', pl: 'گری دار میوے', g: 'm' },
  'dry fruit': { ur: 'خشک میوہ', pl: 'خشک میوہ جات', g: 'm' },
  chicken: { ur: 'مرغی', g: 'f' },
  rose: { ur: 'گلاب', g: 'm' },
  tulip: { ur: 'ٹیولپ', g: 'm' },
  sunflower: { ur: 'سورج مکھی', g: 'f' },
  lily: { ur: 'للی', g: 'f' },
  orchid: { ur: 'آرکڈ', g: 'm' },
  jasmine: { ur: 'چنبیلی', g: 'f' },
  cactus: { ur: 'کیکٹس', g: 'm' },
  hibiscus: { ur: 'گڑہل', g: 'm' },
  'money plant': { ur: 'منی پلانٹ', g: 'm' },
  plant: { ur: 'پودا', pl: 'پودے', g: 'm' },
  flower: { ur: 'پھول', g: 'm' },
  bouquet: { ur: 'گلدستہ', pl: 'گلدستے', g: 'm' },
  bunch: { ur: 'گٹھی', g: 'f' },
  pot: { ur: 'گملا', pl: 'گملے', g: 'm' },
  box: { ur: 'ڈبہ', pl: 'ڈبے', g: 'm' },
  basket: { ur: 'ٹوکری', g: 'f' },
  mix: { ur: 'مکس', g: 'm' },
  // categories and general words
  vegetable: { ur: 'سبزی', pl: 'سبزیاں', g: 'f' },
  fruit: { ur: 'پھل', g: 'm', obl: 'پھلوں' },
  dairy: { ur: 'دودھ', g: 'm' },
  'baked good': { ur: 'بیکری', g: 'f', always: 'pl' },
  bakery: { ur: 'بیکری', g: 'f' },
  herb: { ur: 'جڑی بوٹی', pl: 'جڑی بوٹیاں', g: 'f' },
  greens: { ur: 'ہرے پتے', g: 'm', always: 'pl' },
  grain: { ur: 'اناج', g: 'm' },
  pulse: { ur: 'دال', pl: 'دالیں', g: 'f' },
  brine: { ur: 'نمکین پانی', g: 'm' },
  water: { ur: 'پانی', g: 'm' },
  // "whose" words: before کا / کی / کے
  goat: { ur: 'بکری', g: 'f' },
  buffalo: { ur: 'بھینس', g: 'f' },
  cow: { ur: 'گائے', g: 'f' },
  farm: { ur: 'فارم', g: 'm' },
  village: { ur: 'گاؤں', g: 'm' },
  garden: { ur: 'باغ', g: 'm' },
  vine: { ur: 'بیل', g: 'f' },
  chakki: { ur: 'چکی', g: 'f' },
  sidr: { ur: 'بیری', g: 'f' },
  acacia: { ur: 'پھلاہی', g: 'f' },
  hunza: { ur: 'ہنزہ', g: 'm' },
  swat: { ur: 'سوات', g: 'm' },
  sindh: { ur: 'سندھ', g: 'm' },
  punjab: { ur: 'پنجاب', g: 'm' },
  home: { ur: 'گھر', g: 'm' },
};

// Adjectives: one form, or [masculine, feminine, masculine plural]
const ADJ = {
  fresh: 'تازہ',
  organic: 'نامیاتی',
  desi: 'دیسی',
  country: 'دیسی',
  local: 'مقامی',
  natural: 'خالص',
  pure: 'خالص',
  wild: 'جنگلی',
  seasonal: 'موسمی',
  red: 'لال',
  white: 'سفید',
  purple: 'جامنی',
  pink: 'گلابی',
  orange: 'نارنجی',
  dry: 'خشک',
  dried: 'خشک',
  salted: 'نمکین',
  premium: 'اعلیٰ',
  special: 'خاص',
  classic: 'کلاسک',
  frozen: 'منجمد',
  crunchy: 'خستہ',
  spicy: 'مصالحے دار',
  mini: ['چھوٹا', 'چھوٹی', 'چھوٹے'],
  small: ['چھوٹا', 'چھوٹی', 'چھوٹے'],
  baby: ['چھوٹا', 'چھوٹی', 'چھوٹے'],
  big: ['بڑا', 'بڑی', 'بڑے'],
  large: ['بڑا', 'بڑی', 'بڑے'],
  jumbo: ['بڑا', 'بڑی', 'بڑے'],
  green: ['ہرا', 'ہری', 'ہرے'],
  yellow: ['پیلا', 'پیلی', 'پیلے'],
  black: ['کالا', 'کالی', 'کالے'],
  brown: ['بھورا', 'بھوری', 'بھورے'],
  golden: ['سنہرا', 'سنہری', 'سنہرے'],
  sweet: ['میٹھا', 'میٹھی', 'میٹھے'],
  sour: ['کھٹا', 'کھٹی', 'کھٹے'],
  raw: ['کچا', 'کچی', 'کچے'],
  tender: ['کچا', 'کچی', 'کچے'],
  ripe: ['پکا', 'پکی', 'پکے'],
  aged: ['پرانا', 'پرانی', 'پرانے'],
  old: ['پرانا', 'پرانی', 'پرانے'],
  new: ['نیا', 'نئی', 'نئے'],
  juicy: ['رسیلا', 'رسیلی', 'رسیلے'],
  roasted: ['بھنا ہوا', 'بھنی ہوئی', 'بھنے ہوئے'],
  boiled: ['ابلا ہوا', 'ابلی ہوئی', 'ابلے ہوئے'],
  'hand-churned': ['ہاتھ سے بلویا ہوا', 'ہاتھ سے بلوئی ہوئی', 'ہاتھ سے بلوئے ہوئے'],
  homemade: ['گھر کا بنا', 'گھر کی بنی', 'گھر کے بنے'],
  'home-made': ['گھر کا بنا', 'گھر کی بنی', 'گھر کے بنے'],
  handmade: ['ہاتھ سے بنا', 'ہاتھ سے بنی', 'ہاتھ سے بنے'],
  'stone-ground': ['چکی کا پسا', 'چکی کی پسی', 'چکی کے پسے'],
  potted: 'گملے میں',
  mixed: ['ملا جلا', 'ملی جلی', 'ملے جلے'],
  assorted: ['ملا جلا', 'ملی جلی', 'ملے جلے'],
};
// Adjectives about the product itself stay with the main word ("Fresh Buffalo Milk": the milk is fresh)
const HEAD_ADJ = new Set(['fresh', 'organic', 'natural', 'pure', 'wild', 'seasonal', 'premium', 'special', 'classic', 'frozen', 'homemade', 'home-made', 'handmade', 'hand-churned', 'aged', 'old', 'roasted', 'boiled', 'dried', 'salted', 'potted', 'mixed', 'assorted', 'spicy', 'crunchy', 'juicy', 'jumbo', 'large', 'big', 'small', 'mini', 'baby', 'tender', 'ripe', 'raw', 'sweet', 'sour']);

// Names of varieties: written in Urdu and kept right before the main word ("سندھڑی آم")
const VARIETY = {
  sindhri: 'سندھڑی',
  chaunsa: 'چونسا',
  'anwar ratol': 'انور رٹول',
  langra: 'لنگڑا',
  dussehri: 'دسہری',
  basmati: 'باسمتی',
  iceberg: 'آئس برگ',
  button: 'بٹن',
  cherry: 'چیری',
  kashmiri: 'کشمیری',
  irani: 'ایرانی',
  kabuli: 'کابلی',
  gala: 'گالا',
  fuji: 'فوجی',
  'fuji apple': 'فوجی',
};
const UNITS = { ...UNIT_UR, kg: 'کلو', kgs: 'کلو', kilo: 'کلو', g: 'گرام', gm: 'گرام', gram: 'گرام', grams: 'گرام', ml: 'ملی لیٹر', l: 'لیٹر', ltr: 'لیٹر', litre: 'لیٹر', liter: 'لیٹر', dozen: 'درجن', pcs: 'عدد', pieces: 'عدد', pack: 'پیکٹ', packet: 'پیکٹ' };
const PARTICLE = { m: 'کا', f: 'کی', pl: 'کے' };

// "tomatoes" -> "tomato", "cherries" -> "cherry", "goods" -> "good"
const singulars = (w) => [...new Set([w.replace(/ies$/, 'y'), w.replace(/oes$/, 'o'), w.replace(/es$/, ''), w.replace(/s$/, '')])].filter((x) => x !== w && x.length > 1);

/** One name without brackets, "and" or "in": the words in Urdu order. */
function nameParts(text) {
  const words = text.toLowerCase().replace(/[’']s\b/g, '').split(/[\s,/]+/).filter(Boolean);
  const tokens = [];
  let unknown = 0;
  for (let i = 0; i < words.length; ) {
    let hit = null;
    for (let n = Math.min(3, words.length - i); n >= 1 && !hit; n -= 1) {
      const lead = words.slice(i, i + n - 1);
      const last = words[i + n - 1];
      const isLast = i + n === words.length;
      for (const [key, plural] of [[[...lead, last].join(' '), false], ...singulars(last).map((x) => [[...lead, x].join(' '), true])]) {
        // "Cherry Tomatoes": a variety before the main word; "Cherries": the fruit itself
        if (VARIETY[key] && (!NOUNS[key] || !isLast)) hit = { type: 'variety', key, n };
        else if (NOUNS[key]) hit = { type: 'noun', key, n, plural: NOUNS[key].always === 'pl' || plural };
        else if (ADJ[key] && !plural) hit = { type: 'adj', key, n };
        if (hit) break;
      }
    }
    const w = words[i];
    if (!hit && /^\d+(\.\d+)?[a-z]*$/.test(w)) {
      const [, num, unit] = w.match(/^(\d+(?:\.\d+)?)([a-z]*)$/);
      const next = words[i + 1];
      if (unit && UNITS[unit]) hit = { type: 'qty', text: `${num} ${UNITS[unit]}`, n: 1 };
      else if (!unit && next && UNITS[next]) hit = { type: 'qty', text: `${num} ${UNITS[next]}`, n: 2 };
      else hit = { type: 'qty', text: w, n: 1 };
    }
    if (!hit && UNITS[w]) hit = { type: 'qty', text: UNITS[w], n: 1 };
    if (!hit) {
      hit = { type: 'unknown', text: w, n: 1 };
      unknown += 1;
    }
    tokens.push(hit);
    i += hit.n;
  }

  // the main word is the last noun; nouns before it say whose / what kind ("بکری کا دودھ")
  const nounIdx = tokens.map((t, i) => (t.type === 'noun' ? i : -1)).filter((i) => i >= 0);
  if (!nounIdx.length) {
    const text2 = tokens.map((t) => (t.type === 'adj' ? (Array.isArray(ADJ[t.key]) ? ADJ[t.key][0] : ADJ[t.key]) : t.type === 'variety' ? VARIETY[t.key] : t.text)).join(' ');
    return { text: text2, complete: unknown === 0 };
  }
  const headAt = nounIdx.at(-1);
  const head = tokens[headAt];
  const hn = NOUNS[head.key];
  const form = hn.g === 'f' ? 'f' : head.plural ? 'pl' : 'm'; // agreement of adjectives and کا / کی / کے
  const adjForm = (key, f) => (Array.isArray(ADJ[key]) ? ADJ[key][{ m: 0, f: 1, pl: 2 }[f]] : ADJ[key]);
  const headWord = head.plural && hn.pl ? hn.pl : hn.ur;

  const modifiers = []; // [{ words: [...], wala }]
  const headAdj = [];
  const varieties = [];
  const tail = [];
  let pendingAdj = [];
  tokens.forEach((t, i) => {
    if (i === headAt) return;
    if (i > headAt) {
      tail.push(t.type === 'qty' || t.type === 'unknown' ? t.text : t.type === 'adj' ? adjForm(t.key, form) : t.type === 'variety' ? VARIETY[t.key] : NOUNS[t.key].ur);
      return;
    }
    if (t.type === 'adj') {
      // "Desi Rose Bouquet": desi goes with the rose; "Fresh Buffalo Milk": fresh goes with the milk
      const nextNoun = nounIdx.find((n) => n > i);
      if (nextNoun !== headAt && !HEAD_ADJ.has(t.key)) pendingAdj.push(t.key);
      else headAdj.push(t.key);
    } else if (t.type === 'variety') varieties.push(VARIETY[t.key]);
    else if (t.type === 'unknown') varieties.push(t.text);
    else if (t.type === 'noun') {
      const n = NOUNS[t.key];
      if (n.variety) varieties.push(n.ur);
      else {
        // an adjective before a noun that is followed by کا / کی / کے takes the oblique form (ہرے سیب کا)
        const adj = pendingAdj.map((k) => adjForm(k, n.g === 'f' ? 'f' : 'pl'));
        modifiers.push({ word: [...adj, n.obl || n.ur].join(' '), wala: n.mod === 'wala' });
      }
      pendingAdj = [];
    } else tail.push(t.text);
  });
  headAdj.push(...pendingAdj);

  const out = [];
  if (modifiers.length) {
    const joined = modifiers.length > 1 ? `${modifiers.slice(0, -1).map((m) => m.word).join('، ')} اور ${modifiers.at(-1).word}` : modifiers[0].word;
    const wala = modifiers.every((m) => m.wala);
    out.push(joined, wala ? { m: 'والا', f: 'والی', pl: 'والے' }[form] : PARTICLE[form]);
  }
  out.push(...headAdj.map((k) => adjForm(k, form)));
  if (hn.lead && !headAdj.length) out.push(adjForm('green', form));
  out.push(...varieties, headWord, ...tail);
  return { text: out.filter(Boolean).join(' '), complete: unknown === 0 };
}

/** A product, category or other short name in Urdu: { text, complete }. */
export function urduName(name) {
  let complete = true;
  const translate = (s) => {
    const text = s.trim();
    if (!text) return '';
    // "Green Olives in Brine" -> "نمکین پانی میں ہرے زیتون"
    const inMatch = text.match(/^(.+?)\s+in\s+(.+)$/i);
    if (inMatch) return `${translate(inMatch[2])} میں ${translate(inMatch[1])}`;
    // "Honey from Hunza" / "Jam of Apricots" -> "ہنزہ کا شہد"
    const ofMatch = text.match(/^(.+?)\s+(?:from|of)\s+(.+)$/i);
    if (ofMatch) return translate(`${ofMatch[2]} ${ofMatch[1]}`);
    // "Bread with Seeds" -> "بیج والی ڈبل روٹی"
    const withMatch = text.match(/^(.+?)\s+with\s+(.+)$/i);
    if (withMatch) return translate(`${withMatch[2].replace(/s\b/i, '')} ${withMatch[1]}`);
    const parts = text.split(/\s+(?:and|&)\s+|\s*&\s*/i);
    if (parts.length > 1) return parts.map(translate).join(' اور ');
    const r = nameParts(text);
    if (!r.complete) complete = false;
    return r.text;
  };
  // "(Podina)", "(5 kg)" and "(Potted)" are translated on their own and kept in brackets
  const brackets = [];
  const main = String(name || '').replace(/\(([^)]*)\)/g, (_, inner) => {
    brackets.push(inner);
    return ' ';
  });
  let text = translate(main.replace(/\s+/g, ' '));
  for (const b of brackets) {
    const inner = translate(b);
    if (inner && !text.includes(inner)) text += ` (${inner})`;
  }
  return { text: text.replace(/\s+/g, ' ').trim(), complete: complete && Boolean(text) };
}

// ------------------------------------------------------------------ longer texts written in Urdu
const MONTHS_UR = { January: 'جنوری', February: 'فروری', March: 'مارچ', April: 'اپریل', May: 'مئی', June: 'جون', July: 'جولائی', August: 'اگست', September: 'ستمبر', October: 'اکتوبر', November: 'نومبر', December: 'دسمبر' };
const DAYS_UR = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
const PRACTICE_UR = [
  [/pesticide|chemical/i, 'کیڑے مار دواؤں کے بغیر'],
  [/organic/i, 'نامیاتی کاشت'],
  [/family/i, 'خاندانی فارم'],
  [/free[- ]range/i, 'کھلے میں پلی مرغیاں'],
  [/grass[- ]fed/i, 'گھاس کھانے والے جانور'],
  [/hand[- ]?picked|hand picked/i, 'ہاتھ سے چنی ہوئی فصل'],
  [/small[- ]batch/i, 'تھوڑی تھوڑی مقدار میں تیار'],
  [/raw|unfiltered/i, 'خالص اور بغیر فلٹر'],
  [/heritage|heirloom/i, 'پرانے دیسی بیج'],
  [/women/i, 'خواتین کا چلایا ہوا'],
  [/sustainab/i, 'ماحول دوست کاشت'],
  [/local/i, 'مقامی'],
  [/halal/i, 'حلال'],
  [/fresh/i, 'روز تازہ'],
  [/stone[- ]ground/i, 'چکی کا پسا ہوا'],
  [/baked|bakery/i, 'روز تازہ بیکنگ'],
];
const listUr = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join('، ')} اور ${items.at(-1)}`);
const seasonUr = (s) => (!s || /all year/i.test(s) ? 'سارا سال' : s.replace(/\b[A-Z][a-z]+\b/g, (m) => MONTHS_UR[m] || m).replace(/\bto\b/g, 'سے').replace(/(\S+) سے (\S+)/, '$1 سے $2 تک'));
const practicesUr = (list = []) => [...new Set(list.map((p) => PRACTICE_UR.find(([re]) => re.test(p))?.[1]).filter(Boolean))];

/** An Urdu product description from the details (not a word-for-word translation). */
export function urduProductDescription({ name, nameUr, category = '', unit = '', stallName = '', practices = [], season, variant = 0 }) {
  const info = produceInfo(name, category);
  const ur = nameUr || urduName(name).text;
  const stall = stallName || 'ہمارے فارم';
  const how = practicesUr(practices).slice(0, 2);
  const v = Math.abs(Number(variant) || 0) % 3;
  const fresh = ur.includes('تازہ') ? ur : `تازہ ${ur}`;
  const extra = how.length ? ` (${how.join('، ')})` : '';
  // sentences without a verb that would have to agree with the product name
  const first = [
    `${stall} سے ${fresh}${extra}، ہر مارکیٹ کے دن کے لیے کھیت سے سیدھا آپ تک۔`,
    `${ur} ${stall} سے${extra}، سیدھے کھیت سے آپ کی مارکیٹ تک۔`,
    `${stall} کی پیشکش: ${fresh}${extra}، مارکیٹ کے دن کے لیے احتیاط سے تیار۔`,
  ][v];
  const parts = [first];
  if (info.useUr) parts.push(`${info.useUr} بہترین۔`);
  if (season && !/all year/i.test(season)) parts.push(`موسم: ${seasonUr(season)}۔`);
  const unitUr = UNIT_UR[unit] || '';
  parts.push(unitUr ? `فی ${unitUr} فروخت، وصولی تک آپ کے لیے محفوظ۔ ${info.keepUr || ''}` : info.keepUr || '');
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** An Urdu "about the farm" text from the stall details. */
export function urduFarmBio({ stallName, city = '', categories = [], categorySlugs = [], practices = [], markets = [], variant = 0 }) {
  const v = Math.abs(Number(variant) || 0) % 3;
  const cityUr = CITY_UR[city] || city;
  const grows = categorySlugs.map((s, i) => CATEGORY_UR[s] || urduName(categories[i] || '').text).filter(Boolean);
  const parts = [
    [`${stallName}${cityUr ? ` ${cityUr} کا` : ' ایک'} مقامی فارم ہے۔`, `${stallName}${cityUr ? ` (${cityUr})` : ''} میں ہم ویسے ہی کاشت کرتے ہیں جیسے ہمارے بڑے کرتے آئے ہیں۔`, `${stallName}${cityUr ? ` ${cityUr} کے کھیتوں سے` : ''} تازہ موسمی پیداوار سیدھی آپ کی مارکیٹ تک لاتا ہے۔`][v],
  ];
  const what = grows.length ? listUr(grows) : 'موسمی پیداوار';
  parts.push([`ہم ہر مارکیٹ کے دن کے لیے ${what} چن کر اور پیک کر کے لاتے ہیں۔`, `ہمارے اسٹال پر ${what} ملتی ہیں، مارکیٹ کے دن کے قریب توڑی ہوئی تاکہ آپ تک تازہ پہنچیں۔`, `ہر مارکیٹ کے دن ہمارے ${what} ضرور دیکھیں۔`][v]);
  const how = practicesUr(practices).slice(0, 4);
  if (how.length) parts.push(`ہماری خاص بات: ${listUr(how)}۔`);
  if (markets.length) parts.push(`ہم سے ملیں: ${listUr(markets.slice(0, 3))}${markets.length > 3 ? ' اور دیگر مارکیٹوں' : ''} میں۔`);
  parts.push(v === 2 ? 'MarketLink پر پیشگی آرڈر دیں، ہم وصولی کے لیے آپ کی ٹوکری تیار رکھیں گے۔' : 'آن لائن پیشگی آرڈر دیں، اسٹال سے وصول کریں اور وہیں ادائیگی کریں۔');
  return parts.join(' ');
}

/** An Urdu market description from the market details. */
export function urduMarketDescription({ name, city = '', operatingDays = [], openTime = '', closeTime = '' }) {
  const cityUr = CITY_UR[city] || city;
  const days = listUr([...operatingDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAYS_UR[d]).filter(Boolean));
  const t12 = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    if (Number.isNaN(h)) return '';
    const part = h < 12 ? 'صبح' : h < 16 ? 'دوپہر' : h < 19 ? 'شام' : 'رات';
    return `${part} ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} بجے`;
  };
  const when = days ? ` ہر ${days}${openTime && closeTime ? ` ${t12(openTime)} سے ${t12(closeTime)} تک` : ''} لگتی ہے` : ' لگتی ہے';
  return `${name}${cityUr ? ` ${cityUr} میں` : ''} ایک کسان منڈی ہے جو${when}۔ یہاں مقامی کسان تازہ سبزیاں، پھل اور گھر کی بنی اشیاء بیچتے ہیں۔ MarketLink پر پیشگی آرڈر دیں اور مارکیٹ سے وصول کریں۔`;
}

// ------------------------------------------------------------------ Claude
const KIND_HINT = {
  name: 'a product or category name on a farmers market website (a few words only; use the common Pakistani Urdu word for the produce)',
  'product-description': 'a product description on a farmers market website',
  'farm-bio': 'the "about the farm" text of a farmer\'s stall',
  'market-description': 'the description of a farmers market',
  text: 'a text on a farmers market website (announcement, FAQ, banner or button)',
};

async function claudeUrdu(kind, text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', 'x-api-key': env.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.anthropic.model,
      max_tokens: 900,
      system:
        `Translate ${KIND_HINT[kind] || KIND_HINT.text} from English into natural, correct Urdu for customers in Pakistan. ` +
        'Use Urdu script with proper Urdu letters (ک ی ہ ے) and Urdu punctuation (، ۔). Keep names of people, stalls, markets and brands, numbers, {placeholders} and the word MarketLink as they are. ' +
        'Answer with the Urdu text only: no quotation marks, no notes, no English.',
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const out = data.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!out) throw new Error('Empty answer');
  return out.replace(/^["'“]|["'”]$/g, '');
}

/**
 * The Urdu for one box: { text, complete, source: 'claude' | 'local' }.
 * `phrases` (English -> Urdu) is used for general texts without Claude: each sentence must be known.
 */
export async function writeUrdu(kind, text, details = {}, phrases = new Map()) {
  const english = String(text || '').trim();
  if (env.anthropic.apiKey && english) {
    try {
      return { text: await claudeUrdu(kind, english), complete: true, source: 'claude' };
    } catch (err) {
      console.warn(`[ai] Claude could not write Urdu for "${kind}", using the built-in writer:`, err.message);
    }
  }
  if (kind === 'name') return { ...urduName(english), source: 'local' };
  if (kind === 'product-description') return { text: urduProductDescription(details), complete: true, source: 'local' };
  if (kind === 'farm-bio') return { text: urduFarmBio(details), complete: true, source: 'local' };
  if (kind === 'market-description') return { text: urduMarketDescription(details), complete: true, source: 'local' };
  // general text: every sentence must be one the site already has in Urdu
  const exact = phrases.get(english.toLowerCase());
  if (exact) return { text: exact, complete: true, source: 'local' };
  const sentences = english.split(/(?<=[.!?])\s+/).filter(Boolean);
  const found = sentences.map((s) => phrases.get(s.toLowerCase()) || phrases.get(s.replace(/[.!?]$/, '').toLowerCase()));
  if (sentences.length && found.every(Boolean)) return { text: found.join(' '), complete: true, source: 'local' };
  // a short label ("Shop now", "Fresh vegetables") may still be a name
  if (english.split(/\s+/).length <= 6) {
    const r = urduName(english);
    if (r.complete) return { ...r, source: 'local' };
  }
  return { text: '', complete: false, source: 'local' };
}
