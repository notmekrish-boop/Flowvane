import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

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
    const notes = await prisma.note.findMany({ where: { userId: req.userId }, orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }] });
    return res.json({ success: true, notes });
  } catch (error) {
    console.error("Notes fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load notes." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, content, folder } = req.body || {};
    if (title !== undefined && (typeof title !== "string" || title.length > 160)) return res.status(400).json({ success: false, message: "Title must be 160 characters or fewer." });
    if (content !== undefined && (typeof content !== "string" || content.length > 200_000)) return res.status(400).json({ success: false, message: "Note content is too large." });
    if (folder !== undefined && (typeof folder !== "string" || !folder.trim() || folder.trim().length > 60)) return res.status(400).json({ success: false, message: "Folder must be 1–60 characters." });
    const note = await prisma.note.create({ data: { userId: req.userId, title: title?.trim() || "Untitled note", content: content || "", folder: folder?.trim() || "General" } });
    return res.status(201).json({ success: true, note });
  } catch (error) {
    console.error("Note create error:", error);
    return res.status(500).json({ success: false, message: "Unable to create note." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { title, content, folder, isPinned } = req.body || {};
    const data = {};
    if (title !== undefined) { if (typeof title !== "string" || title.length > 160) return res.status(400).json({ success: false, message: "Invalid note title." }); data.title = title.trim() || "Untitled note"; }
    if (content !== undefined) { if (typeof content !== "string" || content.length > 200_000) return res.status(400).json({ success: false, message: "Note content is too large." }); data.content = content; }
    if (folder !== undefined) { if (typeof folder !== "string" || !folder.trim() || folder.trim().length > 60) return res.status(400).json({ success: false, message: "Invalid folder name." }); data.folder = folder.trim(); }
    if (isPinned !== undefined) { if (typeof isPinned !== "boolean") return res.status(400).json({ success: false, message: "Invalid pin value." }); data.isPinned = isPinned; }
    if (!Object.keys(data).length) return res.status(400).json({ success: false, message: "No note changes provided." });
    const result = await prisma.note.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
    if (!result.count) return res.status(404).json({ success: false, message: "Note not found." });
    const note = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.userId } });
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
