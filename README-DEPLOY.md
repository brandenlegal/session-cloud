# Session Cloud — Production deployment (Hostinger)

This guide targets a **single domain** (`https://vault.brandensolutions.cc`) where the **browser loads the Vite-built SPA** from static hosting and talks to the **Node API** on the same host (recommended: reverse proxy `/api` → Express).

## Architecture options

### Option A — One Node process (recommended for Hostinger Node hosting)

1. Build the client: `cd client && npm ci && npm run build`.
2. Deploy **server** + copy **`client/dist`** into the server tree (e.g. `server/public/`).
3. Serve static files from Express for non-`/api` routes and `index.html` for SPA fallback (add a few lines to `server.js` when you are ready), **or** use Hostinger to serve `dist/` and proxy only `/api` to Node.

### Option B — Static site + separate API subdomain

- `https://vault.brandensolutions.cc` → static `dist/`  
- `https://api.vault...` → Node (set `VITE_API_URL` to the API origin and configure **CORS** + **CLIENT_ORIGIN** accordingly).

Below assumes **Option A** with one origin unless noted.

---

## 1. DNS & SSL (Hostinger)

1. In Hostinger **Domains** → **DNS / Nameservers**, point **vault.brandensolutions.cc** to your hosting (A record to server IP or CNAME to Hostinger parking as instructed).
2. In **SSL**, enable **Let’s Encrypt** (or Hostinger free SSL) for `vault.brandensolutions.cc`.
3. Force **HTTPS** redirect in the panel if available.

---

## 2. Database (Supabase)

1. Create a Supabase project and copy **`DATABASE_URL`** (URI form). Prefer the **connection pooler** if you are on IPv4-only networks.
2. From your laptop (or CI), apply schema:

```bash
cd server
npx prisma db push
npx prisma generate
```

3. Put **`DATABASE_URL`** in Hostinger **Environment variables** (never commit real secrets).

---

## 3. Environment variables (production)

### Server (Hostinger / `.env`)

| Variable | Example | Notes |
|----------|---------|--------|
| `NODE_ENV` | `production` | Enables stricter errors, Helmet, compression filters. |
| `PORT` | `5000` | Or the port Hostinger assigns to your Node app. |
| `DATABASE_URL` | `postgresql://...` | Supabase / Postgres. |
| `JWT_SECRET` | long random string | **Rotate** if leaked. |
| `JWT_EXPIRES_IN` | `7d` | Optional. |
| `CLIENT_ORIGIN` | `https://vault.brandensolutions.cc` | Comma-separated if multiple origins. |
| `UPLOAD_DIR` | `./uploads` | Must be **writable** by the Node user. |
| `MAX_FILE_SIZE` | `104857600` | 100 MB default in repo. |
| `PUBLIC_SHARE_BASE_URL` | `https://vault.brandensolutions.cc` | Optional; absolute URLs in share API responses. |

### Client build-time (`client/.env.production`)

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://vault.brandensolutions.cc` |

If the API is on another subdomain, set `VITE_API_URL` to that origin (must be allowed by **CORS** on the server).

Copy from `client/.env.production.example`, then:

```bash
cd client
npm ci
npm run build
```

---

## 4. Hostinger Node.js application

1. **Node version:** 18+ or 20 LTS (16+ minimum).
2. **Application root:** point to your deployed **`server/`** folder (contains `package.json`, `src/`, `prisma/`).
3. **Start command:** `npm run start` (or `node src/server.js`).
4. **Install command:** `npm ci --omit=dev` (production) then `npx prisma generate` (needs `prisma` — either keep `prisma` in dependencies or run generate in your deploy pipeline before upload).
5. Create **`uploads/`** next to the app (or under `UPLOAD_DIR`) and set **write** permissions for the process user.

---

## 5. Reverse proxy (same domain)

Configure the web server so that:

- `GET /api/*` → Node (preserve **Range** header for audio streams).
- `GET /*` → static files from `client/dist` (or Express static).

**Important:** streaming responses must **not** be fully buffered by the proxy. Increase **timeouts** for large uploads if needed.

---

## 6. Pre-deploy checklist

- [ ] `DATABASE_URL` set; `npx prisma db push` applied to production DB.
- [ ] `JWT_SECRET` set to a strong random value.
- [ ] `CLIENT_ORIGIN` matches the exact browser origin (scheme + host, no trailing slash).
- [ ] `client` built with `VITE_API_URL` pointing at the live API.
- [ ] `uploads/` exists and is writable.
- [ ] SSL active; site opens only over HTTPS.
- [ ] Smoke test: register, login, upload, play, share link in private window, revoke share.

---

## 7. Local production smoke test

```bash
# Terminal 1 — API (production-like)
cd server
set NODE_ENV=production
npm run start

# Terminal 2 — static SPA against real API
cd client
npm run build
npm run preview
```

Ensure `VITE_API_URL` in `.env.production` matches how the browser reaches the API (often `http://127.0.0.1:5000` for local API + preview with CORS).

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| CORS errors | `CLIENT_ORIGIN` missing or wrong scheme/host. |
| 401 on streams | JWT missing/expired; check `Authorization` / `access_token` query. |
| Upload 413 | `MAX_FILE_SIZE` or reverse-proxy body limit too low. |
| Share / Prisma errors | Run `npx prisma generate` on the server after deploy; restart Node. |
| Slow first byte on audio | Proxy buffering; confirm Range requests and disable buffering for `/api/*/stream`. |

---

## 9. Security notes (implemented in repo)

- **Helmet** security headers (production).
- **gzip** compression for JSON/text (streaming routes skipped).
- **Rate limits** on auth and general `/api` traffic.
- **Trust proxy** when behind Hostinger reverse proxy (for accurate client IPs in rate limits).

Rotate `JWT_SECRET` and invalidate sessions if compromised. Keep uploads outside web-public roots if you ever serve raw files by path.
