# Flowvane

**Flowvane** is a collaborative project and task workspace built from the TaskPilot AI project. It brings project planning, team coordination, shared notes, diagrams, and workspace-aware AI assistance into one app.

The interface supports light and true-black dark themes, a collapsible navigation rail, and a responsive project dashboard. The app is a portfolio project; a hosted production environment has not been configured yet.

## What it does

- **Projects and tasks:** project progress, a drag-and-drop task board, subtasks, dependencies, labels, custom fields, time tracking, reminders, and attachments.
- **Team workspaces:** workspace membership and roles, general and project chat, direct messages, presence, and notifications.
- **Project knowledge:** searchable notes that can link to projects, tasks, and diagrams, plus a diagram studio.
- **AI assistant:** workspace-aware project help, saved conversations and memories, and task proposals that require confirmation before a task is created or updated.
- **Usage controls:** configurable AI request quotas for workspaces and standalone requests. Platform-level controls are restricted to the configured administrator account.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Motion, React Router |
| Backend | Node.js, Express, Socket.IO |
| Data | PostgreSQL, Prisma |
| AI | Google Gemini API (optional; configured on the backend) |

## Run locally

You need Node.js, npm, and a running PostgreSQL database. Start the database before the API.

### 1. Configure the backend

From the repository root in PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set `DATABASE_URL` to your PostgreSQL database and replace `JWT_SECRET` with a long random value. `GEMINI_API_KEY` is optional and belongs only in `backend/.env`; do not put it in the frontend or commit it.

### 2. Install, migrate, and start the API

```powershell
Set-Location backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The API listens on `http://127.0.0.1:5000` by default. `GET /api/health` checks process liveness and `GET /api/health/ready` also checks the database connection.

### 3. Start the frontend

In a second terminal at the repository root:

```powershell
Copy-Item frontend/.env.example frontend/.env
Set-Location frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The default frontend API URL targets `http://127.0.0.1:5000/api`.

## Useful commands

```powershell
# frontend/
npm run lint
npm run build

# backend/
npx prisma migrate status
npm run db:backup
```

The backup command requires PostgreSQL's `pg_dump` and `pg_restore` on `PATH` (or their paths set in the environment). Backups are written to the ignored `backups/` directory and must not be committed.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `JWT_SECRET` | Backend | Signs authentication tokens; use a strong private value |
| `FRONTEND_URL` | Backend | Exact browser origin allowed by CORS |
| `GEMINI_API_KEY` | Backend | Enables AI features; optional |
| `TRUST_PROXY_HOPS` | Backend | Number of trusted reverse-proxy hops; defaults to `0` |
| `VITE_API_URL` | Frontend | Optional API URL override; this value is public in the built app |

See [deployment preparation](docs/DEPLOYMENT.md) for reverse-proxy, hosting, and production configuration notes, and [operations](docs/OPERATIONS.md) for database backup and recovery guidance.

## Repository layout

```text
backend/       Express API, Prisma schema/migrations, and database operations
frontend/      React application and Vite build
docs/          Deployment preparation and operations guidance
```

## Current release status

- Local development and production frontend builds are configured.
- PostgreSQL migrations and health endpoints are included.
- No production hosting provider, public demo, production domain, or hosted database is configured in this repository.
- The backend package does not yet define an automated test suite.
