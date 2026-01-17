import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true },
    color: { type: String, default: '#f59e0b' },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

CategorySchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', CategorySchema);
