import { Router } from 'express';
import { z } from 'zod';
import Budget from '../models/Budget.js';

const router = Router();

router.get('/', async (req, res) => {
  const budget = await Budget.findOne({ userId: req.user._id });
  res.json({ budget: budget || { monthlyTotal: 0 } });
});

router.put('/', async (req, res) => {
  const parsed = z.object({ monthlyTotal: z.number().min(0) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const budget = await Budget.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { monthlyTotal: parsed.data.monthlyTotal } },
    { upsert: true, new: true }
  );
  res.json({ budget });
});

export default router;
