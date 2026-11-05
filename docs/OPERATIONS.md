# Local database operations

## Create a PostgreSQL backup

From `backend/`, run:

```powershell
npm run db:backup
```

The command reads `DATABASE_URL` from `backend/.env` or the current environment. It uses `pg_dump` and `pg_restore` from `PATH`; set `PG_DUMP_PATH` or `PG_RESTORE_PATH` if PostgreSQL's `bin` directory is not on `PATH`. The connection password is passed through the child process environment and is not printed in the command output.

Backups are written to the repository's ignored `backups/` directory in PostgreSQL custom format. The script validates each dump with `pg_restore --list` before renaming it to its final `.dump` filename. Interrupted or failed dumps are removed. Keep the resulting files somewhere separate from the development machine for disaster recovery.

## Inspect a backup

```powershell
pg_restore --list ..\backups\taskpilot-<timestamp>.dump
```

The backup is a binary database archive. Do not commit it or attach it to public issues; it can contain account and project data.

## Restore to a separate database

Restore to a new, empty database first. This keeps the current database intact while you check that the archive is usable.

1. Create a separate database using pgAdmin or PostgreSQL's `createdb` utility.
2. Restore the archive, replacing the example host, user, database, and filename:

   ```powershell
   pg_restore --host 127.0.0.1 --port 5432 --username <database-user> --dbname <empty-restore-database> --no-password --no-owner --no-privileges --exit-on-error ..\backups\taskpilot-<timestamp>.dump
   ```

   With `--no-password`, `pg_restore` expects `PGPASSWORD` to be present in the process environment. For an interactive local restore, remove `--no-password` so libpq prompts for the password; avoid placing credentials directly in a command or script.

3. Check the restore with pgAdmin or `psql`, then point a separate copy of the application at that database and verify its API health endpoint and key workflows.
4. Only after reviewing the restored data should you plan a production cutover. Do not restore over the active database as a routine check.

The application uses Prisma migrations for schema evolution. For a fresh database, run `npx prisma migrate deploy` from `backend/` after configuring its `DATABASE_URL`.

## Current operational checks

- Backend liveness: `GET /api/health` (process only)
- Backend readiness: `GET /api/health/ready` (process and PostgreSQL)
- Legacy database check: `GET /api/health/db`
- Migration status: `npx prisma migrate status` from `backend/`

The server writes one structured JSON log line per HTTP request to stdout. Each line includes a request ID, method, path without query parameters, status, and duration. Request bodies, query strings, and client IP addresses are not included. The response returns the same ID in `X-Request-Id` so support reports can point to a server log entry. Startup, shutdown, readiness failures, and unhandled process errors are logged as JSON events. The process handles `SIGINT` and `SIGTERM` by closing Socket.IO connections and disconnecting Prisma; use a process supervisor or hosting platform to restart it after an unexpected exit.

These endpoints and logs provide basic health visibility; they do not replace external alerting, off-machine backups, retention management, or a tested recovery plan for a hosted production environment.

## Platform AI quotas

The platform administrator API is restricted to the account configured as the platform administrator in `backend/src/lib/platformAccess.js`. Workspace roles do not grant platform-level access.

- `GET /api/platform-admin/plans` lists the stored plans and assigned workspace counts.
- `PATCH /api/platform-admin/plans/:code` updates a plan's name, `aiRequestsPerWindow`, or `aiWindowSeconds`.
- `GET /api/platform-admin/workspaces?search=<name>` lists workspaces and their current plan.
- `PATCH /api/platform-admin/workspaces/:id/plan` assigns a plan using `{ "planCode": "FREE" }` (or another existing code).

Initial AI request quotas are Free: 20, Pro: 100, and Business: 500 requests per 10 minutes. Requests in a workspace share that workspace's quota. Standalone AI use without workspace context gets the Free quota per account. These are configurable request limits; this project does not implement billing, payment state, or automatic subscription changes.
