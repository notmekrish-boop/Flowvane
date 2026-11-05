ALTER TABLE "Memory" ADD COLUMN "workspaceId" TEXT;

UPDATE "Memory"
SET "workspaceId" = 'personal-' || "userId";

ALTER TABLE "Memory" ALTER COLUMN "workspaceId" SET NOT NULL;
DROP INDEX "Memory_userId_fingerprint_key";
CREATE UNIQUE INDEX "Memory_userId_workspaceId_fingerprint_key" ON "Memory"("userId", "workspaceId", "fingerprint");
CREATE INDEX "Memory_workspaceId_userId_updatedAt_idx" ON "Memory"("workspaceId", "userId", "updatedAt");
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
