import mongoose from 'mongoose';

const TokenSchema = new mongoose.Schema(
  {
    accessToken: { type: String },
    refreshToken: { type: String },
    expiryDate: { type: Date },
    scope: { type: String },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String },
    avatar: { type: String },
    oauth: TokenSchema,
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
