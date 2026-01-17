import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import User from '../models/User.js';
import { encrypt } from './crypto.js';

export function initPassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).lean();
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatar = profile.photos?.[0]?.value;
          const payload = {
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatar,
            oauth: {
              accessToken: encrypt(accessToken),
              refreshToken: encrypt(refreshToken),
              scope: profile._json?.scope,
              expiryDate: profile._json?.expiry_date
                ? new Date(profile._json.expiry_date)
                : undefined,
            },
          };

          const user = await User.findOneAndUpdate(
            { googleId: profile.id },
            { $set: payload },
            { upsert: true, new: true }
          );

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}
