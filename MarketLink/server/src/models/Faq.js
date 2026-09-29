import mongoose from 'mongoose';

// Groups shown as tabs on the FAQ page, in this order
export const FAQ_GROUPS = {
  shopping: 'Shopping & pre-orders',
  pickup: 'Pickup & payment',
  farmers: 'For farmers',
  account: 'Account & privacy',
};

// Frequently asked questions: the /faq page, the home page FAQ block and FAQPage structured data
const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: [true, 'Question is required'], trim: true, maxlength: 200 },
    // Plain text; a blank line starts a new paragraph. The first sentence is a short, direct answer.
    answer: { type: String, required: [true, 'Answer is required'], trim: true, maxlength: 1500 },
    // The same question and answer in Urdu (optional; the English text is shown when empty)
    questionUr: { type: String, trim: true, maxlength: 300 },
    answerUr: { type: String, trim: true, maxlength: 2500 },
    group: { type: String, enum: Object.keys(FAQ_GROUPS), default: 'shopping' },
    order: { type: Number, default: 0 },
    showOnHome: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

faqSchema.index({ isActive: 1, group: 1, order: 1 });

/** Group order first, then the admin's order number. */
export const sortFaqs = (faqs) => {
  const groups = Object.keys(FAQ_GROUPS);
  return [...faqs].sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.order - b.order || String(a.question).localeCompare(b.question));
};

export default mongoose.model('Faq', faqSchema);
