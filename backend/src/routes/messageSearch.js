import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();
const authorSelect = { id: true, name: true, avatarUrl: true };

router.get("/messages", async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!workspaceId) return res.status(400).json({ success: false, message: "Choose a workspace to search." });
    if (query.length < 2 || query.length > 100) {
      return res.status(400).json({ success: false, message: "Search text must be between 2 and 100 characters." });
    }
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId } },
      select: { id: true }
    });
    if (!membership) return res.status(404).json({ success: false, message: "Workspace not found." });

    const [workspaceMessages, projectMessages, directMessages] = await Promise.all([
      prisma.workspaceMessage.findMany({
        where: { workspaceId, content: { contains: query, mode: "insensitive" } },
        include: { author: { select: authorSelect } },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.projectMessage.findMany({
        where: {
          content: { contains: query, mode: "insensitive" },
          project: {
            workspaceId,
            OR: [{ ownerId: req.userId }, { members: { some: { userId: req.userId } } }]
          }
        },
        include: { author: { select: authorSelect }, project: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.directMessage.findMany({
        where: {
          content: { contains: query, mode: "insensitive" },
          conversation: {
            workspaceId,
            OR: [{ firstUserId: req.userId }, { secondUserId: req.userId }]
          }
        },
        include: {
          sender: { select: authorSelect },
          conversation: {
            select: {
              id: true,
              firstUserId: true,
              firstUser: { select: { id: true, name: true } },
              secondUser: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);

    const results = [
      ...workspaceMessages.map((message) => ({
        id: message.id, type: "workspace", content: message.content,
        createdAt: message.createdAt, author: message.author, destination: "General chat"
      })),
      ...projectMessages.map((message) => ({
        id: message.id, type: "project", content: message.content,
        createdAt: message.createdAt, author: message.author,
        destination: message.project.name, projectId: message.project.id
      })),
      ...directMessages.map((message) => {
        const conversation = message.conversation;
        const peer = conversation.firstUserId === req.userId ? conversation.secondUser : conversation.firstUser;
        return {
          id: message.id, type: "direct", content: message.content,
          createdAt: message.createdAt, author: message.sender,
          destination: peer.name, conversationId: conversation.id
        };
      })
    ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 100);

    return res.json({ success: true, results });
  } catch (error) {
    console.error("Message search error:", error);
    return res.status(500).json({ success: false, message: "Unable to search messages." });
  }
});

export default router;
