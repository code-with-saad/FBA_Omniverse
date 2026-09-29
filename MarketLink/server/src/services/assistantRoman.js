/**
 * Roman Urdu / Hinglish for the rule-based assistant: "sab se acha kisan kaunsa hai?",
 * "tamatar kahan milega", "aaj konsi mandi khuli hai". The assistant's rules read English keywords,
 * so the common Roman Urdu words and produce names are turned into those keywords first. English
 * words pass through unchanged, so mixed sentences ("best farmer kaunsa hai") work too.
 */

// Longer phrases first, so "sab se sasta" wins over "sasta"
const PHRASES = [
  [/\b(sab ?se|sabse) (zyada|ziada|ziyada) (bikne|bikta|bikti|bikay|bika|sold)( wala| wali| walay)?\b/g, 'best selling'],
  [/\b(sab ?se|sabse) (zyada|ziada|ziyada) (rating|rated|reviews?)\b/g, 'top rated'],
  [/\b(sab ?se|sabse) (acha|achha|accha|achi|achhi|behtareen|behtar|best|top)\b/g, 'best'],
  [/\b(sab ?se|sabse) (sasta|sasti|sastay|kam qeemat|kam keemat)\b/g, 'cheapest'],
  [/\b(sab ?se|sabse) (naya|naye|nayi|new)\b/g, 'newest'],
  [/\b(best seller|best sellers|zyada bikne|ziada bikne|bikne wal[aie])\b/g, 'best selling'],
  [/\bkitn[aei]y? (ka|ki|ke|ka hai|ki hai|mein|me)\b/g, 'price'],
  [/\bkitn[eaiy]+ (kisan|kissan|farmers?|mandi|mandiyan|markets?|bazar|products?|cheezen|cheezain|items?)\b/g, 'how many $1'],
  [/\bkab (khul|khol)\w*\b/g, 'when open'],
  [/\b(ghar (par|pe|tak)|home delivery|delivery kart[ea]|deliver kart[ea])\b/g, 'delivery'],
  [/\b(paise|paisay|pesay|paisa|adaigi|adaegi|payment) (kaise|kese|kaisay|kaisy|kab|kahan)\b/g, 'how to pay'],
  [/\b(order|orders) (kahan|kidhar|kaha) (hai|he|hain)\b/g, 'where is my order'],
  [/\b(nahi|nahin|nai) (mila|mili|mile)\b/g, 'not received'],
  [/\b(password|pasword) (bhool|bhul) (gaya|gayi|gya|gyi)\b/g, 'forgot password'],
  [/\b(account|acount) (kaise|kese) (banay?[ae]?|banaon|bana)\w*\b/g, 'create account'],
  [/\b(review|rating) (kaise|kese) (d[eo]|dena|dun|doon)\w*\b/g, 'how to review'],
  [/\b(wapas|dobara) (a|aa)(ye|ega|egi|ega|jaye)\b/g, 'back in stock'],
  [/\b(kya|kia) (milta|milti|bikta|bikti|milte|bikte) (hai|he|hain)\b/g, 'what can i buy'],
  [/\b(mera|meri) naam (kya|kia) (hai|he)\b/g, "what's my name"],
  [/\b(mera|meri) naam\b/g, 'my name is'],
  [/\bdouble roti\b/g, 'bread'],
  [/\bshimla mirch\b/g, 'capsicum'],
  [/\b(kaun|kon|kis|kaunse|konse|kitne)( se| si| sa)? (shehar|shahar|sheher)\w*\b/g, 'which cities'],
  [/\b(abhi|is waqt) (khuli|khula|open)\b/g, 'open now'],
  [/\b(aaj|aj) (aaya|aayega|aaye|aayegi|hai|he|mandi mein|market mein|market me|mandi me)\b/g, 'today $2'],
  [/\b(naye|naya|nayi|new) (kisan|kissan|farmers?)\b/g, 'new farmers'],
  [/\b(kya|kia) (hai|he) (ye|yeh|marketlink)\b|\bmarketlink (kya|kia) (hai|he)\b/g, 'about marketlink'],
];

// Single words -> English keywords (word boundaries; multi-word values are fine)
const WORDS = {
  // question words
  kaunsa: 'which', konsa: 'which', kaunsi: 'which', konsi: 'which', kaunse: 'which', konse: 'which', kon: 'which', kaun: 'which',
  kab: 'when', kahan: 'where', kahaan: 'where', kidhar: 'where', kaha: 'where', kaise: 'how', kese: 'how', kaisay: 'how', kya: 'what', kia: 'what',
  kitne: 'how many', kitnay: 'how many', kitni: 'how many', kitna: 'price',
  // market words
  kisan: 'farmer', kissan: 'farmer', kisano: 'farmers', kisanon: 'farmers', kashtkar: 'farmer', mandi: 'market', mandiyan: 'markets', bazar: 'market', bazaar: 'market',
  khuli: 'open', khula: 'open', khulti: 'open', khulta: 'open', khulegi: 'open', khulega: 'open', band: 'closed', waqt: 'time',
  milega: 'buy', milegi: 'buy', milenge: 'buy', milta: 'buy', milti: 'buy', milte: 'buy', kharidna: 'buy', khareedna: 'buy', lena: 'buy',
  qeemat: 'price', keemat: 'price', qimat: 'price', daam: 'price',
  sasta: 'cheapest', sasti: 'cheapest', sastay: 'cheapest', mehnga: 'expensive', mehngi: 'expensive',
  riayat: 'offer', riyayat: 'offer', chhoot: 'offer',
  naya: 'new', naye: 'new', nayi: 'new', naey: 'new',
  aaj: 'today', aj: 'today', kal: 'tomorrow', abhi: 'now', parson: '',
  mera: 'my', meray: 'my', mere: 'my', meri: 'my',
  wasooli: 'pickup', wasuli: 'pickup', uthana: 'pickup',
  shukriya: 'thanks', shukria: 'thanks', meherbani: 'thanks',
  rabta: 'contact', shikayat: 'complaint', shikayet: 'complaint',
  shehar: 'city', shahar: 'city',
  // produce
  tamatar: 'tomatoes', tamater: 'tomatoes', timatar: 'tomatoes', aloo: 'potatoes', aaloo: 'potatoes', alu: 'potatoes', pyaz: 'onions', piyaz: 'onions', payaz: 'onions',
  gajar: 'carrots', aam: 'mangoes', kela: 'bananas', kelay: 'bananas', kele: 'bananas', seb: 'apples', saib: 'apples', nashpati: 'pears', angoor: 'grapes', santara: 'kinnow', kinno: 'kinnow',
  doodh: 'milk', dudh: 'milk', anda: 'eggs', anday: 'eggs', ande: 'eggs', shahad: 'honey', shehad: 'honey', shehd: 'honey', makhan: 'butter', makkhan: 'butter', dahi: 'yogurt',
  sabzi: 'vegetables', sabziyan: 'vegetables', sabzian: 'vegetables', sabziyaan: 'vegetables', phal: 'fruits', fal: 'fruits', phalon: 'fruits',
  dhania: 'coriander', dhaniya: 'coriander', podina: 'mint', pudina: 'mint', mirch: 'chillies', mirchen: 'chillies', lehsan: 'garlic', lahsun: 'garlic', adrak: 'ginger',
  matar: 'peas', palak: 'spinach', kheera: 'cucumbers', kheeray: 'cucumbers', baingan: 'brinjal', bengan: 'brinjal', shimla: 'capsicum',
  chawal: 'rice', chaawal: 'rice', atta: 'atta', aata: 'atta', daal: 'lentils', dal: 'lentils', lobia: 'beans', chane: 'chickpeas',
  cheez: 'products', cheezen: 'products', cheezain: 'products', cheezon: 'products', saman: 'products', samaan: 'products',
  phool: 'flowers', gulab: 'roses', paudha: 'plants', paude: 'plants', paudhe: 'plants', roti: 'bread',
};

// Roman Urdu filler words the product search should ignore
export const ROMAN_STOP_WORDS = 'hai hain he ho ka ki ke ko se mein me pe par kar karo karna karen karein bata batao batain bataen bataye chahiye chaiye wala wali walay wale raha rahi rahe kuch koi sab bhi tha thi yahan ye yeh woh wo aur ya bhai sir jee ji plz please main hum ap aap apna apni tum tumhara'.split(' ');

const ROMAN_HINT = /\b(hai|hain|kya|kia|kaun|kon|konsa|kaunsa|kahan|kab|kaise|kese|milega|milta|kisan|mandi|sabse|sab se|aaj|mujhe|mera|meri|chahiye|bata|batao|acha|achha)\b/;
/** Does the question look like Roman Urdu / Hinglish? */
export const isRomanUrdu = (text) => ROMAN_HINT.test(String(text || '').toLowerCase());

/** English keywords for a Roman Urdu / Hinglish question (English words are kept). */
export function romanToEnglish(message) {
  let text = ` ${String(message || '').toLowerCase().replace(/[?!.,;:]/g, ' ')} `;
  for (const [pattern, value] of PHRASES) text = text.replace(pattern, value);
  text = text.replace(/\b[a-z]+\b/g, (w) => (Object.hasOwn(WORDS, w) ? WORDS[w] : w));
  return text.replace(/\s+/g, ' ').trim();
}
