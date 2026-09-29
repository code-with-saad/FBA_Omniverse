import mongoose from 'mongoose';

export const CHAT_HISTORY_LIMIT = 60; // messages kept per user

const cardSchema = new mongoose.Schema(
  { kind: String, id: String, title: String, subtitle: String, image: String, link: String },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['me', 'bot'], required: true },
    text: { type: String, required: true, maxlength: 4000 },
    cards: [cardSchema],
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * The AI assistant's saved conversation and memory for one signed-in user.
 * Memory holds what the conversation is about (last market, farmer, product, day)
 * and what the user told it (name, city) so follow-up questions can be answered.
 */
const assistantChatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages: [messageSchema],
    memory: {
      marketId: String,
      marketName: String,
      farmerId: String,
      farmerName: String,
      productId: String,
      productName: String,
      day: Number,
      city: String,
      name: String,
      lastIntent: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AssistantChat', assistantChatSchema);
