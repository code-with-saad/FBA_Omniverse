/**
 * Urdu for the rule-based assistant.
 *
 * Questions: the assistant's rules understand English keywords, so an Urdu question is turned into
 * those keywords first ("آم کہاں ملیں گے؟" -> "where buy sindhri mangoes chaunsa mangoes"). Product
 * names are recognised from the products' own Urdu names (nameUr).
 * Answers: the words the answers are built from (days, units, statuses, cities, categories).
 */

export const DAY_UR = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
export const UNIT_UR = { kg: 'کلو', g: 'گرام', lb: 'پاؤنڈ', dozen: 'درجن', piece: 'عدد', bunch: 'گٹھی', litre: 'لیٹر', pack: 'پیکٹ', jar: 'جار', loaf: 'ڈبل روٹی', box: 'ڈبہ' };
export const STATUS_UR = { placed: 'دیا گیا', accepted: 'منظور', ready: 'تیار', completed: 'مکمل', declined: 'مسترد', cancelled: 'منسوخ' };
export const CITY_UR = { Karachi: 'کراچی', Lahore: 'لاہور', Islamabad: 'اسلام آباد', Rawalpindi: 'راولپنڈی', Hyderabad: 'حیدرآباد', Faisalabad: 'فیصل آباد', Multan: 'ملتان', Peshawar: 'پشاور', Quetta: 'کوئٹہ' };
export const CATEGORY_UR = {
  vegetables: 'سبزیاں',
  fruits: 'پھل',
  'dairy-eggs': 'دودھ اور انڈے',
  'baked-goods': 'بیکری',
  'herbs-greens': 'ہرے پتے اور جڑی بوٹیاں',
  'honey-preserves': 'شہد اور مربے',
  'grains-pulses': 'اناج اور دالیں',
  'flowers-plants': 'پھول اور پودے',
};

const URDU = /[؀-ۿ]/;
export const isUrduText = (text) => URDU.test(String(text || ''));

// Urdu words -> the English keywords the rules look for
const KEYWORDS = [
  [['شکریہ', 'مہربانی'], 'thanks'],
  [['سب سے اچھ', 'سب سے بہتر', 'بہترین', 'ٹاپ', 'اعلیٰ'], 'best'],
  [['ریٹنگ', 'درجہ بندی', 'سب سے زیادہ پسند'], 'top rated'],
  [['زیادہ بک', 'زیادہ فروخت', 'مقبول', 'بیسٹ سیلر'], 'best selling'],
  [['سستا', 'سستی', 'سستے', 'کم قیمت'], 'cheapest'],
  [['مہنگا', 'مہنگی', 'مہنگے'], 'most expensive'],
  [['رعایت', 'ڈسکاؤنٹ', 'آفر', 'سیل '], 'offer'],
  [['نیا ', 'نئے', 'نئی', 'تازہ ترین'], 'new'],
  [['رابطہ', 'شکایت', 'مدد'], 'contact complaint'],
  [['کتنے کسان'], 'how many farmers'],
  [['کتنی مارکیٹ', 'کتنی منڈ', 'کتنے بازار'], 'how many markets'],
  [['کتنی اشیاء', 'کتنی چیز', 'کتنے پروڈکٹ'], 'how many products'],
  [['پاس ورڈ'], 'forgot password'],
  [['اکاؤنٹ بنا', 'اکاؤنٹ کیسے', 'سائن اپ', 'رجسٹر'], 'create account'],
  [['جائزہ', 'ریویو', 'تبصرہ'], 'review'],
  [['نہیں ملا', 'نہیں ملی', 'نہیں ملے'], 'not received'],
  [['اطلاع', 'یاد دہانی', 'دوبارہ آ', 'واپس آ'], 'remind back in stock'],
  [['زمرے', 'اقسام', 'کیٹیگری', 'قسمیں'], 'categories'],
  [['شہر'], 'cities'],
  [['ابھی', 'اس وقت'], 'now'],
  [['آپ کون', 'مارکیٹ لنک کیا', 'یہ ویب سائٹ'], 'about marketlink'],
  [['ادائیگی', 'پیمنٹ', 'پیسے', 'رقم', 'کیش', 'نقد', 'کارڈ'], 'payment'],
  [['ڈیلیوری', 'ڈلیوری', 'گھر پر', 'گھر تک', 'پہنچا'], 'delivery'],
  [['منسوخ', 'کینسل', 'تبدیل', 'بدلنا', 'بدل '], 'cancel'],
  [['بیچنا', 'بیچ سکتا', 'بیچ سکتی', 'بیچنے', 'فروخت کر', 'کسان بن', 'اسٹال رجسٹر'], 'sell'],
  [['آرڈر کیسے', 'کیسے آرڈر', 'کیسے خرید', 'کیسے کام', 'کام کیسے'], 'how does it work'],
  [['میرا آرڈر', 'میرے آرڈر', 'آرڈر کہاں', 'آرڈر کی صورتحال', 'ٹریک'], 'my orders'],
  [['اوقات', 'وقت', 'ٹائم', 'کب', 'کھلت', 'کھلے', 'بند'], 'timing'],
  [['مارکیٹ', 'منڈی', 'بازار'], 'market'],
  [['وصولی', 'پک اپ', 'وصول'], 'pickup'],
  [['کسان', 'کاشتکار', 'اسٹال'], 'farmers'],
  [['کون', 'کونسا', 'کونسی', 'کونسے'], 'which'],
  [['قیمت', 'ریٹ', 'کتنے', 'کتنا', 'کتنی'], 'price'],
  [['اسٹاک', 'دستیاب', 'باقی', 'موجود'], 'stock available'],
  [['کہاں', 'ملے گا', 'ملیں گے', 'ملے گی', 'خرید'], 'where buy'],
  [['کیا یاد', 'یاد ہے', 'یاد رکھ'], 'what do you remember'],
  [['بھول جا'], 'forget everything'],
  [['بارے میں', 'تفصیل'], 'tell me about'],
  [['تمام', 'سب '], 'all'],
  [['آج'], 'today'],
  [['کل '], 'tomorrow'],
  [['رہتا', 'رہتی', 'رہتے'], 'i live in'],
  [['سبزی'], 'vegetables'],
  [['پھل'], 'fruits'],
  [['بیکری'], 'baked'],
  [['ڈیری'], 'dairy'],
  [['اناج', 'دالیں'], 'grains pulses'],
];
const DAYS = [
  ['اتوار', 'sunday'],
  ['پیر', 'monday'],
  ['منگل', 'tuesday'],
  ['بدھ', 'wednesday'],
  ['جمعرات', 'thursday'],
  ['جمعہ', 'friday'],
];
// Words in Urdu product names that do not tell the products apart
const NAME_NOISE = new Set(['تازہ', 'دیسی', 'کا', 'کی', 'کے', 'اور', 'والا', 'والی', 'والے', 'خالص', 'گھر', 'بنی', 'بنا', 'ہوئی', 'ہوا', 'کچا', 'کچی', 'پکا', 'پکی', 'میں', 'سے', 'پر']);

/**
 * English keywords for an Urdu question. `products`: [{ name, nameUr }] to recognise product names.
 * Text that is not Urdu (e.g. a market name typed in English) is kept as it is.
 */
export function urduToEnglish(message, products = []) {
  const text = ` ${String(message).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[؟?!۔،,.:؛]/g, ' ')} `;
  const out = [];
  if (/^\s*(السلام|اسلام|سلام|آداب|ہیلو|ہائے)/.test(text)) out.push('hello');
  // "میرا نام کیا ہے؟" asks for the name; "میرا نام علی ہے" tells it
  if (/میرا نام کیا/.test(text)) out.push("what's my name");
  else {
    const name = text.match(/میرا نام\s+([\u0600-\u06ff]+(?:\s[\u0600-\u06ff]+)?)\s+ہے/);
    if (name) return `my name is ${name[1]}`;
  }
  // Farmers asking how to give an offer, or how to tell customers they are at the market / cannot come
  const how = /کیسے|کس طرح/.test(text);
  if (how && /آفر|رعایت|ڈسکاؤنٹ/.test(text) && /لگا|دوں|دے|دیں|کسان|میری|میرے|اپنی|اپنے/.test(text)) out.push('how to give offer');
  if (how && /نہیں آ|حاضری|مارکیٹ میں ہوں/.test(text)) out.push('how do i tell customers not coming');
  for (const [words, keyword] of KEYWORDS) if (words.some((w) => text.includes(w))) out.push(keyword);
  for (const [ur, en] of DAYS) if (text.includes(ur)) out.push(en);
  if (/(ہفتے|ہفتہ) (کو|کے دن)/.test(text) || (/ہفتہ/.test(text) && !/اس ہفت/.test(text))) out.push('saturday');
  for (const [en, ur] of Object.entries(CITY_UR)) if (text.includes(ur)) out.push(en.toLowerCase());
  // Products: the whole Urdu name, or a telling word of it ("آم" finds Sindhri and Chaunsa mangoes)
  const words = text.split(/\s+/).filter((w) => w.length > 1 && !NAME_NOISE.has(w));
  for (const p of products) {
    if (!p.nameUr) continue;
    const nameWords = p.nameUr.split(/\s+/).filter((w) => w.length > 1 && !NAME_NOISE.has(w));
    if (text.includes(p.nameUr) || nameWords.some((w) => words.includes(w))) out.push(p.name.toLowerCase());
  }
  const latin = String(message).replace(/[؀-ۿ]+/g, ' ').trim();
  return [latin, ...new Set(out)].filter(Boolean).join(' ');
}
