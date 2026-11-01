
import express from "express";
import cors from "cors";
import "dotenv/config";

import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import { authenticateToken } from "./middleware/authMiddleware.js";
import taskRoutes from "./routes/tasks.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/projects", authenticateToken, projectRoutes);
app.use("/api/tasks", authenticateToken, taskRoutes);

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
