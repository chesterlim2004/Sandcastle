import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Transaction from '../models/Transaction.js';
import { getGmailClient } from '../services/gmail.js';
import { parseGmailTransaction } from '../utils/parseTransaction.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 1000 * 60,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', limiter, async (req, res) => {
  const gmail = getGmailClient(req.user);

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: '(PayNow OR PayLah) newer_than:30d',
    maxResults: 25,
  });

  const messages = list.data.messages || [];
  const imported = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const parsed = parseGmailTransaction(detail.data);
    if (!parsed || !parsed.amount) {
      continue;
    }
    imported.push(parsed);
  }

  const writes = imported.map((item) => ({
    updateOne: {
      filter: { userId: req.user._id, messageId: item.messageId },
      update: { $setOnInsert: { ...item, userId: req.user._id } },
      upsert: true,
    },
  }));

  if (writes.length) {
    await Transaction.bulkWrite(writes);
  }

  res.json({ imported: writes.length });
});

export default router;
