import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backupDirectory = path.resolve(scriptDirectory, "../../backups");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Set it in backend/.env or the environment.");
  process.exit(1);
}

let database;
try {
  database = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("unsupported protocol");
} catch {
  console.error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  process.exit(1);
}

const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ""));
if (!database.hostname || !databaseName) {
  console.error("DATABASE_URL must include a PostgreSQL host and database name.");
  process.exit(1);
}

const executable = process.env.PG_DUMP_PATH || "pg_dump";
const restoreExecutable = process.env.PG_RESTORE_PATH || "pg_restore";
const stamp = new Date().toISOString().replaceAll(/[-:]/g, "").replace("T", "-").replace("Z", "Z");
const finalPath = path.join(backupDirectory, `taskpilot-${stamp}.dump`);
const partialPath = `${finalPath}.partial`;
const pgEnvironment = { ...process.env };
if (database.password) pgEnvironment.PGPASSWORD = decodeURIComponent(database.password);
if (database.searchParams.has("sslmode")) pgEnvironment.PGSSLMODE = database.searchParams.get("sslmode");

function run(executablePath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { env: pgEnvironment, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${path.basename(executablePath)} exited with code ${code}.`));
    });
  });
}

const connectionArgs = [
  "--host", database.hostname,
  "--port", database.port || "5432",
  "--username", decodeURIComponent(database.username),
  "--dbname", databaseName,
  "--no-password"
];

try {
  await mkdir(backupDirectory, { recursive: true });
  await run(executable, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    ...connectionArgs,
    "--file", partialPath
  ]);
  await run(restoreExecutable, ["--list", partialPath]);
  await rename(partialPath, finalPath);
  console.log(`Backup created and verified: ${finalPath}`);
} catch (error) {
  await rm(partialPath, { force: true }).catch(() => {});
  console.error(`Database backup failed: ${error.message}`);
  process.exitCode = 1;
}
