-- ============================================================
-- Migration: RBAC owner membership rows + project invites
-- ============================================================

-- 1. Extend ProjectMemberRole enum with owner and member values
ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'member';

-- 2. Backfill: create an owner membership row for every existing project
--    that has an ownerUserId (or falls back to userId for legacy projects).
--    ON CONFLICT is a no-op so this is safe to re-run.
INSERT INTO "project_memberships" ("id", "projectId", "userId", "role", "createdAt")
SELECT
  gen_random_uuid(),
  p."id",
  COALESCE(p."ownerUserId", p."userId"),
  'owner',
  NOW()
FROM "projects" p
WHERE COALESCE(p."ownerUserId", p."userId") IS NOT NULL
ON CONFLICT ("projectId", "userId") DO NOTHING;

-- 3. Create project_invites table
CREATE TABLE "project_invites" (
    "id"         TEXT        NOT NULL,
    "projectId"  TEXT        NOT NULL,
    "createdBy"  TEXT        NOT NULL,
    "token"      TEXT        NOT NULL,
    "codeHash"   TEXT        NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_invites_token_key" ON "project_invites"("token");
CREATE INDEX "project_invites_projectId_idx" ON "project_invites"("projectId");
CREATE INDEX "project_invites_token_idx"     ON "project_invites"("token");

ALTER TABLE "project_invites"
    ADD CONSTRAINT "project_invites_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
