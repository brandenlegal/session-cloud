# Session Cloud

Web-based audio file management for production sessions (MVP in progress).

## Stack

- **Client:** React, Vite, Tailwind CSS v4, Axios, react-hot-toast  
- **Server:** Node.js, Express (nodemon in dev), Prisma + PostgreSQL, JWT auth  
- **Server deps (also used later):** bcryptjs, jsonwebtoken, multer  

## Database (Supabase or Railway)

Session Cloud uses **PostgreSQL** via Prisma. Use a hosted provider so you do not need Postgres installed locally.

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings** → **Database**.
3. Under **Connection string**, choose **URI** and copy it. Replace `[YOUR-PASSWORD]` with your database password (you can reset it on the same screen).

**Direct vs pooler**

- **Direct** (typical form): `postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres` — often best for **`npx prisma migrate dev`** from your laptop.
- If the dashboard says **“Not IPv4 compatible”** and you are on an **IPv4-only** network, use the **Session pooler** connection string from the same page (different host, often port **6543**), or enable Supabase’s **IPv4 add-on**.

4. Put the final value in `server/.env` as one line: `DATABASE_URL="postgresql://..."` (no leading spaces before `DATABASE_URL`).
5. From `server/`:

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

**Optional — Supabase Agent Skills for AI tools** (Cursor, Codex, etc.):

```bash
npx skills add supabase/agent-skills
```

### Supabase CLI (`supabase login`, `init`, `link`)

From the **repository root** (`session-cloud/`), use the [Supabase CLI](https://supabase.com/docs/guides/cli) for remote DB commands (`db pull`, `db push`, etc.):

```bash
npx supabase login
```

Opens a browser to authenticate (or set `SUPABASE_ACCESS_TOKEN` from the Supabase dashboard for non-interactive use).

```bash
npx supabase init --yes
```

Creates `supabase/config.toml` (already done in this repo).

```bash
npx supabase link --project-ref tujtjbbbywhvmcukhntc --password "YOUR_DATABASE_PASSWORD"
```

Use your **database** password (Settings → Database), not the anon/service API keys. Add `--skip-pooler` if you need a direct Postgres connection for the link step.  
`link` requires a prior `login` (or `SUPABASE_ACCESS_TOKEN`); without it you will see: `Access token not provided`.

**Note:** The Node app still uses **`server/.env`** → `DATABASE_URL` for Prisma. The CLI `link` metadata is separate and used by `supabase db *` commands.

### Railway

1. Go to [railway.app](https://railway.app) and sign in.
2. **New project** → add **PostgreSQL**.
3. Copy **`DATABASE_URL`** from the service variables.
4. Set it in `server/.env`, then run the same `migrate dev` / `generate` / `npm run dev` commands as above.

If `DATABASE_URL` is missing or the database cannot be reached, auth routes respond with **503** and a JSON `error` instead of crashing.

## Troubleshooting: `/api/health` shows 500 or fails in the browser

### 1. Vite dev server log: `http proxy error` + `AggregateError`

That usually means the **browser never reached Express** — the Vite proxy could not open a TCP connection to the API (nothing listening on port **5000**, or a **localhost IPv4 vs IPv6** mismatch).

- In a **second terminal**, start the API: `cd server && npm run dev`.
- The dev proxy targets **`http://127.0.0.1:5000`** so it matches a typical Node listen on IPv4.
- Hit **`http://127.0.0.1:5000/api/health`** directly in the browser; you should see JSON `{ "ok": true, ... }`. If that fails, the server is not running or is on another port.

### 2. Server terminal: `PrismaClientInitializationError` / `Can't reach database server`

That affects **auth** routes (database queries), not the health handler itself. Set **`DATABASE_URL`** in `server/.env`, then run `npx prisma migrate dev` and `npx prisma generate`.

### Local PostgreSQL (optional)

Install Postgres, create a database, set `DATABASE_URL` in `server/.env`, then run `npx prisma migrate dev` and `npx prisma generate`.

## Quick start

### Server

```bash
cd server
cp .env.example .env
# Set DATABASE_URL (Supabase or Railway), JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGIN — see .env.example
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Prisma migrations (important)

- **`.env` format:** `DATABASE_URL` must start at the beginning of the line (no leading spaces), or `dotenv` may not load it.
- **Windows / PowerShell:** if `Get-ChildItem Env:DATABASE_URL` shows a value (e.g. old `localhost`), it **overrides** `.env`. Clear it for the session before migrating:
  ```powershell
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  cd server
  npx prisma migrate dev --name add_user_model
  npx prisma generate
  ```
- **Supabase pooler (port 6543):** if `migrate dev` hangs, use the **direct** connection string (host `db.<ref>.supabase.co`, port **5432**) from the same Supabase screen for migrations, then switch back to the pooler URL for the app if you prefer.

If migration files are already in `prisma/migrations/` and you only need to apply them (e.g. CI / production):

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

Runs at `http://localhost:5000` (or `PORT` in `.env`).

**Auth API**

- `POST /api/auth/register` — body: `{ email, username, password }`  
- `POST /api/auth/login` — body: `{ email, password }`  
- `GET /api/auth/me` — header: `Authorization: Bearer <jwt>`  
- `GET /api/health` — public health check  

### Client

```bash
cd client
cp .env.example .env
# Dev: leave VITE_API_URL empty so /api is proxied to the server (see vite.config.js)
npm install
npm run dev
```

Open the app (usually `http://localhost:5173`). Use **Register** / **Sign in**, then **Dashboard** (calls `/api/auth/me` to verify the JWT).

### Production client

Set `VITE_API_URL` to your API origin (no trailing slash).

## Repo layout

```
session-cloud/
├── client/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── lib/          # api.js (axios), auth.js (token helpers)
│       └── hooks/        # useAuth.js
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── lib/          # Prisma client singleton
│   │   └── server.js
│   ├── prisma/
│   └── uploads/
└── README.md
```

## Prisma

Schema: `server/prisma/schema.prisma` (PostgreSQL). Migrations live under `server/prisma/migrations/`.

## Production & Hostinger

- **Full deployment guide:** [README-DEPLOY.md](./README-DEPLOY.md) (SSL, DNS, env vars, Hostinger Node, uploads, reverse proxy).
- **Client production env:** copy `client/.env.production.example` → `client/.env.production` and set `VITE_API_URL` to your public API origin (e.g. `https://vault.brandensolutions.cc`).
- **Server:** set `NODE_ENV=production`, `CLIENT_ORIGIN`, `JWT_SECRET`, `DATABASE_URL`, `UPLOAD_DIR`, and optional `PUBLIC_SHARE_BASE_URL`. The API uses **Helmet**, **gzip** (except audio streams), and **rate limits** on `/api` and auth routes.

Production database:

```bash
npx prisma migrate deploy
```
