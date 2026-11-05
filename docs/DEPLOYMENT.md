# Deployment preparation

The app can be deployed as a static Vite frontend and a separate Node.js API. No provider-specific configuration is included yet.

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

## Not yet configured

There is no selected hosting provider, managed PostgreSQL instance, production domain, TLS setup, external log retention, or alerting integration in this repository. The local backup and recovery procedure is documented in [OPERATIONS.md](./OPERATIONS.md); production backups should be stored outside the app host and recovery should be rehearsed against a separate database before cutover.
