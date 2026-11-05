ALTER TABLE "Conversation" ADD COLUMN "workspaceId" TEXT;

UPDATE "Conversation"
SET "workspaceId" = 'personal-' || "userId";

ALTER TABLE "Conversation" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "Conversation_workspaceId_userId_updatedAt_idx" ON "Conversation"("workspaceId", "userId", "updatedAt");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
