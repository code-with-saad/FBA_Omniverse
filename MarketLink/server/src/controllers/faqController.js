import { Faq } from '../models/index.js';
import { FAQ_GROUPS, sortFaqs } from '../models/Faq.js';
import AppError from '../utils/AppError.js';
import { assertId, pick, requireFields, toBool, toNumber } from '../utils/helpers.js';

/** Active questions in page order (for the FAQ page, the home page, llms.txt and structured data). */
export async function publicFaqs({ homeOnly = false } = {}) {
  const faqs = await Faq.find({ isActive: true, ...(homeOnly ? { showOnHome: true } : {}) })
    .select('question answer questionUr answerUr group order showOnHome')
    .lean();
  return sortFaqs(faqs);
}

// GET /api/faqs  (?home=1: only the questions picked for the home page)
export async function listFaqs(req, res) {
  const faqs = await publicFaqs({ homeOnly: toBool(req.query.home) });
  res.set('Cache-Control', 'public, max-age=300').json({ faqs, groups: FAQ_GROUPS });
}

function readFaq(body) {
  const data = pick(body, ['question', 'answer', 'questionUr', 'answerUr']);
  if (body.group !== undefined) {
    if (!FAQ_GROUPS[body.group]) throw new AppError('Please choose a valid group', 400);
    data.group = body.group;
  }
  if (body.order !== undefined) data.order = toNumber(body.order, 0);
  if (body.showOnHome !== undefined) data.showOnHome = toBool(body.showOnHome);
  if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
  return data;
}

// GET /api/admin/faqs
export async function adminFaqs(req, res) {
  const faqs = sortFaqs(await Faq.find().lean());
  res.json({ faqs, groups: FAQ_GROUPS });
}

// POST /api/admin/faqs  { question, answer, group, order, showOnHome }
export async function createFaq(req, res) {
  requireFields(req.body, ['question', 'answer']);
  const data = readFaq(req.body);
  if (data.order === undefined) {
    const last = await Faq.findOne({ group: data.group || 'shopping' }).sort({ order: -1 }).select('order').lean();
    data.order = (last?.order || 0) + 1;
  }
  const faq = await Faq.create(data);
  res.status(201).json({ faq });
}

// PUT /api/admin/faqs/:id
export async function updateFaq(req, res) {
  const faq = await Faq.findById(assertId(req.params.id, 'question'));
  if (!faq) throw new AppError('Question not found', 404);
  Object.assign(faq, readFaq(req.body));
  await faq.save();
  res.json({ faq });
}

// DELETE /api/admin/faqs/:id
export async function deleteFaq(req, res) {
  await Faq.deleteOne({ _id: assertId(req.params.id, 'question') });
  res.json({ message: 'Question deleted' });
}
