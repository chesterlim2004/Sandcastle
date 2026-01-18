import mongoose from 'mongoose';

const BudgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    monthlyTotal: { type: Number, default: 0 },
    categoryCaps: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model('Budget', BudgetSchema);
