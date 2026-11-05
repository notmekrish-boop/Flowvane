import express from "express";
import { prisma } from "../lib/prisma.js";
import { emitDirectMessageEvent, emitUserEvent } from "../realtime/projectChatSocket.js";

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4000;
const personSelect = { id: true, name: true, email: true, avatarUrl: true, lastSeenAt: true };
const authorSelect = { id: true, name: true, avatarUrl: true };

async function isWorkspaceMember(workspaceId, userId) {
  return Boolean(await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true }
  }));
}

async function getConversation(workspaceId, conversationId, userId) {
  if (!(await isWorkspaceMember(workspaceId, userId))) return null;
  return prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      workspaceId,
      OR: [{ firstUserId: userId }, { secondUserId: userId }]
    },
    select: { id: true, workspaceId: true, firstUserId: true, secondUserId: true }
  });
}

router.get("/:workspaceId/conversations", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!(await isWorkspaceMember(workspaceId, req.userId))) return res.status(404).json({ success: false, message: "Workspace not found." });

    const [memberships, conversations] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId, userId: { not: req.userId } },
        select: { user: { select: personSelect } },
        orderBy: { user: { name: "asc" } }
      }),
      prisma.directConversation.findMany({
        where: { workspaceId, OR: [{ firstUserId: req.userId }, { secondUserId: req.userId }] },
        include: {
          firstUser: { select: personSelect },
          secondUser: { select: personSelect },
          messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 }
        },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const threads = conversations.map((conversation) => ({
      id: conversation.id,
      workspaceId: conversation.workspaceId,
      person: conversation.firstUserId === req.userId ? conversation.secondUser : conversation.firstUser,
      lastMessage: conversation.messages[0] || null,
      updatedAt: conversation.updatedAt
    }));
    return res.json({ success: true, members: memberships.map(({ user }) => user), conversations: threads });
  } catch (error) {
    console.error("Fetch direct conversations error:", error);
    return res.status(500).json({ success: false, message: "Unable to load direct messages." });
  }
});

router.post("/:workspaceId/conversations", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const otherUserId = typeof req.body?.userId === "string" ? req.body.userId : "";
    if (!otherUserId || otherUserId === req.userId) return res.status(400).json({ success: false, message: "Choose another workspace member." });
    const [requesterIsMember, otherIsMember] = await Promise.all([
      isWorkspaceMember(workspaceId, req.userId), isWorkspaceMember(workspaceId, otherUserId)
    ]);
    if (!requesterIsMember || !otherIsMember) return res.status(404).json({ success: false, message: "Workspace member not found." });

    const [firstUserId, secondUserId] = [req.userId, otherUserId].sort();
    const conversation = await prisma.directConversation.upsert({
      where: { workspaceId_firstUserId_secondUserId: { workspaceId, firstUserId, secondUserId } },
      create: { workspaceId, firstUserId, secondUserId },
      update: {},
      include: { firstUser: { select: personSelect }, secondUser: { select: personSelect } }
    });
    const person = conversation.firstUserId === req.userId ? conversation.secondUser : conversation.firstUser;
    const thread = { id: conversation.id, workspaceId, person, lastMessage: null, updatedAt: conversation.updatedAt };
    emitUserEvent(req.userId, "dm:conversation-created", { workspaceId, conversationId: conversation.id });
    emitUserEvent(otherUserId, "dm:conversation-created", { workspaceId, conversationId: conversation.id });
    return res.status(201).json({ success: true, conversation: thread });
  } catch (error) {
    console.error("Create direct conversation error:", error);
    return res.status(500).json({ success: false, message: "Unable to start this conversation." });
  }
});

router.get("/:workspaceId/conversations/:conversationId/messages", async (req, res) => {
  try {
    const conversation = await getConversation(req.params.workspaceId, req.params.conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    const messages = await prisma.directMessage.findMany({
      where: { conversationId: conversation.id },
      include: { sender: { select: authorSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    });
    return res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error("Fetch direct messages error:", error);
    return res.status(500).json({ success: false, message: "Unable to load this conversation." });
  }
});

router.post("/:workspaceId/conversations/:conversationId/messages", async (req, res) => {
  try {
    const conversation = await getConversation(req.params.workspaceId, req.params.conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ success: false, message: "Message must be between 1 and 4,000 characters." });
    const message = await prisma.directMessage.create({
      data: { conversationId: conversation.id, senderId: req.userId, content },
      include: { sender: { select: authorSelect } }
    });
    await prisma.directConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    emitDirectMessageEvent(conversation.id, "dm:message-created", message);
    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Send direct message error:", error);
    return res.status(500).json({ success: false, message: "Unable to send this message." });
  }
});

router.patch("/:workspaceId/conversations/:conversationId/messages/:messageId", async (req, res) => {
  try {
    const conversation = await getConversation(req.params.workspaceId, req.params.conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    const existing = await prisma.directMessage.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id }, select: { id: true, senderId: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Message not found." });
    if (existing.senderId !== req.userId) return res.status(403).json({ success: false, message: "You can only edit your own messages." });
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ success: false, message: "Message must be between 1 and 4,000 characters." });
    const message = await prisma.directMessage.update({ where: { id: existing.id }, data: { content, editedAt: new Date() }, include: { sender: { select: authorSelect } } });
    emitDirectMessageEvent(conversation.id, "dm:message-updated", message);
    return res.json({ success: true, message });
  } catch (error) {
    console.error("Edit direct message error:", error);
    return res.status(500).json({ success: false, message: "Unable to update this message." });
  }
});

router.delete("/:workspaceId/conversations/:conversationId/messages/:messageId", async (req, res) => {
  try {
    const conversation = await getConversation(req.params.workspaceId, req.params.conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    const existing = await prisma.directMessage.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id }, select: { id: true, senderId: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Message not found." });
    if (existing.senderId !== req.userId) return res.status(403).json({ success: false, message: "You can only delete your own messages." });
    await prisma.directMessage.delete({ where: { id: existing.id } });
    emitDirectMessageEvent(conversation.id, "dm:message-deleted", { id: existing.id, conversationId: conversation.id });
    return res.json({ success: true, message: "Message deleted." });
  } catch (error) {
    console.error("Delete direct message error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete this message." });
  }
});

export default router;
