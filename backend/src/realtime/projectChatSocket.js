import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

let io;
const activeSocketsByUser = new Map();

function isAllowedOrigin(origin, configuredFrontendOrigin) {
  if (!origin || origin === configuredFrontendOrigin) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    return process.env.NODE_ENV !== "production" && protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export function initializeProjectChatSockets(httpServer, configuredFrontendOrigin) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin, configuredFrontendOrigin));
      }
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication token required."));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.userId) return next(new Error("Invalid authentication token."));
      socket.data.userId = decoded.userId;
      return next();
    } catch {
      return next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.data.typingContexts = new Map();
    socket.join(`user:${userId}`);
    const sockets = activeSocketsByUser.get(userId) || new Set();
    const becameOnline = sockets.size === 0;
    sockets.add(socket.id);
    activeSocketsByUser.set(userId, sockets);

    void (async () => {
      try {
        const [user, memberships] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
          prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } })
        ]);
        socket.data.userName = user?.name || "Workspace member";
        socket.data.presenceWorkspaceIds = memberships.map((membership) => membership.workspaceId);
        await Promise.all(socket.data.presenceWorkspaceIds.map((workspaceId) => socket.join(`workspace-presence:${workspaceId}`)));
        if (becameOnline) {
          await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: null } });
          for (const workspaceId of socket.data.presenceWorkspaceIds) {
            io.to(`workspace-presence:${workspaceId}`).emit("presence:changed", { userId, isOnline: true, lastSeenAt: null });
          }
        }
      } catch (error) {
        console.error("Initialize user presence failed:", error);
      }
    })();

    socket.on("disconnect", async () => {
      for (const context of socket.data.typingContexts.values()) {
        socket.to(context.room).emit("typing:updated", {
          scope: context.scope,
          scopeId: context.scopeId,
          userId,
          name: socket.data.userName || "Member",
          isTyping: false
        });

      }
      const userSockets = activeSocketsByUser.get(userId);
      if (!userSockets) return;
      userSockets.delete(socket.id);
      if (userSockets.size > 0) return;
      activeSocketsByUser.delete(userId);
      const lastSeenAt = new Date();
      try {
        await prisma.user.update({ where: { id: userId }, data: { lastSeenAt } });
      } catch (error) {
        console.error("Update last seen failed:", error);
      }
      for (const workspaceId of socket.data.presenceWorkspaceIds || []) {
        io.to(`workspace-presence:${workspaceId}`).emit("presence:changed", { userId, isOnline: false, lastSeenAt });
      }
    });

    const publishTyping = (scope, scopeId, isTyping) => {
      const room = `${scope === "direct" ? "dm" : scope}:${scopeId}`;
      if (typeof scopeId !== "string" || !socket.rooms.has(room)) return;
      const key = `${scope}:${scopeId}`;
      if (isTyping) socket.data.typingContexts.set(key, { scope, scopeId, room });
      else socket.data.typingContexts.delete(key);
      socket.to(room).emit("typing:updated", {
        scope,
        scopeId,
        userId,
        name: socket.data.userName || "Member",
        isTyping: Boolean(isTyping)
      });
    };

    socket.on("workspace:presence:join", async (workspaceId, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      try {
        const membership = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
          select: { workspaceId: true }
        });
        if (!membership) {
          reply({ success: false, message: "You do not have access to this workspace." });
          return;
        }
        await socket.join(`workspace-presence:${workspaceId}`);
        const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
        const onlineUserIds = members.map(({ userId: memberId }) => memberId).filter((memberId) => activeSocketsByUser.has(memberId));
        reply({ success: true, onlineUserIds });
      } catch (error) {
        console.error("Join workspace presence failed:", error);
        reply({ success: false, message: "Unable to load workspace presence." });
      }
    });

    socket.on("project:join", async (projectId, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      if (typeof projectId !== "string" || projectId.length === 0) {
        reply({ success: false, message: "Project ID is required." });
        return;
      }

      try {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            ...workspaceProjectAccess(socket.data.userId),
            OR: [
              { ownerId: socket.data.userId },
              { members: { some: { userId: socket.data.userId } } }
            ]
          },
          select: { id: true }
        });
        if (!project) {
          reply({ success: false, message: "You do not have access to this project." });
          return;
        }
        await socket.join(`project:${project.id}`);
        reply({ success: true });
      } catch (error) {
        console.error("Project chat room join failed:", error);
        reply({ success: false, message: "Unable to join project chat." });
      }
    });

    socket.on("project:leave", (projectId) => {
      if (typeof projectId === "string") socket.leave(`project:${projectId}`);
    });

    socket.on("workspace:join", async (workspaceId, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      if (typeof workspaceId !== "string" || workspaceId.length === 0) {
        reply({ success: false, message: "Workspace ID is required." });
        return;
      }
      try {
        const membership = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: socket.data.userId } },
          select: { workspaceId: true }
        });
        if (!membership) {
          reply({ success: false, message: "You do not have access to this workspace." });
          return;
        }
        await socket.join(`workspace:${membership.workspaceId}`);
        reply({ success: true });
      } catch (error) {
        console.error("Workspace chat room join failed:", error);
        reply({ success: false, message: "Unable to join workspace chat." });
      }
    });

    socket.on("workspace:leave", (workspaceId) => {
      if (typeof workspaceId === "string") socket.leave(`workspace:${workspaceId}`);
    });

    socket.on("dm:join", async (conversationId, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      if (typeof conversationId !== "string" || conversationId.length === 0) {
        reply({ success: false, message: "Conversation ID is required." });
        return;
      }
      try {
        const conversation = await prisma.directConversation.findFirst({
          where: {
            id: conversationId,
            OR: [{ firstUserId: socket.data.userId }, { secondUserId: socket.data.userId }],
            workspace: { members: { some: { userId: socket.data.userId } } }
          },
          select: { id: true }
        });
        if (!conversation) {
          reply({ success: false, message: "You do not have access to this conversation." });
          return;
        }
        await socket.join(`dm:${conversation.id}`);
        reply({ success: true });
      } catch (error) {
        console.error("Direct message room join failed:", error);
        reply({ success: false, message: "Unable to join this conversation." });
      }
    });

    socket.on("dm:leave", (conversationId) => {
      if (typeof conversationId === "string") socket.leave(`dm:${conversationId}`);
    });

    socket.on("workspace:typing", ({ workspaceId, isTyping } = {}) => {
      publishTyping("workspace", workspaceId, isTyping);
    });
    socket.on("project:typing", ({ projectId, isTyping } = {}) => {
      publishTyping("project", projectId, isTyping);
    });
    socket.on("dm:typing", ({ conversationId, isTyping } = {}) => {
      publishTyping("direct", conversationId, isTyping);
    });
  });

  return io;
}

export function emitProjectEvent(projectId, event, payload) {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export async function removeUserFromProjectRoom(projectId, userId) {
  if (!io) return;
  await io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);
}

export function emitWorkspaceEvent(workspaceId, event, payload) {
  io?.to(`workspace:${workspaceId}`).emit(event, payload);
}

export async function removeUserFromWorkspaceRoom(workspaceId, userId) {
  if (!io) return;
  await io.in(`user:${userId}`).socketsLeave(`workspace:${workspaceId}`);
  await io.in(`user:${userId}`).socketsLeave(`workspace-presence:${workspaceId}`);
  const [conversations, projects] = await Promise.all([
    prisma.directConversation.findMany({
    where: { workspaceId, OR: [{ firstUserId: userId }, { secondUserId: userId }] },
    select: { id: true }
    }),
    prisma.project.findMany({ where: { workspaceId }, select: { id: true } })
  ]);
  await Promise.all([
    ...conversations.map((conversation) => io.in(`user:${userId}`).socketsLeave(`dm:${conversation.id}`)),
    ...projects.map((project) => io.in(`user:${userId}`).socketsLeave(`project:${project.id}`))
  ]);
}

export function emitUserEvent(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitDirectMessageEvent(conversationId, event, payload) {
  io?.to(`dm:${conversationId}`).emit(event, payload);
}
