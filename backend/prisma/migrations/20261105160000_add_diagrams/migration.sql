CREATE TYPE "DiagramType" AS ENUM (
  'FLOWCHART',
  'MIND_MAP',
  'ARCHITECTURE',
  'SWIMLANE',
  'DECISION_TREE',
  'PROCESS'
);

CREATE TABLE "Diagram" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Untitled diagram',
  "source" TEXT NOT NULL DEFAULT 'flowchart TD',
  "type" "DiagramType" NOT NULL DEFAULT 'FLOWCHART',
  "ownerId" TEXT NOT NULL,
  "projectId" TEXT,
  "noteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Diagram_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Diagram_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Diagram_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Diagram_ownerId_updatedAt_idx" ON "Diagram"("ownerId", "updatedAt");
CREATE INDEX "Diagram_projectId_updatedAt_idx" ON "Diagram"("projectId", "updatedAt");
CREATE INDEX "Diagram_noteId_updatedAt_idx" ON "Diagram"("noteId", "updatedAt");
