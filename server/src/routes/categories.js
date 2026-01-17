import { Router } from 'express';
import { z } from 'zod';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
});

router.get('/', async (req, res) => {
  const categories = await Category.find({ userId: req.user._id }).sort({ name: 1 });
  res.json({ categories });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const category = await Category.create({
    userId: req.user._id,
    ...parsed.data,
  });
  res.status(201).json({ category });
});

router.patch('/:id', async (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: parsed.data },
    { new: true }
  );
  if (!category) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ category });
});

router.delete('/:id', async (req, res) => {
  const category = await Category.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!category) {
    return res.status(404).json({ error: 'Not found' });
  }
  await Transaction.updateMany(
    { userId: req.user._id, categoryId: category._id },
    { $set: { categoryId: null } }
  );
  res.json({ ok: true });
});

export default router;
