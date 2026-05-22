"use server";

import { getAppSession } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Invoice line-item editing — server action (Phase 3).
//
// Thin, authenticated bridge to the save_invoice_edits() Postgres function
// (Phase 2). The function is SECURITY DEFINER but self-gates on
// is_project_member(auth.uid()), so we MUST call it through the user's
// authenticated server client (lib/supabase/server) — never the service-role
// admin client — so the caller's JWT reaches the function.
//
// All validation of *values* (numeric fields, valid GL codes, row ownership)
// happens inside the function, atomically with the write + audit + allocation
// recompute. This action only authenticates, whitelists field *names*, and
// injects edited_by from the session (never trusts it from the client).
// ---------------------------------------------------------------------------

// Editable per-line fields. GL_Category is intentionally absent: it is derived
// server-side from GL_Account via gl_account_map so the two never disagree.
const EDITABLE_LINE_FIELDS = new Set([
  "Item",
  "line_notes",
  "QTY",
  "CU_Price",
  "Amount",
  "Confidence",
  "GL_Account",
]);

// Invoice-level fields (applied to every row of the filename).
const EDITABLE_HEADER_FIELDS = new Set([
  "Merchant",
  "Invoice_Number",
  "Invoice_Date",
  "Status",
  "lounge_code",
]);

export type LineItemEditableFields = {
  Item?: string | null;
  line_notes?: string | null;
  QTY?: string | null;
  CU_Price?: string | null;
  Amount?: string | null;
  Confidence?: string | null;
  /** GL account code, e.g. "5080". Sets GL_Account + GL_Category (derived). */
  GL_Account?: string;
};

export type LineUpdate = {
  id: number | string;
  fields: LineItemEditableFields;
};

export type HeaderUpdates = Partial<
  Record<"Merchant" | "Invoice_Number" | "Invoice_Date" | "Status" | "lounge_code", string | null>
>;

export type SaveInvoiceEditsInput = {
  projectId: string;
  filename: string;
  loungeCode: string | null;
  lineUpdates?: LineUpdate[];
  lineDeletes?: (number | string)[];
  headerUpdates?: HeaderUpdates;
};

export type RecomputedPeriod = {
  location: string;
  period_start: string;
  period_end: string;
};

export type SaveInvoiceEditsSummary = {
  ok: true;
  fields_changed: number;
  deletes: number;
  headers_changed: number;
  audit_rows: number;
  recomputed: RecomputedPeriod[];
};

export type SaveInvoiceEditsResult =
  | { ok: true; summary: SaveInvoiceEditsSummary }
  | { ok: false; error: string };

/**
 * Persist a batch of edits to one invoice's line items + header, then recompute
 * the affected allocation rows — all atomically inside save_invoice_edits().
 */
export async function saveInvoiceEditsAction(
  input: SaveInvoiceEditsInput
): Promise<SaveInvoiceEditsResult> {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to edit invoices." };
  }

  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid request." };
  }
  if (!input.projectId || !input.filename) {
    return { ok: false, error: "Missing project or invoice reference." };
  }

  const lineUpdates = Array.isArray(input.lineUpdates) ? input.lineUpdates : [];
  const lineDeletes = Array.isArray(input.lineDeletes) ? input.lineDeletes : [];
  const headerUpdates =
    input.headerUpdates && typeof input.headerUpdates === "object"
      ? input.headerUpdates
      : {};

  // Whitelist field NAMES here; the SQL function validates values.
  for (const u of lineUpdates) {
    if (!u || (typeof u.id !== "number" && typeof u.id !== "string")) {
      return { ok: false, error: "Invalid line item reference." };
    }
    if (!u.fields || typeof u.fields !== "object") {
      return { ok: false, error: "Invalid line item changes." };
    }
    for (const key of Object.keys(u.fields)) {
      if (!EDITABLE_LINE_FIELDS.has(key)) {
        return { ok: false, error: `Field "${key}" is not editable.` };
      }
    }
  }
  for (const key of Object.keys(headerUpdates)) {
    if (!EDITABLE_HEADER_FIELDS.has(key)) {
      return { ok: false, error: `Header field "${key}" is not editable.` };
    }
  }

  if (
    lineUpdates.length === 0 &&
    lineDeletes.length === 0 &&
    Object.keys(headerUpdates).length === 0
  ) {
    return { ok: false, error: "No changes to save." };
  }

  // edited_by comes from the session, never the client — audit-trail integrity.
  const payload = {
    project_id: input.projectId,
    filename: input.filename,
    lounge_code: input.loungeCode ?? null,
    edited_by: session.user.id,
    line_updates: lineUpdates.map((u) => ({ id: u.id, fields: u.fields })),
    line_deletes: lineDeletes,
    header_updates: headerUpdates,
  };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_invoice_edits", { payload });
    if (error) {
      console.error("saveInvoiceEditsAction rpc", error.message);
      return { ok: false, error: toFriendlyError(error.message) };
    }
    return { ok: true, summary: data as SaveInvoiceEditsSummary };
  } catch (e) {
    console.error("saveInvoiceEditsAction", e);
    return { ok: false, error: "Failed to save changes. Please try again." };
  }
}

/** Map raw Postgres exception text from save_invoice_edits() to UI-safe copy. */
function toFriendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not authorized")) {
    return "You don't have permission to edit this invoice.";
  }
  if (m.includes("is not numeric")) {
    // e.g. 'Amount value "abc" is not numeric' — already user-readable.
    return message;
  }
  if (m.includes("unknown gl code") || m.includes("is not selectable")) {
    return message;
  }
  if (m.includes("not found")) {
    return "A line item no longer exists. Refresh the invoice and try again.";
  }
  if (m.includes("not editable")) {
    return message;
  }
  return "Could not save changes. Please try again.";
}
