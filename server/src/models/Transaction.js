import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true },
    merchant: { type: String },
    recipient: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'SGD' },
    occurredAt: { type: Date, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    source: { type: String, enum: ['manual', 'gmail'], default: 'manual' },
    messageId: { type: String },
    threadId: { type: String },
    needsReview: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

TransactionSchema.index(
  { userId: 1, messageId: 1 },
  {
    unique: true,
    partialFilterExpression: { messageId: { $exists: true, $ne: null } },
  }
);

export default mongoose.model('Transaction', TransactionSchema);
