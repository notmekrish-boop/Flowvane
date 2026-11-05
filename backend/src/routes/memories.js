import express from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";

const router = express.Router();
const CATEGORIES = ["project", "goal", "preference", "workflow"];

async function getWorkspaceId(req) {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) return null;
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: req.userId } },
    select: { workspaceId: true }
  });
  return membership?.workspaceId || null;
}

function fingerprint(content) {
  return createHash("sha256")
    .update(content.toLowerCase().replace(/\s+/g, " ").trim())
    .digest("hex");
}

router.get("/", async (req, res) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) return res.status(404).json({ success: false, message: "Workspace not found." });
    const memories = await prisma.memory.findMany({
      where: { userId: req.userId, workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, category: true, content: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, memories });
  } catch (error) {
    console.error("List memories error:", error);
    res.status(500).json({ success: false, message: "Unable to load saved memories." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) return res.status(404).json({ success: false, message: "Workspace not found." });
    const { content, category } = req.body || {};
    if (typeof content !== "string" || !content.trim() || content.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Memory must contain 1–500 characters." });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid memory category." });
    }
    const existing = await prisma.memory.findFirst({
      where: { id: req.params.id, userId: req.userId, workspaceId },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Memory not found." });

    const nextFingerprint = fingerprint(content.trim());
    const duplicate = await prisma.memory.findFirst({
      where: { userId: req.userId, workspaceId, fingerprint: nextFingerprint, NOT: { id: existing.id } },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: "An identical memory already exists." });
    }

    const memory = await prisma.memory.update({
      where: { id: existing.id },
      data: { content: content.trim(), category, fingerprint: nextFingerprint },
      select: { id: true, category: true, content: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, memory });
  } catch (error) {
    console.error("Update memory error:", error);
    res.status(500).json({ success: false, message: "Unable to update this memory." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) return res.status(404).json({ success: false, message: "Workspace not found." });
    const result = await prisma.memory.deleteMany({
      where: { id: req.params.id, userId: req.userId, workspaceId },
    });
    if (!result.count) return res.status(404).json({ success: false, message: "Memory not found." });
    res.json({ success: true, message: "Memory deleted." });
  } catch (error) {
    console.error("Delete memory error:", error);
    res.status(500).json({ success: false, message: "Unable to delete this memory." });
  }
});

export default router;
