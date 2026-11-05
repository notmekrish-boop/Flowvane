import express from "express";
import { prisma } from "../lib/prisma.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

const router = express.Router({ mergeParams: true });
const MAX_FILE_SIZE = 3 * 1024 * 1024;

async function getTaskAccess(taskId, userId) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { ...workspaceProjectAccess(userId), OR: [{ ownerId: userId }, { members: { some: { userId } } }] }
    },
    select: {
      id: true,
      projectId: true,
      assigneeId: true,
      project: { select: { ownerId: true, members: { where: { userId }, select: { role: true } } } }
    }
  });
  if (!task) return null;
  const canManage = task.project.ownerId === userId || task.project.members.some((member) => member.role === "ADMIN");
  return { task, canManage, canUpload: canManage || task.assigneeId === userId };
}

router.get("/", async (req, res) => {
  try {
    const access = await getTaskAccess(req.params.taskId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Task not found." });
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: access.task.id },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploader: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ success: true, attachments });
  } catch (error) {
    console.error("Task attachments fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load task attachments." });
  }
});

router.post("/", async (req, res) => {
  try {
    const access = await getTaskAccess(req.params.taskId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Task not found." });
    if (!access.canUpload) return res.status(403).json({ success: false, message: "Only project managers and the task assignee can upload attachments." });
    const attachmentCount = await prisma.taskAttachment.count({ where: { taskId: access.task.id } });
    if (attachmentCount >= 20) return res.status(409).json({ success: false, message: "A task can have up to 20 attachments." });

    const { fileName, mimeType, fileData } = req.body || {};
    if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 180 || typeof fileData !== "string") {
      return res.status(400).json({ success: false, message: "Choose a valid file to attach." });
    }
    if (fileData.length > Math.ceil(MAX_FILE_SIZE * 4 / 3) + 8 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(fileData)) {
      return res.status(400).json({ success: false, message: "File is too large or invalid. Maximum size is 3 MB." });
    }
    const buffer = Buffer.from(fileData, "base64");
    if (!buffer.length || buffer.length > MAX_FILE_SIZE) return res.status(400).json({ success: false, message: "File is empty or exceeds the 3 MB limit." });
    const safeName = fileName.trim().replace(/[\\/\x00-\x1f\x7f]/g, "_");
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: access.task.id,
        uploaderId: req.userId,
        fileName: safeName,
        mimeType: typeof mimeType === "string" && mimeType.length <= 120 ? mimeType : "application/octet-stream",
        size: buffer.length,
        data: buffer
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploader: { select: { id: true, name: true } }
      }
    });
    return res.status(201).json({ success: true, attachment });
  } catch (error) {
    console.error("Task attachment upload error:", error);
    return res.status(500).json({ success: false, message: "Unable to save task attachment." });
  }
});

router.get("/:attachmentId", async (req, res) => {
  try {
    const access = await getTaskAccess(req.params.taskId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Task not found." });
    const attachment = await prisma.taskAttachment.findFirst({ where: { id: req.params.attachmentId, taskId: access.task.id } });
    if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found." });
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Content-Length": String(attachment.size),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    });
    return res.status(200).send(Buffer.from(attachment.data));
  } catch (error) {
    console.error("Task attachment download error:", error);
    return res.status(500).json({ success: false, message: "Unable to download attachment." });
  }
});

router.delete("/:attachmentId", async (req, res) => {
  try {
    const access = await getTaskAccess(req.params.taskId, req.userId);
    if (!access) return res.status(404).json({ success: false, message: "Task not found." });
    const attachment = await prisma.taskAttachment.findFirst({ where: { id: req.params.attachmentId, taskId: access.task.id }, select: { id: true, uploaderId: true } });
    if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found." });
    if (!access.canManage && attachment.uploaderId !== req.userId) return res.status(403).json({ success: false, message: "You cannot delete this attachment." });
    await prisma.taskAttachment.delete({ where: { id: attachment.id } });
    return res.json({ success: true, message: "Attachment deleted." });
  } catch (error) {
    console.error("Task attachment delete error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete attachment." });
  }
});

export default router;
