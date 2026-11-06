# Flowvane frontend

The Flowvane client is a React single-page app built with Vite. For the full project overview, PostgreSQL setup, backend instructions, and deployment notes, see the [repository README](../README.md) and [deployment guide](../docs/DEPLOYMENT.md).

## Development

From this directory:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The local API defaults to `http://127.0.0.1:5000/api`. Set `VITE_API_URL` in `.env` only when the API uses another address. This value is public in the built assets and must not contain secrets.

## Quality checks

```powershell
npm run lint
npm run build
```

The production site is emitted to `dist/`. Configure the static host to serve `index.html` for app routes. When the API is on the same origin, proxy `/api` and `/socket.io/` to the Node service and enable WebSocket upgrades.
