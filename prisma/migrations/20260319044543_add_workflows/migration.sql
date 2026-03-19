-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'draft',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "definition" JSONB NOT NULL,
    "definitionHash" TEXT,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_userId_updatedAt_idx" ON "workflows"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "workflows_workspaceId_updatedAt_idx" ON "workflows"("workspaceId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
