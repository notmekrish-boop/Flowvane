import express from "express";
import { prisma } from "../lib/prisma.js";
const router = express.Router();

function titleFrom(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return !clean ? "New chat" : clean.length > 52 ? `${clean.slice(0, 49)}...` : clean;
}
async function owned(userId, id) {
  return prisma.conversation.findFirst({ where: { id, userId } });
}

router.get("/", async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId }, orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true,
        messages: { orderBy: { createdAt: "asc" }, take: 1,
          select: { text: true, role: true, createdAt: true } } },
    });
    res.json({ success: true, conversations });
  } catch (e) {
    console.error("List conversations:", e);
    res.status(500).json({ success: false, message: "Unable to load chat history." });
  }
});

router.post("/", async (req, res) => {
  try {
    const conversation = await prisma.conversation.create({
      data: { userId: req.userId, title: titleFrom(req.body?.title) },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json({ success: true, conversation });
  } catch (e) {
    console.error("Create conversation:", e);
    res.status(500).json({ success: false, message: "Unable to create a new chat." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    res.json({ success: true, conversation });
  } catch (e) {
    console.error("Get conversation:", e);
    res.status(500).json({ success: false, message: "Unable to open this conversation." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({ success: false, message: "A chat title is required." });
    }
    const existing = await owned(req.userId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Conversation not found." });
    const conversation = await prisma.conversation.update({
      where: { id: existing.id }, data: { title: titleFrom(req.body.title) },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, conversation });
  } catch (e) {
    console.error("Rename conversation:", e);
    res.status(500).json({ success: false, message: "Unable to rename this conversation." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existing = await owned(req.userId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Conversation not found." });
    await prisma.conversation.delete({ where: { id: existing.id } });
    res.json({ success: true, message: "Conversation deleted." });
  } catch (e) {
    console.error("Delete conversation:", e);
    res.status(500).json({ success: false, message: "Unable to delete this conversation." });
  }
});

router.post("/:id/messages", async (req, res) => {
  try {
    const conversation = await owned(req.userId, req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    const { role, text, proposal = null, proposalType = null, proposalStatus = null } = req.body || {};
    if (!["user", "model"].includes(role) || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, message: "A valid message is required." });
    }
    if (text.length > 12000) return res.status(400).json({ success: false, message: "Message is too long." });
    const message = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role, text,
        proposal: proposal && typeof proposal === "object" ? proposal : undefined,
        proposalType: ["create_task", "update_task"].includes(proposalType) ? proposalType : null,
        proposalStatus: ["pending", "created", "cancelled"].includes(proposalStatus) ? proposalStatus : null },
    });
    if (role === "user" && conversation.title === "New chat") {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { title: titleFrom(text) } });
    } else {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    }
    res.status(201).json({ success: true, message });
  } catch (e) {
    console.error("Save chat message:", e);
    res.status(500).json({ success: false, message: "Unable to save this message." });
  }
});

router.patch("/:id/messages/:messageId", async (req, res) => {
  try {
    const conversation = await owned(req.userId, req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    const existing = await prisma.chatMessage.findFirst({
      where: { id: req.params.messageId, conversationId: conversation.id, role: "model" },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Assistant message not found." });
    const data = {};
    if (typeof req.body?.text === "string" && req.body.text.length <= 12000) data.text = req.body.text;
    if (["pending", "created", "cancelled"].includes(req.body?.proposalStatus)) data.proposalStatus = req.body.proposalStatus;
    const message = await prisma.chatMessage.update({ where: { id: existing.id }, data });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    res.json({ success: true, message });
  } catch (e) {
    console.error("Update chat message:", e);
    res.status(500).json({ success: false, message: "Unable to update this message." });
  }
});
export default router;
