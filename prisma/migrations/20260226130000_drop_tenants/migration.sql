-- Drop FK and column from projects (consolidated to workspaceId)
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_tenantId_fkey";
DROP INDEX IF EXISTS "projects_tenantId_createdAt_idx";
DROP INDEX IF EXISTS "projects_tenantId_accessCodePrefix_idx";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "tenantId";

-- Drop tenant tables
DROP TABLE IF EXISTS "tenant_memberships";
DROP TABLE IF EXISTS "tenants";
