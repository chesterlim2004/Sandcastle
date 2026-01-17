const amountRegex = /(SGD|S\$)\s?([0-9]+(?:\.[0-9]{1,2})?)/i;

export function parseGmailTransaction(message) {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h) => h.name === 'Subject')?.value || '';
  const from = headers.find((h) => h.name === 'From')?.value || '';
  const dateHeader = headers.find((h) => h.name === 'Date')?.value || '';
  const snippet = message.snippet || '';

  const content = `${subject} ${snippet}`;
  const lower = content.toLowerCase();
  const receiveKeywords = ['receive', 'received', 'receiving', 'credit', 'credited'];
  if (receiveKeywords.some((keyword) => lower.includes(keyword))) {
    return null;
  }
  const amountMatch = content.match(amountRegex);
  const amount = amountMatch
    ? Math.round(Number.parseFloat(amountMatch[2]) * 100) / 100
    : null;

  const occurredAt = message.internalDate
    ? new Date(Number(message.internalDate))
    : dateHeader
      ? new Date(dateHeader)
      : new Date();
  const name = subject || 'Gmail import';

  return {
    name,
    merchant: from,
    amount,
    currency: 'SGD',
    occurredAt,
    source: 'gmail',
    messageId: message.id,
    threadId: message.threadId,
    needsReview: amount === null,
  };
}
