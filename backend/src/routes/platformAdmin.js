import express from "express";
import { prisma } from "../lib/prisma.js";
import { isPlatformAdministrator } from "../lib/platformAccess.js";

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    if (!(await isPlatformAdministrator(req.userId))) {
      return res.status(403).json({ success: false, message: "Platform administrator access required." });
    }
    return next();
  } catch (error) {
    console.error("Platform administrator check failed:", error);
    return res.status(503).json({ success: false, message: "Unable to verify platform administrator access." });
  }
});

router.get("/plans", async (_req, res) => {
  try {
    const plans = await prisma.planQuota.findMany({
      include: { _count: { select: { workspaces: true } } },
      orderBy: { code: "asc" }
    });
    return res.json({ success: true, plans });
  } catch (error) {
    console.error("Platform plan list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load plan quotas." });
  }
});

router.patch("/plans/:code", async (req, res) => {
  try {
    const current = await prisma.planQuota.findUnique({ where: { code: req.params.code } });
    if (!current) return res.status(404).json({ success: false, message: "Plan not found." });

    const updates = {};
    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name || name.length > 60) return res.status(400).json({ success: false, message: "Plan name must be between 1 and 60 characters." });
      updates.name = name;
    }
    if (req.body?.aiRequestsPerWindow !== undefined) {
      const limit = req.body.aiRequestsPerWindow;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100_000) {
        return res.status(400).json({ success: false, message: "AI request quota must be an integer between 1 and 100,000." });
      }
      updates.aiRequestsPerWindow = limit;
    }
    if (req.body?.aiWindowSeconds !== undefined) {
      const seconds = req.body.aiWindowSeconds;
      if (!Number.isInteger(seconds) || seconds < 60 || seconds > 86_400) {
        return res.status(400).json({ success: false, message: "Quota window must be between 60 and 86,400 seconds." });
      }
      updates.aiWindowSeconds = seconds;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "Provide a plan name or quota setting to update." });

    const plan = await prisma.planQuota.update({ where: { code: current.code }, data: updates });
    return res.json({ success: true, plan });
  } catch (error) {
    console.error("Platform plan update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update plan quota." });
  }
});

router.get("/workspaces", async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
    const workspaces = await prisma.workspace.findMany({
      where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
      select: {
        id: true,
        name: true,
        planCode: true,
        plan: { select: { name: true, aiRequestsPerWindow: true, aiWindowSeconds: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return res.json({ success: true, workspaces });
  } catch (error) {
    console.error("Platform workspace list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load workspaces." });
  }
});

router.patch("/workspaces/:id/plan", async (req, res) => {
  try {
    const planCode = typeof req.body?.planCode === "string" ? req.body.planCode.trim().toUpperCase() : "";
    const plan = await prisma.planQuota.findUnique({ where: { code: planCode } });
    if (!plan) return res.status(400).json({ success: false, message: "Choose an existing plan code." });
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: { planCode },
      select: { id: true, name: true, planCode: true, plan: { select: { name: true, aiRequestsPerWindow: true, aiWindowSeconds: true } } }
    });
    return res.json({ success: true, workspace });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "Workspace not found." });
    console.error("Platform workspace plan update error:", error);
    return res.status(500).json({ success: false, message: "Unable to assign workspace plan." });
  }
});

export default router;
