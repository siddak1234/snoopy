-- Phase 10: Remove project-level invite system and dead columns

-- DropForeignKey
ALTER TABLE "project_invites" DROP CONSTRAINT "project_invites_projectId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_userId_fkey";

-- DropIndex
DROP INDEX "projects_userId_createdAt_idx";

-- DropIndex
DROP INDEX "projects_workspaceId_accessCodePrefix_idx";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "accessCodeHash",
DROP COLUMN "accessCodePrefix",
DROP COLUMN "userId";

-- DropTable
DROP TABLE "project_invites";
