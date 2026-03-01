-- Add workspaceId to projects (nullable for backfill)
ALTER TABLE "projects" ADD COLUMN "workspaceId" TEXT;

-- Backfill: set workspaceId from owner's first workspace (memberships)
UPDATE "projects" p
SET "workspaceId" = (
  SELECT m."workspaceId"
  FROM "memberships" m
  WHERE m."userId" = COALESCE(p."ownerUserId", p."userId")
  ORDER BY m."createdAt" ASC
  LIMIT 1
)
WHERE COALESCE(p."ownerUserId", p."userId") IS NOT NULL;

-- Add FK and index
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "projects_workspaceId_createdAt_idx" ON "projects"("workspaceId", "createdAt" DESC);
CREATE INDEX "projects_workspaceId_accessCodePrefix_idx" ON "projects"("workspaceId", "accessCodePrefix");
