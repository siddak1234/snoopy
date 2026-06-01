"use server";

import { getAppSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/db";
import { canUserPerform } from "@/lib/project-rbac";
import { recomputeAllocationRow } from "@/lib/gl-allocations";
import { revalidatePath } from "next/cache";

// Server actions for the Flagged-for-Review modal.
//
// Auth model: gated by project_rbac canUserPerform("project:manage_settings").
// Only project owners and admins can resolve flagged items.
//
// DB model: uses Prisma over POSTGRES_URL (DB-owner credentials, bypasses RLS).
// We gate at the action layer via canUserPerform rather than relying on RLS on
// gl_code_line_items / gl_code_allocations writes, which mirrors the pattern
// used by the existing recompute work.
//
// Both actions wrap their writes in a Prisma $transaction so partial failures
// roll back. Both call revalidatePath on completion so the dashboard refreshes.

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Delete one copy of a duplicate invoice — line items for `filename` are
// removed, then the affected allocation row is recomputed from what remains.
// ---------------------------------------------------------------------------

export async function deleteDuplicateInvoiceCopyAction(
  projectId: string,
  loungeCode: string,
  filename: string,
): Promise<
  ActionResult<{
    rowsDeleted: number;
    allocationRowId: number | null;
    newTotal: number | null;
    newInvoiceCount: number | null;
  }>
> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated" };

  const allowed = await canUserPerform(
    session.user.id,
    projectId,
    "project:manage_settings",
  );
  if (!allowed) return { ok: false, error: "Not authorized" };

  if (!projectId || !loungeCode || !filename) {
    return { ok: false, error: "Missing projectId, loungeCode, or filename" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find every allocation row whose period range covers this filename's
      // line items. In practice there's exactly one (the running-total bucket
      // the file was processed into), but use DISTINCT to be safe.
      const allocRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT DISTINCT alloc.id
        FROM gl_code_allocations alloc
        WHERE alloc.project_id = ${projectId}
          AND alloc.location = ${loungeCode}
          AND EXISTS (
            SELECT 1 FROM gl_code_line_items li
            WHERE li.filename = ${filename}
              AND li.project_id = ${projectId}
              AND li.lounge_code = ${loungeCode}
              AND li."createdAt" >= alloc.period_start::date::timestamptz
              AND li."createdAt" < (alloc.period_end::date + 1)::timestamptz
          )
      `;
      const allocationRowIds = allocRows.map((r) => Number(r.id));

      // Delete the redundant copy's line items.
      const rowsDeleted = await tx.$executeRaw`
        DELETE FROM gl_code_line_items
        WHERE filename = ${filename}
          AND project_id = ${projectId}
          AND lounge_code = ${loungeCode}
      `;

      // Recompute every affected allocation row from what remains.
      let newTotal: number | null = null;
      let newInvoiceCount: number | null = null;
      for (const id of allocationRowIds) {
        const recomputed = await recomputeAllocationRow(tx, id);
        // Return the first row's new state for the action result (the modal
        // displays this period anyway, so it's the one the user cares about).
        if (newTotal === null) {
          newTotal = recomputed.total;
          newInvoiceCount = recomputed.invoice_count;
        }
      }

      return {
        rowsDeleted: Number(rowsDeleted),
        allocationRowId: allocationRowIds[0] ?? null,
        newTotal,
        newInvoiceCount,
      };
    });

    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true, data: result };
  } catch (err) {
    console.error("deleteDuplicateInvoiceCopyAction", err);
    return { ok: false, error: "Failed to delete duplicate copy" };
  }
}

// ---------------------------------------------------------------------------
// Recompute one allocation row from its responsible line items. Used for the
// "running_total_drift" flag's cleanup button.
// ---------------------------------------------------------------------------

export async function recomputeAllocationAction(
  projectId: string,
  allocationRowId: number,
): Promise<
  ActionResult<{
    total: number;
    invoice_count: number;
  }>
> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated" };

  const allowed = await canUserPerform(
    session.user.id,
    projectId,
    "project:manage_settings",
  );
  if (!allowed) return { ok: false, error: "Not authorized" };

  if (!Number.isFinite(allocationRowId) || allocationRowId <= 0) {
    return { ok: false, error: "Invalid allocation row id" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify the row belongs to this project before recomputing — defends
      // against a client passing an id for a project the user doesn't own.
      const ownerCheck = await tx.$queryRaw<Array<{ project_id: string }>>`
        SELECT project_id FROM gl_code_allocations WHERE id = ${allocationRowId}
      `;
      if (ownerCheck.length === 0) throw new Error("Allocation row not found");
      if (ownerCheck[0].project_id !== projectId) {
        throw new Error("Allocation row does not belong to this project");
      }

      const recomputed = await recomputeAllocationRow(tx, allocationRowId);
      return {
        total: recomputed.total,
        invoice_count: recomputed.invoice_count,
      };
    });

    revalidatePath(`/account/projects/${projectId}`);
    return { ok: true, data: result };
  } catch (err) {
    console.error("recomputeAllocationAction", err);
    return { ok: false, error: "Failed to recompute allocation" };
  }
}
