-- AlterTable
ALTER TABLE "Note" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Note_projectId_updatedAt_idx" ON "Note"("projectId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
