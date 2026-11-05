import express from "express";
import { prisma } from "../lib/prisma.js";
import { emitWorkspaceEvent } from "../realtime/projectChatSocket.js";

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4000;
const authorSelect = { id: true, name: true, avatarUrl: true };

async function getWorkspaceAccess(workspaceId, userId) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true, role: true }
  });
}

router.get("/:workspaceId/messages", async (req, res) => {
  try {
    const access = await getWorkspaceAccess(req.params.workspaceId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Workspace not found." });
    const messages = await prisma.workspaceMessage.findMany({
      where: { workspaceId: access.workspaceId },
      include: { author: { select: authorSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    });
    return res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error("Workspace chat fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load workspace messages." });
  }
});

router.post("/:workspaceId/messages", async (req, res) => {
  try {
    const access = await getWorkspaceAccess(req.params.workspaceId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Workspace not found." });
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: "Message must be between 1 and 4,000 characters." });
    }
    const message = await prisma.workspaceMessage.create({
      data: { workspaceId: access.workspaceId, authorId: req.userId, content },
      include: { author: { select: authorSelect } }
    });
    emitWorkspaceEvent(access.workspaceId, "workspace:message-created", message);
    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Workspace chat send error:", error);
    return res.status(500).json({ success: false, message: "Unable to send this message." });
  }
});

router.patch("/:workspaceId/messages/:messageId", async (req, res) => {
  try {
    const access = await getWorkspaceAccess(req.params.workspaceId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Workspace not found." });
    const existing = await prisma.workspaceMessage.findFirst({
      where: { id: req.params.messageId, workspaceId: access.workspaceId },
      select: { id: true, authorId: true }
    });
    if (!existing) return res.status(404).json({ success: false, message: "Message not found." });
    if (existing.authorId !== req.userId) return res.status(403).json({ success: false, message: "You can only edit your own messages." });
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: "Message must be between 1 and 4,000 characters." });
    }
    const message = await prisma.workspaceMessage.update({
      where: { id: existing.id },
      data: { content, editedAt: new Date() },
      include: { author: { select: authorSelect } }
    });
    emitWorkspaceEvent(access.workspaceId, "workspace:message-updated", message);
    return res.json({ success: true, message });
  } catch (error) {
    console.error("Workspace chat edit error:", error);
    return res.status(500).json({ success: false, message: "Unable to update this message." });
  }
});

router.delete("/:workspaceId/messages/:messageId", async (req, res) => {
  try {
    const access = await getWorkspaceAccess(req.params.workspaceId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Workspace not found." });
    const existing = await prisma.workspaceMessage.findFirst({
      where: { id: req.params.messageId, workspaceId: access.workspaceId },
      select: { id: true, authorId: true }
    });
    if (!existing) return res.status(404).json({ success: false, message: "Message not found." });
    if (existing.authorId !== req.userId) return res.status(403).json({ success: false, message: "You can only delete your own messages." });
    await prisma.workspaceMessage.delete({ where: { id: existing.id } });
    emitWorkspaceEvent(access.workspaceId, "workspace:message-deleted", { id: existing.id, workspaceId: access.workspaceId });
    return res.json({ success: true, message: "Message deleted." });
  } catch (error) {
    console.error("Workspace chat delete error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete this message." });
  }
});

export default router;
