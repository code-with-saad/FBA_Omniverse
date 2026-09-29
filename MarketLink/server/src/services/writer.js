/**
 * "Generate with AI" for the free-text boxes: review replies, reviews, decline reasons, report notes,
 * FAQ answers, market descriptions, announcements and moderation notes.
 *
 * With ANTHROPIC_API_KEY in server/.env Claude writes the text; without a key (or when Claude cannot be
 * reached) a built-in writer fills it from the details on the page, so the button always works.
 * Texts customers and farmers see are written in the language of the page (English or Urdu).
 */
import env from '../config/env.js';
import { Faq } from '../models/index.js';

const clean = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const first = (name) => clean(name, 60).split(' ')[0] || '';
const pick = (list, variant) => list[Math.abs(Number(variant) || 0) % list.length];
// Tidies a built-in text when a detail was empty ("Thanks, !" becomes "Thanks!")
const tidy = (text) =>
  String(text)
    .replace(/\s+([,!.?،۔])/g, '$1')
    .replace(/[,،]([!.?۔])/g, '$1')
    .replace(/^[,،]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Who may ask for which text, the Claude instructions and the built-in writer for each kind
export const KINDS = {
  'review-reply': {
    roles: ['farmer'],
    words: 60,
    prompt: 'Write the stall owner\'s public reply to a customer review. Warm, short and sincere. Thank the customer by first name. For a low rating, apologise and invite them back to the stall to put it right; do not argue or make excuses.',
    local: (c, v, ur) => {
      const name = first(c.customerName);
      const about = clean(c.about, 60) || (ur ? 'ہماری اشیاء' : 'our produce');
      const the = c.about ? `the ${about}` : about; // "the tomatoes" or "our produce"
      const r = Number(c.rating) || 5;
      if (ur) {
        if (r >= 4) return pick([`بہت شکریہ ${name}! ہمیں خوشی ہے کہ آپ کو ${about} پسند آئے۔ آپ کے الفاظ ہمارے لیے بہت اہم ہیں۔ اگلے مارکیٹ کے دن ملاقات ہو گی!`, `${name}، آپ کے پیارے جائزے کا شکریہ! ہم ہر ہفتے تازہ ترین فصل لانے کی کوشش کرتے ہیں۔ جلد دوبارہ ملیں گے!`, `شکریہ ${name}! یہ جان کر بہت اچھا لگا کہ آپ کا آرڈر وقت پر تیار تھا اور ${about} تازہ تھے۔ دوبارہ تشریف لائیں!`], v);
        if (r === 3) return pick([`${name}، آپ کی سچی رائے کا شکریہ۔ ہم اگلی بار اور بہتر کرنے کی پوری کوشش کریں گے۔ اسٹال پر آ کر ضرور بتائیں کہ ہم کیا بہتر کر سکتے ہیں۔`, `شکریہ ${name}۔ ہم آپ کی بات پر غور کر رہے ہیں تاکہ اگلا آرڈر بالکل ٹھیک ہو۔`], v);
        return pick([`${name}، ہمیں افسوس ہے کہ ${about} معیار پر پورے نہیں اترے۔ بتانے کا شکریہ۔ اگلے مارکیٹ کے دن اسٹال پر آئیں، ہم اس کی تلافی کریں گے۔`, `معذرت ${name}۔ یہ ہمارے معیار کے مطابق نہیں تھا۔ براہِ کرم اسٹال پر ہم سے ملیں تاکہ ہم اسے ٹھیک کر سکیں۔`], v);
      }
      if (r >= 4) return pick([`Thank you so much, ${name}! We're glad you enjoyed ${the}. Your kind words mean a lot to all of us at ${c.stallName || 'the stall'}. See you at the market next week!`, `Thanks for the lovely review, ${name}! We pick fresh for every market day, so it's great to hear it showed. Hope to see you again soon.`, `Thank you, ${name}! Happy to hear your ${c.about ? `${about} ` : ''}order was ready on time and fresh. Come back anytime!`], v);
      if (r === 3) return pick([`Thank you for the honest feedback, ${name}. We'll work on doing better next time. Please tell us at the stall what we can improve.`, `Thanks, ${name}. We hear you and we're looking at how to make your next order just right.`], v);
      return pick([`We're sorry your ${c.about ? `${about} ` : ''}order wasn't up to the mark, ${name}. Thank you for telling us. Please come by the stall on your next market day and we'll make it right.`, `Sorry about this, ${name}. It's not the standard we aim for. Please see us at the stall so we can put it right.`], v);
    },
  },
  review: {
    roles: ['customer'],
    words: 50,
    prompt: 'Write a short, honest customer review of a farmers market product or stall, matching the star rating given. First person, plain words, 2 sentences. No exaggeration, no emoji.',
    local: (c, v, ur) => {
      const name = clean(c.about, 60) || (ur ? 'یہ چیز' : '');
      const what = name || 'produce'; // sentences below avoid "was / were" so plural names read right
      const r = Number(c.rating) || 5;
      const stall = c.type === 'farmer';
      if (ur) {
        if (r >= 5) return pick([stall ? `${name} بہت اچھا اسٹال ہے۔ آرڈر وقت پر تیار تھا اور سب کچھ بالکل تازہ تھا۔` : `${name} بہت تازہ اور مزے دار تھے۔ اسٹال سے وصولی جلدی اور آسان تھی، اگلی بار بھی یہیں سے آرڈر کریں گے۔`, stall ? `بہت اچھے لوگ اور بہترین معیار۔ ہر ہفتے یہیں سے خریداری کریں گے۔` : `بہترین معیار! ${name} بالکل تازہ تھے اور اچھی طرح پیک کیے ہوئے تھے۔`], v);
        if (r === 4) return `${name} اچھے اور تازہ تھے، وصولی بھی آسان رہی۔ تھوڑی اور ورائٹی ہوتی تو بہترین تھا۔`;
        if (r === 3) return `${name} ٹھیک تھے۔ کچھ بہت تازہ تھے، کچھ کم۔ وصولی ٹھیک رہی۔`;
        return `اس بار ${name} توقع کے مطابق تازہ نہیں تھے۔ امید ہے اگلا آرڈر بہتر ہو گا۔`;
      }
      if (r >= 5) return pick([stall ? `${name || 'This'} is a great stall. My order was ready on time and everything was really fresh.` : `Really fresh ${what}, full of flavour. Pickup at the stall was quick and easy, I will order again.`, stall ? `Friendly people and excellent quality. I'll keep buying here every week.` : `Excellent quality! Very fresh ${what}, neatly packed.`], v);
      if (r === 4) return `Good ${stall ? 'stall' : 'quality'}: fresh ${stall ? 'produce' : what} and a smooth pickup. A little more variety would make it perfect.`;
      if (r === 3) return `Okay overall${name && !stall ? ` for the ${name}` : ''}. Some of it was very fresh, some less so. Pickup went fine.`;
      return `Not happy with this order${name && !stall ? ` of ${name}` : ''}: it wasn't as fresh as I expected. I hope the next order is better.`;
    },
  },
  'decline-reason': {
    roles: ['farmer'],
    words: 45,
    prompt: 'Write the short, polite reason a farmer gives a customer for declining a pre-order. Apologise, give a simple, believable reason (such as a smaller harvest or the item selling out) and invite them to order again. Two sentences.',
    local: (c, v, ur) => {
      const item = clean(c.items, 60).split(',')[0] || (ur ? 'یہ چیز' : 'this item');
      if (ur) return pick([`معذرت، اس ہفتے ${item} کی فصل توقع سے کم ہوئی اور یہ ختم ہو گئی۔ براہِ کرم اگلے ہفتے دوبارہ آرڈر دیں۔`, `معذرت، ہم یہ پیشگی آرڈر پورا نہیں کر سکتے کیونکہ ${item} کا اسٹاک ختم ہو گیا ہے۔ اگلے مارکیٹ کے دن کے لیے دوبارہ آرڈر دیں۔`, `ہمیں افسوس ہے، اس دن ہم مارکیٹ نہیں آ سکیں گے۔ کوئی اور دن چن کر دوبارہ آرڈر دیں۔`], v);
      return pick([`Sorry, our ${item} harvest this week was smaller than expected and we have sold out. Please order again next week.`, `Sorry, we can't fill this pre-order because we have sold out of ${item}. Please order again for the next market day.`, `We're sorry, we can't be at the market on that day. Please choose another day and order again.`], v);
    },
  },
  'report-note': {
    roles: ['customer', 'farmer'],
    words: 40,
    prompt: 'Write a short, factual note for a moderator explaining why a user is reporting a review, listing or stall. Calm and specific, one or two sentences, based on the reason given.',
    local: (c, v, ur) => {
      const reason = clean(c.reason, 80).toLowerCase() || (ur ? 'نامناسب' : 'inappropriate');
      const what = c.targetType === 'farmer' ? (ur ? 'اسٹال' : 'stall') : c.targetType === 'product' ? (ur ? 'اندراج' : 'listing') : ur ? 'جائزے' : 'review';
      if (ur) return `اس ${what} کی رپورٹ "${reason}" کی وجہ سے کی جا رہی ہے۔ براہِ کرم اسے دیکھ لیں۔`;
      return pick([`I'm reporting this ${what} as "${reason}". Please take a look.`, `Reason for this report: ${reason}. Could the MarketLink team please check this ${what}?`], v);
    },
  },
  'faq-answer': {
    roles: ['admin'],
    words: 110,
    prompt: 'Write the answer to a frequently asked question for MarketLink. Start with one short, direct sentence that answers the question (it is quoted by search engines), then add 1 to 3 short sentences of detail. Facts: customers pre-order online from local farmers, choose a pickup date and time slot at a farmers market, pay the farmer in person at pickup (no online payment, no delivery), can change or cancel until the farmer\'s cut-off time, farmers register their stall for free and are approved by the admin, verified reviews come from completed pickups.',
    local: async (c) => {
      const question = clean(c.question, 300);
      const words = question.toLowerCase().match(/[a-z]{4,}/g) || [];
      const faqs = await Faq.find({}).select('question answer').lean();
      let best = null;
      for (const f of faqs) {
        const score = words.filter((w) => f.question.toLowerCase().includes(w)).length;
        if (score >= 2 && (!best || score > best.score)) best = { score, answer: f.answer };
      }
      if (best) return best.answer;
      const q = question.toLowerCase();
      if (/pay|cash|money|card/.test(q)) return 'You pay the farmer in person when you pick up your order. MarketLink has no online payment, so nothing is charged when you pre-order.';
      if (/deliver|courier|home/.test(q)) return 'No, MarketLink is pickup only. You collect your pre-order from the farmer\'s stall at the market in the time slot you chose.';
      if (/cancel|change|edit|modify/.test(q)) return 'Yes, until the farmer\'s cut-off time. Open My Orders to change the items or the pickup slot, or to cancel; after the cut-off the order is locked and you can contact the farmer.';
      if (/sell|farmer|stall|register/.test(q)) return 'Register your stall for free with "Sell with us". After a MarketLink admin approves it, you can list your weekly stock, set pickup times and take pre-orders.';
      return 'Here is the short answer. MarketLink lets you pre-order fresh food from local farmers online, pick it up at the market in your chosen time slot and pay the farmer there.';
    },
  },
  'market-description': {
    roles: ['admin'],
    words: 60,
    prompt: 'Write a short description of a weekly farmers market for its public page: where it is, when it is open and what people find there. Friendly and factual, 2 sentences, no invented details.',
    local: (c, v) => {
      const name = clean(c.name, 80) || 'This market';
      const where = [clean(c.address, 100), clean(c.city, 40)].filter(Boolean).join(', ');
      const when = [clean(c.days, 60), c.openTime && c.closeTime ? `${clean(c.openTime, 8)} to ${clean(c.closeTime, 8)}` : ''].filter(Boolean).join(', ');
      const what = clean(c.categories, 120) || 'fresh vegetables, fruit and more';
      return pick([`${name} is a weekly farmers market${where ? ` at ${where}` : ''}${when ? `, open ${when}` : ''}. Local farmers sell ${what.toLowerCase()} here, and MarketLink customers collect their pre-orders at the stalls.`, `Meet local growers at ${name}${where ? ` (${where})` : ''}. ${when ? `Open ${when}, ` : ''}it is the place to pick up ${what.toLowerCase()} you pre-ordered on MarketLink.`], v);
    },
  },
  announcement: {
    roles: ['admin'],
    words: 45,
    prompt: 'Write the message of a short site-wide announcement banner for MarketLink shoppers, based on its title. One or two upbeat, plain sentences with a call to pre-order. No emoji.',
    local: (c, v) => {
      const title = clean(c.title, 100).replace(/[.!]+$/, '');
      return pick([`${title}. Fresh stock is at the markets this week, so pre-order early on MarketLink and pick it up at the stall.`, `${title}! Our farmers have brought the new harvest to market. Reserve yours before it sells out.`], v);
    },
  },
  'moderation-note': {
    roles: ['admin'],
    words: 35,
    prompt: 'Write a short, neutral reason an administrator records when suspending a stall, removing a listing or review, or restoring one. One sentence, factual, polite.',
    local: (c, v) => {
      const reason = clean(c.reason, 80).toLowerCase();
      const action = clean(c.action, 20);
      if (action === 'restore') return 'Checked again: the content follows the MarketLink rules, so it is visible again.';
      if (action === 'dismiss') return 'Reviewed the report: no rule was broken, so no action is needed.';
      if (action === 'suspend') return pick([`Suspended after repeated reports${reason ? ` of ${reason}` : ''}. Please contact the MarketLink team to discuss your listings.`, `Stall paused while we review reports${reason ? ` about ${reason}` : ''}.`], v);
      return `Removed because it breaks the MarketLink rules${reason ? ` (${reason})` : ''}.`;
    },
  },
};

async function claudeWrite(kind, context, lang, variant) {
  const spec = KINDS[kind];
  const details = Object.entries(context)
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${clean(value, 400)}`)
    .join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'content-type': 'application/json', 'x-api-key': env.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.anthropic.model,
      max_tokens: 400,
      system: `You help users of MarketLink, a farmers market pre-order website in Pakistan (customers pre-order online, pick up at the market and pay the farmer there). ${spec.prompt} At most ${spec.words} words. Write in ${lang === 'ur' ? 'Urdu (Urdu script, Urdu punctuation)' : 'plain, friendly English'}. Reply with the text only: no quotation marks, no emoji, no headings.`,
      messages: [{ role: 'user', content: `${details || 'No details.'}${variant ? '\nWrite a different version from before.' : ''}` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Empty answer');
  return text.replace(/^["'“]|["'”]$/g, '').slice(0, 2000);
}

/** The text for a box: { text, source: 'claude' | 'local' }. */
export async function writeText(kind, context = {}, { lang = 'en', variant = 0 } = {}) {
  const spec = KINDS[kind];
  const language = lang === 'ur' && kind !== 'faq-answer' && KINDS[kind].roles[0] !== 'admin' ? 'ur' : 'en';
  if (env.anthropic.apiKey) {
    try {
      return { text: await claudeWrite(kind, context, language, variant), source: 'claude' };
    } catch (err) {
      console.warn(`[ai] Claude could not write "${kind}", using the built-in writer:`, err.message);
    }
  }
  return { text: tidy(await spec.local(context, variant, language === 'ur')), source: 'local' };
}
