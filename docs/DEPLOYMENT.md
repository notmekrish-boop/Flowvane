# Deployment preparation

The app is deployed as a static Vite frontend and a separate Node.js API. Vercel is the selected frontend provider; `frontend/vercel.json` includes the SPA fallback needed for client-side routes. The API remains a Node service because it runs Socket.IO and a minute-based reminder scheduler. `render.yaml` defines a free Render web service; use a free Neon PostgreSQL database for persistent data.

## Vercel frontend

Import the GitHub repository into Vercel and set the project **Root Directory** to `frontend`. Vercel should detect Vite; use these settings if it asks:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install` (or leave the detected default)

Set `VITE_API_URL` in the Vercel project's Production environment to the full API base URL, ending in `/api`, for example `https://api.example.com/api`. This is a public frontend setting, not a secret. Configure `FRONTEND_URL` on the API service to the production site's exact origin, without a path. Vercel preview domains need to be explicitly allowed by the API before preview builds can use authenticated API or Socket.IO features.

The frontend deployment is only ready to function once the API and PostgreSQL database are deployed and reachable. The API must support WebSocket upgrades for Socket.IO.

## Free Render API and Neon database

The root `render.yaml` is a Render Blueprint for the free web-service plan. Create a free Neon PostgreSQL project separately. Set Render's `DATABASE_URL` to Neon’s pooled connection string and `DIRECT_URL` to its direct connection string; Prisma uses the direct URL for migrations and the pooled URL for application traffic. The Blueprint runs `prisma migrate deploy` at service startup and generates `JWT_SECRET` automatically. During initial Blueprint setup, provide `FRONTEND_URL` as the exact Vercel production origin. `GEMINI_API_KEY` is optional and can be left blank if AI features are not enabled. Never put database URLs or API keys in the repository.

This is a free personal-project deployment, with cold-start tradeoffs: Render sleeps after 15 minutes without inbound traffic, and the next request can take about a minute to wake it. The in-process reminder scheduler pauses while the API sleeps and catches up when it wakes, so reminders are not timely during idle periods. Render's own free Postgres expires after 30 days, which is why this setup uses Neon instead. Neon currently includes 1 GB storage and 100 compute-hours per free project; watch its usage limits.

## Frontend and API URLs

All browser requests and Socket.IO connections use `frontend/src/lib/api.js`.

- In Vite development, the API defaults to `http://127.0.0.1:5000/api`.
- In a production build, it defaults to same-origin `/api`. Configure the frontend host's reverse proxy to forward `/api` and `/socket.io/` to the Node API, including WebSocket upgrade support.
- If the API is hosted on another domain, set `VITE_API_URL` to its full API URL, such as `https://api.example.com/api`, before building. This value is public in the generated frontend and must not contain secrets.

The backend `FRONTEND_URL` must be the exact browser origin, such as `https://app.example.com`, with no path. For local development, copy `backend/.env.example` to `backend/.env`; optionally copy `frontend/.env.example` to `frontend/.env`.

## Build and start

Run these commands from their respective directories after configuring environment variables:

```powershell
# backend/
npm ci
npx prisma generate
npx prisma migrate deploy
npm start
```

```powershell
# frontend/
npm ci
npm run build
```

Publish `frontend/dist` with a static host configured for SPA fallback to `index.html`. Run the backend as a long-lived Node service. On containers or managed hosts, set `HOST=0.0.0.0`; the local default is `127.0.0.1`. Set `NODE_ENV=production`, `FRONTEND_URL`, `DATABASE_URL`, and `JWT_SECRET` in the hosting provider's secret/configuration store. Add `GEMINI_API_KEY` to enable AI features. If the API is behind a reverse proxy, set `TRUST_PROXY_HOPS` to the number of trusted proxy hops so IP-based rate limits see the client IP; keep it at `0` when clients connect directly.

The Node service exposes `GET /api/health` for liveness and `GET /api/health/ready` for database readiness. Configure the hosting provider to restart the backend after a non-zero exit and use the readiness endpoint for traffic checks.

## Current deployment

The live portfolio deployment uses Vercel for the frontend, Render for the API, and Neon for PostgreSQL. The public app is [flowvane.vercel.app](https://flowvane.vercel.app); the API is [flowvane-api.onrender.com](https://flowvane-api.onrender.com). Keep credentials in each provider's private environment settings. Do not commit local `.env` files or production connection strings. The production database is separate from local development data, and local records are not automatically migrated.

This is a free personal-project deployment, so availability and performance depend on provider limits and may include a cold start. The local backup and recovery procedure is documented in [OPERATIONS.md](./OPERATIONS.md); keep an export of important data.
