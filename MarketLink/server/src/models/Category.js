import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true, unique: true, maxlength: 60 },
    nameUr: { type: String, trim: true, maxlength: 60 }, // the name in Urdu (optional)
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 300 },
    icon: { type: String }, // image path (small round photo in chips and filters)
    image: { type: String }, // wide photo for the category cards on the home page
    color: { type: String, default: '#E6F4DA' }, // pastel background used on cards
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Category', categorySchema);
