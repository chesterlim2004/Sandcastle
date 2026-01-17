import { Router } from 'express';
import { z } from 'zod';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  order: z.number().int().nonnegative().optional(),
});

router.get('/', async (req, res) => {
  const categories = await Category.find({ userId: req.user._id }).sort({ order: 1, name: 1 });
  res.json({ categories });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const latest = await Category.findOne({ userId: req.user._id }).sort({ order: -1 }).select('order');
  const nextOrder = latest?.order !== undefined ? latest.order + 1 : 0;
  const category = await Category.create({
    userId: req.user._id,
    ...parsed.data,
    order: parsed.data.order ?? nextOrder,
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

router.post('/reorder', async (req, res) => {
  const parsed = z
    .object({
      order: z.array(
        z.object({
          id: z.string().min(1),
          order: z.number().int().nonnegative(),
        })
      ),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const writes = parsed.data.order.map((item) => ({
    updateOne: {
      filter: { _id: item.id, userId: req.user._id },
      update: { $set: { order: item.order } },
    },
  }));

  if (writes.length) {
    await Category.bulkWrite(writes);
  }

  res.json({ ok: true });
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
