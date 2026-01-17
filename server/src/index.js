import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import cors from 'cors';
import morgan from 'morgan';

import { connectDb } from './lib/db.js';
import { ensureAuth } from './lib/auth.js';
import { initPassport } from './lib/passport.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import budgetRoutes from './routes/budget.js';
import importRoutes from './routes/import.js';
import accountRoutes from './routes/account.js';

const app = express();

// Safe dev defaults (prevents the server from crashing with "refused to connect")
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const MONGODB_URI = process.env.MONGODB_URI;

let mongoReady = false;

// Connect to MongoDB if configured; otherwise start anyway (useful for debugging OAuth)
try {
  if (MONGODB_URI) {
    await connectDb();
    mongoReady = true;
  } else {
    console.warn('[Sandcastle] MONGODB_URI is not set. Skipping DB connection.');
  }
} catch (err) {
  console.error('[Sandcastle] Failed to connect to MongoDB. Server will still start for debugging.');
  console.error(err);
}

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

// Build session config safely so the server can still start even if Mongo is misconfigured
const sessionConfig = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

if (mongoReady) {
  try {
    const store = MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: 'sessions',
    });
    store.on('error', (err) => {
      console.error('[Sandcastle] Mongo session store error. Falling back to MemoryStore.');
      console.error(err);
    });
    sessionConfig.store = store;
  } catch (err) {
    console.error('[Sandcastle] Failed to initialize Mongo session store. Falling back to MemoryStore.');
    console.error(err);
  }
} else {
  console.warn('[Sandcastle] Sessions are using MemoryStore (no MongoDB connection).');
}

app.use(session(sessionConfig));

initPassport();
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    port: PORT,
    clientOrigin: CLIENT_ORIGIN,
    hasMongo: Boolean(MONGODB_URI),
  });
});

app.use('/auth', authRoutes);
app.use('/api/categories', ensureAuth, categoryRoutes);
app.use('/api/transactions', ensureAuth, transactionRoutes);
app.use('/api/budget', ensureAuth, budgetRoutes);
app.use('/api/import', ensureAuth, importRoutes);
app.use('/api/account', ensureAuth, accountRoutes);

app.listen(PORT, () => {
  console.log(`[Sandcastle] server listening on http://localhost:${PORT}`);
  console.log(`[Sandcastle] expected frontend: ${CLIENT_ORIGIN}`);
  console.log(`[Sandcastle] health check: http://localhost:${PORT}/health`);
});
