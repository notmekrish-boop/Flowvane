-- Preserve access for current project members while tying future access to the workspace.
INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role")
SELECT 'legacy-project-' || tm."id", p."workspaceId", tm."userId", 'MEMBER'::"WorkspaceRole"
FROM "TeamMember" tm
JOIN "Project" p ON p."id" = tm."projectId"
ON CONFLICT ("workspaceId", "userId") DO NOTHING;
