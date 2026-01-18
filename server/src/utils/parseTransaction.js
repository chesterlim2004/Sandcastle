const amountRegex = /SGD\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

const decodeBase64Url = (input = '') => {
  if (!input) return '';
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const collectBodyText = (payload) => {
  if (!payload) return '';
  const { mimeType, body, parts } = payload;
  let text = '';
  if (body?.data) {
    text += ` ${decodeBase64Url(body.data)}`;
  }
  if (Array.isArray(parts)) {
    for (const part of parts) {
      text += ` ${collectBodyText(part)}`;
    }
  }
  if (mimeType && mimeType.startsWith('text/') && body?.data) {
    text += ` ${decodeBase64Url(body.data)}`;
  }
  return text;
};

export function parseGmailTransaction(message) {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h) => h.name === 'Subject')?.value || '';
  const from = headers.find((h) => h.name === 'From')?.value || '';
  const dateHeader = headers.find((h) => h.name === 'Date')?.value || '';
  const snippet = message.snippet || '';

  const bodyText = collectBodyText(message.payload);
  const content = `${subject} ${snippet} ${bodyText}`;
  const textContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&zwnj;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const toMatch = textContent.match(/To:\s*([^]+?)(?=From:|If unauthorised|To view|$)/i);
  const to = toMatch ? toMatch[1].trim() : '';
  const lower = content.toLowerCase();
  const receiveKeywords = ['receive', 'received', 'receiving', 'credit', 'credited'];
  if (receiveKeywords.some((keyword) => lower.includes(keyword))) {
    return null;
  }
  const amountLineMatches = Array.from(
    textContent.matchAll(/Amount:\s*SGD\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi)
  );
  const amountLineMatch =
    amountLineMatches.find((match) => /\.\d{2}$/.test(match[1])) ||
    amountLineMatches[amountLineMatches.length - 1];
  const amountMatch = amountLineMatch || textContent.match(amountRegex);
  const amount = amountMatch
    ? Math.round(Number.parseFloat(amountMatch[1].replace(/,/g, '')) * 100) / 100
    : null;

  const occurredAtRaw = message.internalDate
    ? new Date(Number(message.internalDate))
    : dateHeader
      ? new Date(dateHeader)
      : new Date();
  const occurredAt = occurredAtRaw;
  const name = to || 'Gmail import';

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
