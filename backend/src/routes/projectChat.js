import express from "express";
import { prisma } from "../lib/prisma.js";
import { emitProjectEvent } from "../realtime/projectChatSocket.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4000;

async function getProjectAccess(projectId, userId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...workspaceProjectAccess(userId),
      OR: [{ ownerId: userId }, { members: { some: { userId } } }]
    },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true } }
    }
  });
  if (!project) return null;
  return {
    project,
    canManage: project.ownerId === userId || project.members.some((member) => member.role === "ADMIN")
  };
}

const authorSelect = { id: true, name: true, avatarUrl: true };

router.get("/:projectId/messages", async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.projectId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Project not found." });
    const messages = await prisma.projectMessage.findMany({
      where: { projectId: access.project.id },
      include: { author: { select: authorSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    });
    return res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error("Project chat fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load project messages." });
  }
});

router.post("/:projectId/messages", async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.projectId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Project not found." });
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: "Message must be between 1 and 4,000 characters." });
    }
    const message = await prisma.projectMessage.create({
      data: { projectId: access.project.id, authorId: req.userId, content },
      include: { author: { select: authorSelect } }
    });
    emitProjectEvent(access.project.id, "project:message-created", message);
    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Project chat send error:", error);
    return res.status(500).json({ success: false, message: "Unable to send this message." });
  }
});

router.patch("/:projectId/messages/:messageId", async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.projectId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Project not found." });
    const existing = await prisma.projectMessage.findFirst({
      where: { id: req.params.messageId, projectId: access.project.id },
      select: { id: true, authorId: true }
    });
    if (!existing) return res.status(404).json({ success: false, message: "Message not found." });
    if (existing.authorId !== req.userId && !access.canManage) {
      return res.status(403).json({ success: false, message: "You can only edit your own messages." });
    }
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: "Message must be between 1 and 4,000 characters." });
    }
    const message = await prisma.projectMessage.update({
      where: { id: existing.id },
      data: { content, editedAt: new Date() },
      include: { author: { select: authorSelect } }
    });
    emitProjectEvent(access.project.id, "project:message-updated", message);
    return res.json({ success: true, message });
  } catch (error) {
    console.error("Project chat edit error:", error);
    return res.status(500).json({ success: false, message: "Unable to update this message." });
  }
});

router.delete("/:projectId/messages/:messageId", async (req, res) => {
  try {
    const access = await getProjectAccess(req.params.projectId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Project not found." });
    const existing = await prisma.projectMessage.findFirst({
      where: { id: req.params.messageId, projectId: access.project.id },
      select: { id: true, authorId: true }
    });
    if (!existing) return res.status(404).json({ success: false, message: "Message not found." });
    if (existing.authorId !== req.userId && !access.canManage) {
      return res.status(403).json({ success: false, message: "You can only delete your own messages." });
    }
    await prisma.projectMessage.delete({ where: { id: existing.id } });
    emitProjectEvent(access.project.id, "project:message-deleted", { id: existing.id, projectId: access.project.id });
    return res.json({ success: true, message: "Message deleted." });
  } catch (error) {
    console.error("Project chat delete error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete this message." });
  }
});

export default router;
