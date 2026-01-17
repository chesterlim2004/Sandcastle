import { Router } from 'express';
import { z } from 'zod';
import Transaction from '../models/Transaction.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  merchant: z.string().optional(),
  recipient: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional(),
  occurredAt: z.string(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

router.get('/', async (req, res) => {
  const { categoryId } = req.query;
  const filter = { userId: req.user._id };
  if (categoryId === 'unsorted') {
    filter.categoryId = null;
  } else if (typeof categoryId === 'string') {
    filter.categoryId = categoryId;
  }
  const transactions = await Transaction.find(filter).sort({ occurredAt: -1 });
  res.json({ transactions });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const transaction = await Transaction.create({
    userId: req.user._id,
    ...parsed.data,
    occurredAt: new Date(parsed.data.occurredAt),
    source: 'manual',
  });
  res.status(201).json({ transaction });
});

router.patch('/:id', async (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const updates = { ...parsed.data };
  if (updates.occurredAt) {
    updates.occurredAt = new Date(updates.occurredAt);
  }
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: updates },
    { new: true }
  );
  if (!transaction) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ transaction });
});

router.delete('/:id', async (req, res) => {
  const transaction = await Transaction.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!transaction) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ ok: true });
});

router.post('/:id/move', async (req, res) => {
  const parsed = z
    .object({ categoryId: z.string().nullable() })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { categoryId: parsed.data.categoryId } },
    { new: true }
  );
  if (!transaction) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ transaction });
});

export default router;
