# Sandcastle

MERN budget + expense tracker with Gmail import.

## Quick start

1) Create `.env` files from the examples:

- `server/.env.example` -> `server/.env`
- `client/.env.example` -> `client/.env`

2) Install deps in each package:

```
cd server
npm install

cd ../client
npm install
```

3) Run dev servers:

```
cd server
npm run dev

cd ../client
npm run dev
```

The server runs on `http://localhost:4000` and the client on `http://localhost:5173`.

## Google OAuth setup

1) Create OAuth credentials in Google Cloud Console.
2) Add `http://localhost:4000/auth/google/callback` to Authorized redirect URIs.
3) Use the client ID/secret in `server/.env`.
4) Enable Gmail API for the project.
