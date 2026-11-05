import { prisma } from "../lib/prisma.js";
import { emitUserEvent } from "../realtime/projectChatSocket.js";

let reminderTimer;

export async function deliverDueTaskReminders() {
  const now = new Date();
  try {
    const dueTasks = await prisma.task.findMany({
      where: {
        reminderAt: { lte: now },
        reminderSentAt: null,
        status: { not: "COMPLETED" }
      },
      include: { project: { select: { ownerId: true } } },
      orderBy: { reminderAt: "asc" },
      take: 100
    });

    for (const task of dueTasks) {
      const recipientId = task.assigneeId || task.project.ownerId;
      if (!recipientId) continue;

      try {
        const notification = await prisma.$transaction(async (transaction) => {
          const claimed = await transaction.task.updateMany({
            where: {
              id: task.id,
              reminderAt: { lte: now },
              reminderSentAt: null,
              status: { not: "COMPLETED" }
            },
            data: { reminderSentAt: now }
          });
          if (!claimed.count) return null;

          const dueText = task.dueDate
            ? ` Due ${task.dueDate.toLocaleDateString("en-IN")}.`
            : "";
          return transaction.notification.create({
            data: {
              type: "TASK_REMINDER",
              title: "Task reminder",
              message: `Reminder for “${task.title}”.${dueText}`,
              recipientId,
              taskId: task.id,
              projectId: task.projectId
            }
          });
        });
        if (notification) emitUserEvent(recipientId, "notification:changed", {});
      } catch (error) {
        console.error(`Task reminder delivery failed for ${task.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Task reminder scan failed:", error);
  }
}

export function startTaskReminderScheduler() {
  if (reminderTimer) return;
  reminderTimer = setInterval(deliverDueTaskReminders, 60_000);
  reminderTimer.unref?.();
  void deliverDueTaskReminders();
}
