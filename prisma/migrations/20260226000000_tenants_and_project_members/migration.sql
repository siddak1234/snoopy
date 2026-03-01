-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('org_owner', 'org_admin', 'org_user');

CREATE TYPE "ProjectMemberRole" AS ENUM ('project_user');

-- CreateTable: tenants
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_memberships (one user = one tenant)
CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'org_user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_memberships_userId_key" ON "tenant_memberships"("userId");
CREATE INDEX "tenant_memberships_tenantId_idx" ON "tenant_memberships"("tenantId");

-- AddForeignKey tenants.ownerUserId -> users
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey tenant_memberships
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable projects: add new columns (nullable for backfill)
ALTER TABLE "projects" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "projects" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "projects" ADD COLUMN "ownerName" TEXT;
ALTER TABLE "projects" ADD COLUMN "accessCodeHash" TEXT;
ALTER TABLE "projects" ADD COLUMN "accessCodePrefix" TEXT;

-- Make userId nullable for projects (keep existing rows; new rows use ownerUserId)
ALTER TABLE "projects" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable: project_memberships
CREATE TABLE "project_memberships" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'project_user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_memberships_projectId_userId_key" ON "project_memberships"("projectId", "userId");
CREATE INDEX "project_memberships_userId_idx" ON "project_memberships"("userId");

ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK projects.tenantId -> tenants (after tenants exist)
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes for projects
CREATE INDEX "projects_tenantId_createdAt_idx" ON "projects"("tenantId", "createdAt" DESC);
CREATE INDEX "projects_ownerUserId_createdAt_idx" ON "projects"("ownerUserId", "createdAt" DESC);
CREATE INDEX "projects_tenantId_accessCodePrefix_idx" ON "projects"("tenantId", "accessCodePrefix");
