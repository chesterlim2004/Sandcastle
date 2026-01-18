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

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartQuery = `${monthStart.getFullYear()}/${String(
    monthStart.getMonth() + 1
  ).padStart(2, '0')}/${String(monthStart.getDate()).padStart(2, '0')}`;
  const query = `(PayNow OR PayLah) after:${monthStartQuery}`;

  const messages = [];
  let pageToken = undefined;
  do {
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500,
      pageToken,
    });
    const batch = list.data.messages || [];
    messages.push(...batch);
    pageToken = list.data.nextPageToken;
  } while (pageToken);
  const imported = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const parsed = parseGmailTransaction(detail.data);
    if (!parsed || !parsed.amount) {
      continue;
    }
    console.log('[Sandcastle][Gmail Import] content amount', {
      messageId: parsed.messageId,
      name: parsed.name,
      amount: parsed.amount,
    });
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
