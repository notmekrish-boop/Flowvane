
import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import "dotenv/config";

import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import { authenticateToken } from "./middleware/authMiddleware.js";
import { aiUsageRateLimit } from "./middleware/rateLimit.js";
import taskRoutes from "./routes/tasks.js";
import notificationRoutes from "./routes/notifications.js";
import aiRoutes from "./routes/ai.js";
import conversationRoutes from "./routes/conversations.js";
import memoryRoutes from "./routes/memories.js";
import profileRoutes from "./routes/profile.js";
import notesRoutes from "./routes/notes.js";
import diagramsRoutes from "./routes/diagrams.js";
import { startTaskReminderScheduler } from "./services/taskReminders.js";
import taskAttachmentRoutes from "./routes/taskAttachments.js";
import projectChatRoutes from "./routes/projectChat.js";
import { initializeProjectChatSockets } from "./realtime/projectChatSocket.js";
import workspaceRoutes from "./routes/workspaces.js";
import workspaceChatRoutes from "./routes/workspaceChat.js";
import directMessageRoutes from "./routes/directMessages.js";
import messageSearchRoutes from "./routes/messageSearch.js";
import platformAdminRoutes from "./routes/platformAdmin.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
app.use(requestLogger);

const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "0");
if (Number.isInteger(trustedProxyHops) && trustedProxyHops >= 0 && trustedProxyHops <= 10) {
  app.set("trust proxy", trustedProxyHops);
}

// Allow the configured frontend plus local Vite ports during development.
const configuredFrontendOrigin = process.env.FRONTEND_URL;
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === configuredFrontendOrigin) {
        callback(null, true);
        return;
      }

      try {
        const { hostname, protocol } = new URL(origin);
        const isLocalDevelopmentOrigin =
          process.env.NODE_ENV !== "production" &&
          protocol === "http:" &&
          (hostname === "localhost" || hostname === "127.0.0.1");

        callback(null, isLocalDevelopmentOrigin);
      } catch {
        callback(null, false);
      }
    },
  })
);

app.use(express.json({ limit: "5mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", authenticateToken, projectRoutes);
app.use("/api/workspaces", authenticateToken, workspaceRoutes);
app.use("/api/workspace-chat", authenticateToken, workspaceChatRoutes);
app.use("/api/direct-messages", authenticateToken, directMessageRoutes);
app.use("/api/search", authenticateToken, messageSearchRoutes);
app.use("/api/platform-admin", authenticateToken, platformAdminRoutes);
app.use("/api/tasks/:taskId/attachments", authenticateToken, taskAttachmentRoutes);
app.use("/api/tasks", authenticateToken, taskRoutes);
app.use("/api/notifications", authenticateToken, notificationRoutes);
app.use("/api/ai", authenticateToken, aiUsageRateLimit, aiRoutes);
app.use("/api/conversations", authenticateToken, conversationRoutes);
app.use("/api/memories", authenticateToken, memoryRoutes);
app.use("/api/profile", authenticateToken, profileRoutes);
app.use("/api/notes", authenticateToken, notesRoutes);
app.use("/api/diagrams", authenticateToken, diagramsRoutes);
app.use("/api/project-chat", authenticateToken, projectChatRoutes);

// Liveness: confirms that the process is running without depending on PostgreSQL.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: confirms PostgreSQL is available before traffic is routed to this process.
async function databaseReadiness(req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      status: "ready",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(JSON.stringify({
      type: "readiness_check_failed",
      requestId: req.requestId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    res.status(500).json({
      success: false,
      status: "not_ready",
      checks: { database: "error" },
    });
  }
}

app.get("/api/health/ready", databaseReadiness);
// Preserve the existing database health endpoint for current local tooling.
app.get("/api/health/db", databaseReadiness);

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "127.0.0.1";
const httpServer = createServer(app);
const socketServer = initializeProjectChatSockets(httpServer, configuredFrontendOrigin);

async function startServer() {
  try {
    await prisma.$connect();

    console.log(JSON.stringify({ type: "database_connected", timestamp: new Date().toISOString() }));
    startTaskReminderScheduler();

    httpServer.listen(PORT, HOST, () => {
      console.log(JSON.stringify({ type: "server_started", port: Number(PORT), host: HOST, timestamp: new Date().toISOString() }));
    });
  } catch (error) {
    console.error(JSON.stringify({ type: "server_start_failed", error: error.message, timestamp: new Date().toISOString() }));
    process.exit(1);
  }
}

startServer();

let shuttingDown = false;
async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ type: "server_shutdown_started", signal, timestamp: new Date().toISOString() }));

  const forceTimer = setTimeout(() => {
    console.error(JSON.stringify({ type: "server_shutdown_timeout", signal, timestamp: new Date().toISOString() }));
    httpServer.closeAllConnections?.();
    void prisma.$disconnect().finally(() => process.exit(1));
  }, 10_000);
  forceTimer.unref?.();

  try {
    await new Promise((resolve) => socketServer.close(resolve));
    await prisma.$disconnect();
    clearTimeout(forceTimer);
    process.exit(exitCode);
  } catch (error) {
    console.error(JSON.stringify({ type: "server_shutdown_failed", error: error.message, timestamp: new Date().toISOString() }));
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ type: "unhandled_rejection", error: reason?.message || String(reason), timestamp: new Date().toISOString() }));
  void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  console.error(JSON.stringify({ type: "uncaught_exception", error: error.message, timestamp: new Date().toISOString() }));
  void shutdown("uncaughtException", 1);
});
