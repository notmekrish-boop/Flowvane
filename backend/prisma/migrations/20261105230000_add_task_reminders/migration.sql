ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_REMINDER';
ALTER TABLE "Task" ADD COLUMN "reminderAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
CREATE INDEX "Task_reminderAt_reminderSentAt_idx" ON "Task"("reminderAt", "reminderSentAt");