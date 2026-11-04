
import express from "express";
import cors from "cors";
import "dotenv/config";

import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import { authenticateToken } from "./middleware/authMiddleware.js";
import taskRoutes from "./routes/tasks.js";
import notificationRoutes from "./routes/notifications.js";
import aiRoutes from "./routes/ai.js";
import conversationRoutes from "./routes/conversations.js";
import memoryRoutes from "./routes/memories.js";
import profileRoutes from "./routes/profile.js";
import notesRoutes from "./routes/notes.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json({ limit: "5mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", authenticateToken, projectRoutes);
app.use("/api/tasks", authenticateToken, taskRoutes);
app.use("/api/notifications", authenticateToken, notificationRoutes);
app.use("/api/ai", authenticateToken, aiRoutes);
app.use("/api/conversations", authenticateToken, conversationRoutes);
app.use("/api/memories", authenticateToken, memoryRoutes);
app.use("/api/profile", authenticateToken, profileRoutes);
app.use("/api/notes", authenticateToken, notesRoutes);

// Basic health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "TaskPilot AI backend is running!",
    timestamp: new Date().toISOString(),
  });
});

// Database health check
app.get("/api/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "PostgreSQL database connected successfully!",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL database connected successfully!");

    app.listen(PORT, () => {
      console.log(`TaskPilot AI server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
