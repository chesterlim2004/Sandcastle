import { Router } from 'express';
import passport from 'passport';

const router = Router();

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'offline',
    prompt: 'consent',
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failed',
    session: true,
  }),
  (req, res) => {
    res.redirect(process.env.CLIENT_ORIGIN);
  }
);

router.get('/failed', (req, res) => {
  res.status(401).json({ error: 'OAuth failed' });
});

router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session?.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { _id, name, email, avatar } = req.user;
  res.json({ user: { _id, name, email, avatar } });
});

export default router;
