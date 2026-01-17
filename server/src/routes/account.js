import { Router } from 'express';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';

const router = Router();

router.delete('/gmail', async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $set: { oauth: {} } }
  );
  res.json({ ok: true });
});

router.delete('/data', async (req, res) => {
  const userId = req.user._id;
  await Promise.all([
    Category.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    User.deleteOne({ _id: userId }),
  ]);

  req.logout(() => {
    req.session?.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

export default router;
