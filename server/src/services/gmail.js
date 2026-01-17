import { google } from 'googleapis';
import { decrypt } from '../lib/crypto.js';

export function getGmailClient(user) {
  const oauth = user.oauth || {};
  const accessToken = decrypt(oauth.accessToken);
  const refreshToken = decrypt(oauth.refreshToken);

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  auth.setCredentials({
    access_token: accessToken || undefined,
    refresh_token: refreshToken || undefined,
  });

  return google.gmail({ version: 'v1', auth });
}
