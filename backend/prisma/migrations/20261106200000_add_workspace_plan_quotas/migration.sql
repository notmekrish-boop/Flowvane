CREATE TABLE "PlanQuota" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aiRequestsPerWindow" INTEGER NOT NULL,
    "aiWindowSeconds" INTEGER NOT NULL DEFAULT 600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanQuota_pkey" PRIMARY KEY ("code")
);

INSERT INTO "PlanQuota" ("code", "name", "aiRequestsPerWindow", "aiWindowSeconds", "updatedAt") VALUES
    ('FREE', 'Free', 20, 600, CURRENT_TIMESTAMP),
    ('PRO', 'Pro', 100, 600, CURRENT_TIMESTAMP),
    ('BUSINESS', 'Business', 500, 600, CURRENT_TIMESTAMP);

ALTER TABLE "Workspace" ADD COLUMN "planCode" TEXT NOT NULL DEFAULT 'FREE';

ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_planCode_fkey"
FOREIGN KEY ("planCode") REFERENCES "PlanQuota"("code")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Workspace_planCode_idx" ON "Workspace"("planCode");
