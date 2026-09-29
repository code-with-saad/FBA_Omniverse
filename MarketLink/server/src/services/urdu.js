/**
 * Urdu texts the server writes into the HTML of the first page when a visitor has chosen Urdu
 * (the ml_lang cookie or ?lang=ur). The same texts as the site itself (client/src/i18n/ur.js).
 */

export const DEFAULT_TITLE_UR = 'MarketLink | مقامی کسان منڈیوں سے تازہ';
export const DEFAULT_DESCRIPTION_UR = "MarketLink مقامی کسان منڈیوں کو گاہکوں سے جوڑتا ہے: دیکھیں اس ہفتے ہر کسان کے پاس کیا ہے، تازہ اشیاء کا پیشگی آرڈر دیں اور مارکیٹ سے وصول کریں۔ ادائیگی اسٹال پر۔";

export const STATIC_PAGES_UR = {
  "/": { title: null, description: "MarketLink مقامی کسان منڈیوں کو گاہکوں سے جوڑتا ہے: دیکھیں اس ہفتے ہر کسان کے پاس کیا ہے، تازہ اشیاء کا پیشگی آرڈر دیں اور مارکیٹ سے وصول کریں۔ ادائیگی اسٹال پر۔" },
  "/products": { title: "تازہ اشیاء خریدیں", description: "مقامی کسانوں سے اس ہفتے کی سبزیاں، پھل، دودھ کی اشیاء، شہد، بیکری اور بہت کچھ دیکھیں۔ مارکیٹ، دن، شہر اور قیمت سے چھانٹیں، پھر وصولی کے لیے پیشگی آرڈر دیں۔" },
  "/markets": { title: "کسان منڈیاں", description: "اپنے قریب کسان منڈیاں تلاش کریں: کھلنے کے دن اور اوقات، نقشے پر مقام اور ہر مارکیٹ میں بیچنے والے کسان۔" },
  "/farmers": { title: "مقامی کسان", description: "MarketLink کے مقامی کسانوں اور اسٹالوں سے ملیں: وہ کیا اگاتے ہیں، کہاں بیچتے ہیں، ان کی ریٹنگ اور ہفتہ وار اسٹاک۔" },
  "/map": { title: "مارکیٹوں کا نقشہ", description: "تمام کسان منڈیاں اور کسانوں کے اسٹال ایک نقشے پر، راستے اور کھلنے کے دنوں کے ساتھ۔" },
  "/about": { title: "MarketLink کے بارے میں", description: "MarketLink مقامی کسان منڈیوں کو آن لائن لاتا ہے تاکہ خاندان مارکیٹ کے دن سے پہلے تازہ کھانا محفوظ کر سکیں اور کسانوں کا مال کم ضائع ہو۔ تیار کردہ: Team Omniverse۔" },
  "/faq": { title: "اکثر پوچھے جانے والے سوالات", description: "MarketLink پر مقامی کسانوں سے پیشگی آرڈر کے بارے میں جوابات: آرڈر کیسے ہوتا ہے، مارکیٹ سے وصولی، کسان کو نقد ادائیگی، آرڈر میں تبدیلی اور کسان کے طور پر فروخت۔" },
  "/contact": { title: "ہم سے رابطہ کریں", description: "آرڈر، کسان کے طور پر شمولیت یا کسی مارکیٹ کے ساتھ شراکت کے بارے میں سوال ہے؟ MarketLink ٹیم سے رابطہ کریں۔" },
  "/terms": { title: "شرائط و ضوابط", description: "گاہک یا کسان کے طور پر MarketLink استعمال کرنے کی شرائط، اور آپ کے ذاتی ڈیٹا کو کیسے سنبھالا جاتا ہے۔" },
  "/login": { title: "لاگ اِن", description: "گاہک، کسان یا ایڈمن کے طور پر MarketLink میں لاگ اِن کریں۔" },
  "/register": { title: "اکاؤنٹ بنائیں", description: "مقامی کسانوں سے پیشگی آرڈر دینے، پسندیدہ محفوظ کرنے اور اسٹاک واپس آنے کی اطلاع پانے کے لیے MarketLink کا مفت اکاؤنٹ بنائیں۔" },
  "/register/farmer": { title: "MarketLink کے ساتھ فروخت کریں", description: "MarketLink پر اپنا فارم اسٹال رجسٹر کریں: ہفتہ وار اسٹاک درج کریں، پیشگی آرڈر لیں اور وصولی کے اوقات مقرر کریں۔" },
};

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

export const UNIT_UR = { kg: 'کلو', g: 'گرام', lb: 'پاؤنڈ', dozen: 'درجن', piece: 'عدد', bunch: 'گٹھی', litre: 'لیٹر', pack: 'پیکٹ', jar: 'جار', loaf: 'ڈبل روٹی', box: 'ڈبہ' };

export const CITY_UR = {
  Karachi: 'کراچی',
  Lahore: 'لاہور',
  Islamabad: 'اسلام آباد',
  Rawalpindi: 'راولپنڈی',
  Hyderabad: 'حیدرآباد',
  Faisalabad: 'فیصل آباد',
  Multan: 'ملتان',
  Peshawar: 'پشاور',
  Quetta: 'کوئٹہ',
};

const city = (c) => CITY_UR[c] || c;
const categoryUr = (c) => c?.nameUr || CATEGORY_UR[c?.slug] || c?.name || '';

/** The language of a page request: ?lang= first, then the ml_lang cookie. The admin area is always English. */
export function pageLang(req) {
  if (/^\/admin(\/|$)/.test(req.path)) return 'en';
  const q = String(req.query?.lang || '');
  if (q === 'ur' || q === 'en') return q;
  return req.cookies?.ml_lang === 'ur' ? 'ur' : 'en';
}

// Title and description of the detail pages in Urdu (the same wording as the site)
export const productUr = (p) => ({
  title: `${p.nameUr || p.name}، ${p.price} روپے فی ${UNIT_UR[p.unit] || p.unit}، ${p.farmer?.stallName} سے`,
  description: `${p.farmer?.stallName} کی طرف سے ${p.nameUr || p.name} (${categoryUr(p.category)})۔ MarketLink پر پیشگی آرڈر دیں اور وصولی کے وقت اسٹال پر ادائیگی کریں۔`,
  imageAlt: p.nameUr || p.name,
});

export const farmerUr = (f) => ({
  title: f.city ? `${f.stallName}، ${city(f.city)} کے مقامی کسان` : `${f.stallName}، مقامی کسان`,
  description: `${f.stallName} MarketLink پر تازہ اشیاء بیچتا ہے۔ اس ہفتے کا اسٹاک، وصولی کے اوقات اور جائزے دیکھیں۔`,
});

export const marketUr = (m) => ({
  title: m.city ? `${m.name}، ${city(m.city)} کی کسان منڈی` : `${m.name}، کسان منڈی`,
  description: `${m.name}، ${m.address}۔ یہاں کے کسان اور کھلنے کے دن دیکھیں اور MarketLink پر پیشگی آرڈر دیں۔`,
});

export const categoryPageUr = (c) => ({
  title: `مقامی کسانوں سے ${categoryUr(c)}`,
  description: `مقامی کسانوں سے تازہ ${categoryUr(c)}۔ پیشگی آرڈر دیں اور مارکیٹ سے وصول کریں۔`,
});
