import { answer, cleanMemory } from '../services/assistant.js';
import { AssistantChat } from '../models/index.js';
import { CHAT_HISTORY_LIMIT } from '../models/AssistantChat.js';

// POST /api/assistant  { message, memory?, lang? }  (lang 'ur': answers in Urdu)
// Signed-in users: history and memory are kept in the database.
// Guests: the page keeps them in the browser and sends the memory back with each message.
export async function chat(req, res) {
  const message = String(req.body?.message || '').trim().slice(0, 300);
  const saved = req.user ? await AssistantChat.findOne({ user: req.user._id }) : null;
  const memory = req.user ? (saved?.toObject().memory ?? {}) : cleanMemory(req.body?.memory);
  const result = await answer(message, req.user, memory, { lang: req.body?.lang });

  if (req.user && message) {
    const chat = saved || new AssistantChat({ user: req.user._id, messages: [] });
    chat.messages.push({ from: 'me', text: message }, { from: 'bot', text: result.reply, cards: result.cards });
    if (chat.messages.length > CHAT_HISTORY_LIMIT) chat.messages.splice(0, chat.messages.length - CHAT_HISTORY_LIMIT);
    chat.memory = result.memory;
    await chat.save();
  }
  res.json(result);
}

// GET /api/assistant/history
export async function history(req, res) {
  if (!req.user) return res.json({ messages: [], memory: {}, saved: false });
  const chat = await AssistantChat.findOne({ user: req.user._id }).lean();
  res.json({ messages: chat?.messages || [], memory: cleanMemory(chat?.memory), saved: true });
}

// DELETE /api/assistant/history  - clears the conversation and what the assistant remembers
export async function clearHistory(req, res) {
  if (req.user) await AssistantChat.deleteOne({ user: req.user._id });
  res.json({ message: 'Chat history cleared' });
}
