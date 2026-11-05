
import express from "express";
import { prisma } from "../lib/prisma.js";
import { emitUserEvent } from "../realtime/projectChatSocket.js";
import { workspaceProjectAccess } from "../lib/projectAccess.js";

const router = express.Router();

// GET ALL NOTIFICATIONS FOR LOGGED-IN USER
router.get("/", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: req.userId,
        OR: [
          { projectId: null },
          { project: { ...workspaceProjectAccess(req.userId) } }
        ]
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead
    ).length;

    res.status(200).json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch notifications."
    });
  }
});

// MARK A SINGLE NOTIFICATION AS READ
router.patch("/:id/read", async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        recipientId: req.userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    const updatedNotification =
      await prisma.notification.update({
        where: {
          id: notification.id
        },
        data: {
          isRead: true
        }
      });
    emitUserEvent(req.userId, "notification:changed", {});

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification: updatedNotification
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update notification."
    });
  }
});

// MARK ALL NOTIFICATIONS AS READ
router.patch("/read-all", async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        recipientId: req.userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });
    emitUserEvent(req.userId, "notification:changed", {});

    res.status(200).json({
      success: true,
      message: "All notifications marked as read."
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update notifications."
    });
  }
});

// DELETE A SINGLE NOTIFICATION
router.delete("/:id", async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        recipientId: req.userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    await prisma.notification.delete({
      where: {
        id: notification.id
      }
    });
    emitUserEvent(req.userId, "notification:changed", {});

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully."
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete notification."
    });
  }
});

export default router;
