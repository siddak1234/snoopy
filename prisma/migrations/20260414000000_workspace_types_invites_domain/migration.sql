-- ============================================================
-- Migration: workspace types, workspace invites, domain verification
-- ============================================================

-- 1. Create WorkspaceType enum
CREATE TYPE "WorkspaceType" AS ENUM ('personal', 'organization');

-- 2. Add columns to workspaces
ALTER TABLE "workspaces"
    ADD COLUMN "type"             "WorkspaceType" NOT NULL DEFAULT 'personal',
    ADD COLUMN "domain"           TEXT,
    ADD COLUMN "domainVerified"   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "domainVerifiedAt" TIMESTAMP(3);

-- 3. Backfill existing rows (default handles this, but be explicit)
UPDATE "workspaces" SET "type" = 'personal' WHERE "type" IS NULL;

-- 4. Extend ProjectMemberRole enum with admin value
ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'admin';

-- 5. Create workspace_invites table
CREATE TABLE "workspace_invites" (
    "id"          TEXT          NOT NULL,
    "workspaceId" TEXT          NOT NULL,
    "createdBy"   TEXT          NOT NULL,
    "token"       TEXT          NOT NULL,
    "codeHash"    TEXT          NOT NULL,
    "expiresAt"   TIMESTAMP(3)  NOT NULL,
    "acceptedAt"  TIMESTAMP(3),
    "acceptedBy"  TEXT,
    "revokedAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_invites_token_key"        ON "workspace_invites"("token");
CREATE INDEX        "workspace_invites_workspaceId_idx"  ON "workspace_invites"("workspaceId");
CREATE INDEX        "workspace_invites_token_idx"        ON "workspace_invites"("token");

ALTER TABLE "workspace_invites"
    ADD CONSTRAINT "workspace_invites_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Create domain_verification_tokens table
CREATE TABLE "domain_verification_tokens" (
    "id"          TEXT          NOT NULL,
    "workspaceId" TEXT          NOT NULL,
    "token"       TEXT          NOT NULL,
    "expiresAt"   TIMESTAMP(3)  NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_verification_tokens_token_key"       ON "domain_verification_tokens"("token");
CREATE INDEX        "domain_verification_tokens_workspaceId_idx" ON "domain_verification_tokens"("workspaceId");

ALTER TABLE "domain_verification_tokens"
    ADD CONSTRAINT "domain_verification_tokens_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
