import express from "express";
import { prisma } from "../lib/prisma.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

const router = express.Router();

async function canAccessProject(projectId, userId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...workspaceProjectAccess(userId),
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } }
      ]
    },
    select: { id: true }
  });

  return Boolean(project);
}

async function validateProjectId(projectId, userId, res) {
  if (projectId === undefined || projectId === null || projectId === "") return { valid: true, value: null };
  if (typeof projectId !== "string") {
    res.status(400).json({ success: false, message: "Project must be a valid project ID." });
    return { valid: false };
  }
  if (!(await canAccessProject(projectId, userId))) {
    res.status(404).json({ success: false, message: "Project not found." });
    return { valid: false };
  }
  return { valid: true, value: projectId };
}

async function validateTaskId(taskId, userId, res) {
  if (taskId === undefined || taskId === null || taskId === "") return { valid: true, value: null, projectId: null };
  if (typeof taskId !== "string") {
    res.status(400).json({ success: false, message: "Task must be a valid task ID." });
    return { valid: false };
  }
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { ...workspaceProjectAccess(userId), OR: [{ ownerId: userId }, { members: { some: { userId } } }] }
    },
    select: { id: true, projectId: true }
  });
  if (!task) {
    res.status(404).json({ success: false, message: "Task not found." });
    return { valid: false };
  }
  return { valid: true, value: task.id, projectId: task.projectId };
}

router.get("/folders", async (req, res) => {
  try {
    const folders = await prisma.noteFolder.findMany({ where: { userId: req.userId }, orderBy: { name: "asc" } });
    return res.json({ success: true, folders });
  } catch (error) {
    console.error("Note folders fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load folders." });
  }
});

router.post("/folders", async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 60) return res.status(400).json({ success: false, message: "Folder name must be between 1 and 60 characters." });
    const folder = await prisma.noteFolder.upsert({ where: { userId_name: { userId: req.userId, name } }, update: {}, create: { userId: req.userId, name } });
    return res.status(201).json({ success: true, folder });
  } catch (error) {
    console.error("Note folder create error:", error);
    return res.status(500).json({ success: false, message: "Unable to create folder." });
  }
});

router.get("/", async (req, res) => {
  try {
    const where = { userId: req.userId };
    if (req.query.scope === "personal") {
      where.projectId = null;
    } else if (req.query.projectId) {
      if (!(await canAccessProject(req.query.projectId, req.userId))) {
        return res.status(404).json({ success: false, message: "Project not found." });
      }
      where.projectId = req.query.projectId;
    }
    if (req.query.taskId) {
      const task = await validateTaskId(req.query.taskId, req.userId, res);
      if (!task.valid) return;
      where.taskId = task.value;
    }
    const notes = await prisma.note.findMany({
      where,
      include: { project: { select: { id: true, name: true } }, task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } } },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }]
    });
    return res.json({ success: true, notes });
  } catch (error) {
    console.error("Notes fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load notes." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, content, folder, projectId, taskId } = req.body || {};
    if (title !== undefined && (typeof title !== "string" || title.length > 160)) return res.status(400).json({ success: false, message: "Title must be 160 characters or fewer." });
    if (content !== undefined && (typeof content !== "string" || content.length > 200_000)) return res.status(400).json({ success: false, message: "Note content is too large." });
    if (folder !== undefined && (typeof folder !== "string" || !folder.trim() || folder.trim().length > 60)) return res.status(400).json({ success: false, message: "Folder must be 1–60 characters." });
    const task = await validateTaskId(taskId, req.userId, res);
    if (!task.valid) return;
    const project = await validateProjectId(projectId, req.userId, res);
    if (!project.valid) return;
    if (task.value && project.value && project.value !== task.projectId) {
      return res.status(400).json({ success: false, message: "The linked note project must match the task project." });
    }
    const note = await prisma.note.create({
      data: { userId: req.userId, title: title?.trim() || "Untitled note", content: content || "", folder: folder?.trim() || "General", projectId: task.projectId || project.value, taskId: task.value },
      include: { project: { select: { id: true, name: true } }, task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } } }
    });
    return res.status(201).json({ success: true, note });
  } catch (error) {
    console.error("Note create error:", error);
    return res.status(500).json({ success: false, message: "Unable to create note." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { title, content, folder, isPinned, projectId, taskId } = req.body || {};
    const data = {};
    if (title !== undefined) { if (typeof title !== "string" || title.length > 160) return res.status(400).json({ success: false, message: "Invalid note title." }); data.title = title.trim() || "Untitled note"; }
    if (content !== undefined) { if (typeof content !== "string" || content.length > 200_000) return res.status(400).json({ success: false, message: "Note content is too large." }); data.content = content; }
    if (folder !== undefined) { if (typeof folder !== "string" || !folder.trim() || folder.trim().length > 60) return res.status(400).json({ success: false, message: "Invalid folder name." }); data.folder = folder.trim(); }
    if (isPinned !== undefined) { if (typeof isPinned !== "boolean") return res.status(400).json({ success: false, message: "Invalid pin value." }); data.isPinned = isPinned; }
    const existing = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.userId }, select: { id: true, taskId: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Note not found." });

    let linkedTask;
    if (taskId !== undefined) {
      linkedTask = await validateTaskId(taskId, req.userId, res);
      if (!linkedTask.valid) return;
      data.taskId = linkedTask.value;
      if (linkedTask.value) data.projectId = linkedTask.projectId;
    }
    if (projectId !== undefined) {
      const project = await validateProjectId(projectId, req.userId, res);
      if (!project.valid) return;
      if (linkedTask?.value && project.value !== linkedTask.projectId) {
        return res.status(400).json({ success: false, message: "The linked note project must match the task project." });
      }
      data.projectId = project.value;
      if (taskId === undefined && existing.taskId) {
        const currentTask = await prisma.task.findUnique({ where: { id: existing.taskId }, select: { projectId: true } });
        if (!currentTask || currentTask.projectId !== project.value) data.taskId = null;
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ success: false, message: "No note changes provided." });
    const result = await prisma.note.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
    if (!result.count) return res.status(404).json({ success: false, message: "Note not found." });
    const note = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.userId }, include: { project: { select: { id: true, name: true } }, task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } } } });
    return res.json({ success: true, note });
  } catch (error) {
    console.error("Note update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update note." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await prisma.note.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    if (!result.count) return res.status(404).json({ success: false, message: "Note not found." });
    return res.json({ success: true, message: "Note deleted." });
  } catch (error) {
    console.error("Note delete error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete note." });
  }
});

export default router;
