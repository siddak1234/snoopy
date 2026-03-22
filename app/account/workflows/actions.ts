"use server";

import { getAppSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  createWorkflow as createWorkflowDb,
  getWorkflowsForUser as getWorkflowsDb,
  getWorkflowForUser as getWorkflowDb,
  workflowNameExistsForUser as workflowNameExistsForUserDb,
  saveWorkflowDefinition as saveDefinitionDb,
  updateWorkflowMetadata as updateMetadataDb,
  deleteWorkflow as deleteWorkflowDb,
} from "@/lib/workflows";
import {
  serializeWorkflowForStorage,
  deserializeWorkflowFromStorage,
} from "@/lib/workflow-serializer";
import type { CanvasState, WorkflowDefinition } from "@/lib/workflow-types";

const NAME_MIN = 2;
const NAME_MAX = 100;

// ─── Create ───────────────────────────────────────────────────────────

export type CreateWorkflowResult =
  | { ok: true; workflowId: string }
  | { ok: false; error: string };

export async function createWorkflowAction(
  name: string,
  opts?: {
    description?: string;
    projectId?: string;
    canvasState?: CanvasState;
  },
): Promise<CreateWorkflowResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN)
    return { ok: false, error: `Name must be at least ${NAME_MIN} characters.` };
  if (trimmed.length > NAME_MAX)
    return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` };
  if (await workflowNameExistsForUserDb(session.user.id, trimmed)) {
    return {
      ok: false,
      error: "Workflow name is already taken. Please choose a different name.",
    };
  }

  const definition = opts?.canvasState
    ? serializeWorkflowForStorage(opts.canvasState)
    : undefined;

  try {
    const workflow = await createWorkflowDb(session.user.id, {
      name: trimmed,
      description: opts?.description,
      projectId: opts?.projectId,
      definition,
    });
    return { ok: true, workflowId: workflow.id };
  } catch (e) {
    console.error("createWorkflowAction", e);
    return { ok: false, error: "Failed to create workflow." };
  }
}

// ─── List (no definition blob — fast for dashboards) ──────────────────

export type WorkflowListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ListWorkflowsResult =
  | { ok: true; workflows: WorkflowListItem[] }
  | { ok: false; error: string };

export async function listWorkflowsAction(): Promise<ListWorkflowsResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  try {
    const rows = await getWorkflowsDb(session.user.id);
    return {
      ok: true,
      workflows: rows.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    };
  } catch (e) {
    console.error("listWorkflowsAction", e);
    return { ok: false, error: "Failed to list workflows." };
  }
}

// ─── Get single (includes full definition) ────────────────────────────

export type WorkflowDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
};

export type GetWorkflowResult =
  | { ok: true; workflow: WorkflowDetail }
  | { ok: false; error: string };

export async function getWorkflowAction(
  workflowId: string,
): Promise<GetWorkflowResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  try {
    const row = await getWorkflowDb(workflowId, session.user.id);
    if (!row) return { ok: false, error: "Workflow not found." };

    return {
      ok: true,
      workflow: {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        definition: deserializeWorkflowFromStorage(row.definition),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  } catch (e) {
    console.error("getWorkflowAction", e);
    return { ok: false, error: "Failed to load workflow." };
  }
}

// ─── Save definition (serializes canvas → compact JSON, hash-guarded) ─

export type SaveWorkflowResult =
  | { ok: true; saved: boolean; updatedAt?: string }
  | { ok: false; error: string };

/**
 * Accepts raw canvas state, serializes it (stripping UI-only data), then
 * writes only if the content hash differs from what's already stored.
 */
export async function saveWorkflowAction(
  workflowId: string,
  canvasState: CanvasState,
): Promise<SaveWorkflowResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  const definition = serializeWorkflowForStorage(canvasState);

  try {
    const result = await saveDefinitionDb(
      workflowId,
      session.user.id,
      definition,
    );
    if (result.saved) {
      return {
        ok: true,
        saved: true,
        updatedAt: result.updatedAt.toISOString(),
      };
    }
    return { ok: true, saved: false };
  } catch (e) {
    console.error("saveWorkflowAction", e);
    return { ok: false, error: "Failed to save workflow." };
  }
}

// ─── Update metadata ──────────────────────────────────────────────────

export type UpdateWorkflowResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateWorkflowMetadataAction(
  workflowId: string,
  data: {
    name?: string;
    description?: string | null;
    status?: string;
    projectId?: string | null;
  },
): Promise<UpdateWorkflowResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (trimmed.length < NAME_MIN)
      return { ok: false, error: `Name must be at least ${NAME_MIN} characters.` };
    if (trimmed.length > NAME_MAX)
      return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` };
    if (
      await workflowNameExistsForUserDb(session.user.id, trimmed, {
        excludeWorkflowId: workflowId,
      })
    ) {
      return {
        ok: false,
        error: "Workflow name is already taken. Please choose a different name.",
      };
    }
  }

  try {
    const result = await updateMetadataDb(
      workflowId,
      session.user.id,
      data as Parameters<typeof updateMetadataDb>[2],
    );
    if (!result) return { ok: false, error: "Workflow not found." };
    revalidatePath("/account/workflows");
    return { ok: true };
  } catch (e) {
    console.error("updateWorkflowMetadataAction", e);
    return { ok: false, error: "Failed to update workflow." };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────

export type DeleteWorkflowResult = { ok: true } | { ok: false; error: string };

export async function deleteWorkflowAction(
  workflowId: string,
): Promise<DeleteWorkflowResult> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  try {
    const deleted = await deleteWorkflowDb(workflowId, session.user.id);
    if (!deleted)
      return { ok: false, error: "Workflow not found or access denied." };
    revalidatePath("/account/workflows");
    revalidatePath("/account/workflow-design");
    return { ok: true };
  } catch (e) {
    console.error("deleteWorkflowAction", e);
    return { ok: false, error: "Failed to delete workflow." };
  }
}
