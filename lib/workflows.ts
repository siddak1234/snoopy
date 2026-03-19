import { prisma } from "@/lib/db";
import type { WorkflowStatus } from "@prisma/client";
import { ensureTenantForUser } from "@/lib/tenant";
import {
  emptyDefinition,
  hashDefinition,
  type WorkflowDefinition,
} from "@/lib/workflow-serializer";

// ─── Create ───────────────────────────────────────────────────────────

export async function createWorkflow(
  userId: string,
  data: {
    name: string;
    description?: string | null;
    projectId?: string | null;
    definition?: WorkflowDefinition;
  },
) {
  const workspaceId = await ensureTenantForUser(userId);
  const definition = data.definition ?? emptyDefinition();
  const definitionHash = hashDefinition(definition);

  return prisma.workflow.create({
    data: {
      userId,
      workspaceId,
      projectId: data.projectId ?? null,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: "draft",
      definition: definition as object,
      definitionHash,
      nodeCount: definition.nodes.length,
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ─── List (lightweight — no definition blob) ──────────────────────────

export async function getWorkflowsForUser(
  userId: string,
  opts?: {
    workspaceId?: string;
    projectId?: string;
    status?: WorkflowStatus;
  },
) {
  return prisma.workflow.findMany({
    where: {
      userId,
      ...(opts?.workspaceId && { workspaceId: opts.workspaceId }),
      ...(opts?.projectId && { projectId: opts.projectId }),
      ...(opts?.status && { status: opts.status }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      nodeCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ─── Get single (full definition) ────────────────────────────────────

export async function getWorkflowForUser(
  workflowId: string,
  userId: string,
) {
  return prisma.workflow.findFirst({
    where: { id: workflowId, userId },
  });
}

// ─── Save definition (hash-guarded) ──────────────────────────────────

export type SaveResult =
  | { saved: true; updatedAt: Date }
  | { saved: false; reason: "unchanged" | "not_found" };

/**
 * Writes the definition only when the content hash differs from what is
 * already stored. This prevents autosave from generating pointless UPDATE
 * churn on the DB when the user hasn't actually changed anything.
 */
export async function saveWorkflowDefinition(
  workflowId: string,
  userId: string,
  definition: WorkflowDefinition,
): Promise<SaveResult> {
  const newHash = hashDefinition(definition);

  const existing = await prisma.workflow.findFirst({
    where: { id: workflowId, userId },
    select: { definitionHash: true },
  });

  if (!existing) return { saved: false, reason: "not_found" };
  if (existing.definitionHash === newHash) {
    return { saved: false, reason: "unchanged" };
  }

  const updated = await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      definition: definition as object,
      definitionHash: newHash,
      nodeCount: definition.nodes.length,
    },
    select: { updatedAt: true },
  });

  return { saved: true, updatedAt: updated.updatedAt };
}

// ─── Update metadata ──────────────────────────────────────────────────

export async function updateWorkflowMetadata(
  workflowId: string,
  userId: string,
  data: {
    name?: string;
    description?: string | null;
    status?: WorkflowStatus;
    projectId?: string | null;
  },
) {
  const existing = await prisma.workflow.findFirst({
    where: { id: workflowId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.workflow.update({
    where: { id: workflowId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && {
        description: data.description?.trim() || null,
      }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.projectId !== undefined && { projectId: data.projectId }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      updatedAt: true,
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────

export async function deleteWorkflow(
  workflowId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.workflow.deleteMany({
    where: { id: workflowId, userId },
  });
  return result.count > 0;
}
