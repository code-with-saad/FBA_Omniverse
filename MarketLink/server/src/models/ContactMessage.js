import mongoose from 'mongoose';

export const CONTACT_TOPICS = ['market_request', 'market_complaint', 'farmer_complaint', 'order_help', 'selling', 'feedback', 'other'];

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: { type: String, required: [true, 'E-mail is required'], trim: true, lowercase: true, maxlength: 120 },
    subject: { type: String, trim: true, maxlength: 150 },
    // What the message is about (optional drop-down on the contact page)
    topic: { type: String, enum: CONTACT_TOPICS },
    message: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 2000 },
    status: { type: String, enum: ['new', 'read'], default: 'new' },
  },
  { timestamps: true }
);

export default mongoose.model('ContactMessage', contactMessageSchema);
