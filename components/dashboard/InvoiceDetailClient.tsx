"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { InvoiceFileViewer } from "@/components/dashboard/InvoiceFileViewer";
import { GlCodeCombobox, type GlOption } from "@/components/dashboard/GlCodeCombobox";
import {
  saveInvoiceEditsAction,
  type LineUpdate,
  type HeaderUpdates,
  type LineItemEditableFields,
} from "@/app/account/projects/[id]/invoices/detail/actions";

// One line item from gl_code_line_items. All numeric-looking fields are stored
// as text and cast to numeric for display. Capitalization matches the actual
// Postgres column names exactly.
type LineItem = {
  id: string | number;
  filename: string;
  line_item_index: string | null;
  Item: string | null;
  GL_Account: string | null;
  GL_Category: string | null;
  line_notes: string | null;
  QTY: string | null;
  CU_Price: string | null;
  Amount: string | null;
  Confidence: string | null;
  Merchant: string | null;
  Invoice_Number: string | null;
  Invoice_Date: string | null;
  Status: string | null;
};

const TABLE = "gl_code_line_items";
const GL_MAP_TABLE = "gl_account_map";

// Cent-level precision on the line-item page (unit prices commonly carry
// cents — e.g., $29.19 — and rounding loses meaningful information). The
// dashboard's headline KPIs continue to round to whole dollars; this is a
// per-page choice for the detail view.
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFmt = new Intl.NumberFormat("en-US");

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// Strict YYYY-MM-DD guard — same convention as the invoices_for_project RPC.
function isValidIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Sortable numeric columns. Text columns (Item / GL) stay in document order.
type SortKey = "index" | "qty" | "unitPrice" | "amount" | "confidence";
type SortDir = "asc" | "desc";

// Pull a numeric sort value out of a (text-stored) line item field. NaN/null
// values bubble to the end on asc, top on desc. line_item_index uses parseInt
// to avoid the lexicographic '10' < '2' problem.
function getSortValue(item: LineItem, key: SortKey): number {
  const raw =
    key === "index"
      ? item.line_item_index
      : key === "qty"
        ? item.QTY
        : key === "unitPrice"
          ? item.CU_Price
          : key === "amount"
            ? item.Amount
            : item.Confidence;
  if (raw == null) return Number.POSITIVE_INFINITY;
  const n = key === "index" ? parseInt(raw, 10) : Number(raw);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

// ── Editing types ─────────────────────────────────────────────────────────
// Draft holds only the fields the user changed on a row. GL_Category is kept
// for display; only GL_Account is sent to the server (which derives Category).
type EditableField =
  | "Item"
  | "line_notes"
  | "QTY"
  | "CU_Price"
  | "Confidence"
  | "GL_Account"
  | "GL_Category";
type LineDraft = Partial<Record<EditableField, string>>;

const STATUS_OPTIONS = ["Complete", "In Progress"];

// Round qty*price to a 2-dp currency string (Amount is stored as text).
function deriveAmount(qty: string, price: string): string | null {
  const q = Number(qty);
  const p = Number(price);
  if (qty.trim() === "" || price.trim() === "" || isNaN(q) || isNaN(p)) return null;
  return (Math.round(q * p * 100) / 100).toFixed(2);
}

export function InvoiceDetailClient({
  projectId,
  filename,
  loungeCode,
}: {
  projectId: string;
  filename: string;
  loungeCode: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<LineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default: line item index ascending — matches the order shown on the PDF.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "index",
    dir: "asc",
  });

  // ── Edit state ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [headerDraft, setHeaderDraft] = useState<HeaderUpdates>({});
  const [glOptions, setGlOptions] = useState<GlOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pure fetch (no setState) so it can be reused for the initial load and the
  // post-save reload without tripping the set-state-in-effect lint rule.
  // Returns null on query error.
  const fetchItems = useCallback(async (): Promise<LineItem[] | null> => {
    // project_id is the access key (RLS gates on project_memberships). The
    // additional filename + lounge filters scope to the specific invoice.
    let query = supabase
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .eq("filename", filename);
    if (loungeCode) query = query.eq("lounge_code", loungeCode);
    const { data, error: qError } = await query;
    if (qError) return null;
    return (data ?? []) as LineItem[];
  }, [supabase, projectId, filename, loungeCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchItems();
      if (cancelled) return;
      if (res === null) setError("Could not load invoice details.");
      else setItems(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  // Load the project's chart of accounts once for the GL dropdown (RLS-gated).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qError } = await supabase
        .from(GL_MAP_TABLE)
        .select("code, full_name, parent_code, is_selectable")
        .eq("project_id", projectId);
      if (cancelled || qError || !data) return;
      const labelByCode = new Map<string, string>();
      for (const r of data as { code: string; full_name: string }[]) {
        labelByCode.set(r.code, (r.full_name.split(":").pop() ?? r.full_name).trim());
      }
      const opts: GlOption[] = (data as {
        code: string;
        full_name: string;
        parent_code: string | null;
        is_selectable: boolean;
      }[])
        .filter((r) => r.is_selectable)
        .map((r) => ({
          code: r.code,
          label: labelByCode.get(r.code) ?? r.code,
          fullName: r.full_name,
          group: (r.parent_code && labelByCode.get(r.parent_code)) || "Other",
        }))
        .sort((a, b) =>
          a.group === b.group ? a.code.localeCompare(b.code) : a.group.localeCompare(b.group),
        );
      setGlOptions(opts);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, projectId]);

  // Sort runs in render rather than once at fetch — clicking a header should
  // reorder the visible rows without re-querying.
  const sortedItems = useMemo(() => {
    if (!items) return null;
    const dirMul = sort.dir === "asc" ? 1 : -1;
    return items.slice().sort((a, b) => {
      const cmp = getSortValue(a, sort.key) - getSortValue(b, sort.key);
      if (cmp !== 0) return cmp * dirMul;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items, sort]);

  // Click on the active column toggles asc⇄desc. Disabled while editing so
  // rows don't jump under the user mid-edit.
  const handleSort = (key: SortKey) => {
    if (editing) return;
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  // ── Effective value getters (draft overlay over the stored row) ─────────
  const fieldValue = useCallback(
    (item: LineItem, field: EditableField): string => {
      const d = lineDrafts[String(item.id)];
      if (d && field in d) return d[field] ?? "";
      const v = item[field as keyof LineItem];
      return v == null ? "" : String(v);
    },
    [lineDrafts],
  );

  // Amount = derived Qty×Price when Qty or Price was edited on this row;
  // otherwise the stored Amount (so untouched rounding-mismatch rows are left
  // exactly as ingested).
  const effectiveAmount = useCallback(
    (item: LineItem): number => {
      const d = lineDrafts[String(item.id)];
      if (d && ("QTY" in d || "CU_Price" in d)) {
        const derived = deriveAmount(fieldValue(item, "QTY"), fieldValue(item, "CU_Price"));
        if (derived != null) return Number(derived);
      }
      return Number(item.Amount);
    },
    [lineDrafts, fieldValue],
  );

  const setLineField = (id: string | number, field: EditableField, value: string) => {
    setLineDrafts((prev) => ({ ...prev, [String(id)]: { ...prev[String(id)], [field]: value } }));
  };
  const setGl = (id: string | number, code: string, fullName: string) => {
    setLineDrafts((prev) => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], GL_Account: code, GL_Category: fullName },
    }));
  };
  const toggleDelete = (id: string | number) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const enterEdit = () => {
    setEditing(true);
    setSaveError(null);
  };
  const cancelEdit = () => {
    setEditing(false);
    setLineDrafts({});
    setDeletedIds(new Set());
    setHeaderDraft({});
    setSaveError(null);
  };

  const dirty =
    Object.keys(lineDrafts).length > 0 ||
    deletedIds.size > 0 ||
    Object.keys(headerDraft).length > 0;

  const handleSave = async () => {
    if (!items) return;
    setSaving(true);
    setSaveError(null);

    const lineUpdates: LineUpdate[] = [];
    for (const it of items) {
      const id = String(it.id);
      if (deletedIds.has(id)) continue;
      const d = lineDrafts[id];
      if (!d) continue;
      const fields: LineItemEditableFields = {};
      (["Item", "line_notes", "QTY", "CU_Price", "Confidence", "GL_Account"] as const).forEach((k) => {
        if (k in d) fields[k] = d[k];
      });
      // Derive Amount only when Qty or Price changed on this row.
      if ("QTY" in d || "CU_Price" in d) {
        const derived = deriveAmount(fieldValue(it, "QTY"), fieldValue(it, "CU_Price"));
        if (derived != null) fields.Amount = derived;
      }
      if (Object.keys(fields).length > 0) lineUpdates.push({ id: it.id, fields });
    }

    const lineDeletes = items.filter((it) => deletedIds.has(String(it.id))).map((it) => it.id);

    const res = await saveInvoiceEditsAction({
      projectId,
      filename,
      loungeCode,
      lineUpdates,
      lineDeletes,
      headerUpdates: headerDraft,
    });

    if (!res.ok) {
      setSaveError(res.error);
      setSaving(false);
      return;
    }
    // Success: reload from the DB and exit edit mode.
    const reloaded = await fetchItems();
    if (reloaded !== null) setItems(reloaded);
    setLineDrafts({});
    setDeletedIds(new Set());
    setHeaderDraft({});
    setEditing(false);
    setSaving(false);
  };

  if (error) {
    return (
      <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
        {error}
      </p>
    );
  }

  if (items === null) {
    return <p className="text-sm text-[var(--muted)]">Loading invoice…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Invoice not found for this project.
      </p>
    );
  }

  // Header summary derived from the first row — all rows of one invoice share
  // these fields by definition (collapsed by filename upstream).
  const first = items[0];
  const headerValue = (field: keyof HeaderUpdates): string => {
    if (field in headerDraft) return headerDraft[field] ?? "";
    const v = first[field as keyof LineItem];
    return v == null ? "" : String(v);
  };
  const setHeaderField = (field: keyof HeaderUpdates, value: string) =>
    setHeaderDraft((prev) => ({ ...prev, [field]: value }));

  // Total reflects live derived amounts (and excludes staged deletes) while
  // editing; otherwise it's the straight sum of stored amounts.
  const liveItems = editing
    ? items.filter((it) => !deletedIds.has(String(it.id)))
    : items;
  const total = liveItems.reduce(
    (s, it) => s + (editing ? effectiveAmount(it) || 0 : Number(it.Amount) || 0),
    0,
  );
  const invoiceDateText = isValidIsoDate(first.Invoice_Date)
    ? dateFmt.format(new Date(`${first.Invoice_Date}T00:00:00Z`))
    : "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Edit controls */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saveError ? (
          <span className="mr-auto rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-1.5 text-xs text-[var(--error-text)]">
            {saveError}
          </span>
        ) : null}
        {editing ? (
          <>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn-primary inline-flex !min-h-0 !px-4 !py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={enterEdit}
            className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
          >
            Edit invoice
          </button>
        )}
      </div>

      {/* Header summary */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryField label="Merchant">
          {editing ? (
            <input
              value={headerValue("Merchant")}
              onChange={(e) => setHeaderField("Merchant", e.target.value)}
              className={inputCls}
            />
          ) : (
            <span className="text-sm font-medium text-[var(--text)]">{first.Merchant ?? "—"}</span>
          )}
        </SummaryField>
        <SummaryField label="Invoice number">
          {editing ? (
            <input
              value={headerValue("Invoice_Number")}
              onChange={(e) => setHeaderField("Invoice_Number", e.target.value)}
              className={inputCls}
            />
          ) : (
            <span className="text-sm font-medium text-[var(--text)]">{first.Invoice_Number ?? "—"}</span>
          )}
        </SummaryField>
        <SummaryField label="Invoice date">
          {editing ? (
            <input
              type="date"
              value={isValidIsoDate(headerValue("Invoice_Date")) ? headerValue("Invoice_Date") : ""}
              onChange={(e) => setHeaderField("Invoice_Date", e.target.value)}
              className={inputCls}
            />
          ) : (
            <span className="text-sm font-medium text-[var(--text)]">{invoiceDateText}</span>
          )}
        </SummaryField>
        <SummaryField label="Status">
          {editing ? (
            <select
              value={headerValue("Status")}
              onChange={(e) => setHeaderField("Status", e.target.value)}
              className={inputCls}
            >
              {/* Preserve an unexpected legacy value as a selectable option */}
              {!STATUS_OPTIONS.includes(headerValue("Status")) && headerValue("Status") !== "" ? (
                <option value={headerValue("Status")}>{headerValue("Status")}</option>
              ) : null}
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <StatusPill status={first.Status} />
          )}
        </SummaryField>
        <SummaryField label="Total">
          <span className="text-sm font-medium tabular-nums text-[var(--text)]">
            {currencyFmt.format(total)}
          </span>
        </SummaryField>
        <SummaryField label="Line items">
          <span className="text-sm font-medium tabular-nums text-[var(--text)]">
            {integerFmt.format(liveItems.length)}
          </span>
        </SummaryField>
      </dl>

      {/* Stacked view: PDF on top, line items below. */}
      <div className="flex flex-col gap-6">
        {loungeCode ? (
          <InvoiceFileViewer projectId={projectId} filename={filename} loungeCode={loungeCode} />
        ) : null}

        <div className="border-t border-[var(--ring)] pt-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Line items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  <SortableHeader label="#" sortKey="index" align="right" sort={sort} onSort={handleSort} editing={editing} />
                  <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">Item / Notes</th>
                  <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">GL Account / Category</th>
                  <SortableHeader label="Qty" sortKey="qty" align="right" sort={sort} onSort={handleSort} editing={editing} />
                  <SortableHeader label="Unit Price" sortKey="unitPrice" align="right" sort={sort} onSort={handleSort} editing={editing} />
                  <SortableHeader label="Amount" sortKey="amount" align="right" sort={sort} onSort={handleSort} editing={editing} />
                  <SortableHeader label="Conf." sortKey="confidence" align="right" sort={sort} onSort={handleSort} editing={editing} />
                  {editing ? (
                    <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">
                      <span className="sr-only">Delete</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedItems?.map((it) =>
                  editing ? (
                    <EditableLineItemRow
                      key={String(it.id)}
                      item={it}
                      glOptions={glOptions}
                      deleted={deletedIds.has(String(it.id))}
                      fieldValue={fieldValue}
                      effectiveAmount={effectiveAmount}
                      onField={setLineField}
                      onGl={setGl}
                      onToggleDelete={toggleDelete}
                    />
                  ) : (
                    <LineItemRow key={String(it.id)} item={it} />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-[var(--ring)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]";
const numInputCls = `${inputCls} text-right tabular-nums`;

function SummaryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

// Header for a sortable numeric column. Whole th is clickable; chevron shows
// the active direction. Sorting is disabled while editing.
function SortableHeader({
  label,
  sortKey,
  align,
  sort,
  onSort,
  editing,
}: {
  label: string;
  sortKey: SortKey;
  align: "left" | "right";
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  editing?: boolean;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  if (editing) {
    return (
      <th
        className={`border-b border-[var(--ring)] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        {label}
      </th>
    );
  }
  return (
    <th
      aria-sort={ariaSort}
      className={`border-b border-[var(--ring)] px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 text-[10px] uppercase tracking-wide transition hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] rounded ${
          isActive ? "text-[var(--text)]" : "text-[var(--muted)]"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
        aria-label={`Sort by ${label} ${isActive && sort.dir === "asc" ? "descending" : "ascending"}`}
      >
        <span>{label}</span>
        <SortIcon direction={isActive ? sort.dir : null} />
      </button>
    </th>
  );
}

function SortIcon({ direction }: { direction: SortDir | null }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" className="shrink-0">
      <path d="M5 1 L8.5 4.5 L1.5 4.5 Z" fill="currentColor" opacity={direction === "asc" ? 1 : 0.3} />
      <path d="M5 11 L1.5 7.5 L8.5 7.5 Z" fill="currentColor" opacity={direction === "desc" ? 1 : 0.3} />
    </svg>
  );
}

function LineItemRow({ item }: { item: LineItem }) {
  const qty = Number(item.QTY);
  const unitPrice = Number(item.CU_Price);
  const amount = Number(item.Amount);
  const confidence = Number(item.Confidence);
  const isNegative = !isNaN(amount) && amount < 0;

  return (
    <tr className="border-b border-[var(--ring)]/50 align-top last:border-b-0">
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--muted)]">
        {item.line_item_index ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium leading-snug text-[var(--text)] break-words">
          {item.Item ?? "—"}
        </p>
        {item.line_notes ? (
          <p className="mt-1 text-xs leading-snug text-[var(--muted)] break-words">
            {item.line_notes}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium tabular-nums text-[var(--text)] break-words">
          {item.GL_Account ?? "—"}
        </p>
        {item.GL_Category ? (
          <p className="mt-1 text-xs leading-snug text-[var(--muted)] break-words">
            {item.GL_Category}
          </p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-[var(--text)]">
        {isNaN(qty) ? "—" : integerFmt.format(qty)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-[var(--text)]">
        {isNaN(unitPrice) ? "—" : currencyFmt.format(unitPrice)}
      </td>
      <td
        className={
          isNegative
            ? "whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--error-text-muted)]"
            : "whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--text)]"
        }
      >
        {isNaN(amount) ? "—" : currencyFmt.format(amount)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-[var(--muted)]">
        {isNaN(confidence) ? "—" : `${Math.round(confidence)}%`}
      </td>
    </tr>
  );
}

// Editable row: text inputs for Item/Notes, GL combobox, number inputs for
// Qty/Unit Price/Confidence, derived (read-only) Amount, and a delete toggle.
function EditableLineItemRow({
  item,
  glOptions,
  deleted,
  fieldValue,
  effectiveAmount,
  onField,
  onGl,
  onToggleDelete,
}: {
  item: LineItem;
  glOptions: GlOption[];
  deleted: boolean;
  fieldValue: (item: LineItem, field: EditableField) => string;
  effectiveAmount: (item: LineItem) => number;
  onField: (id: string | number, field: EditableField, value: string) => void;
  onGl: (id: string | number, code: string, fullName: string) => void;
  onToggleDelete: (id: string | number) => void;
}) {
  const amount = effectiveAmount(item);
  const isNegative = !isNaN(amount) && amount < 0;
  const glCategory = fieldValue(item, "GL_Category") || item.GL_Category || "";

  return (
    <tr
      className={`border-b border-[var(--ring)]/50 align-top last:border-b-0 ${
        deleted ? "opacity-40" : ""
      }`}
    >
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--muted)]">
        {item.line_item_index ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        <input
          value={fieldValue(item, "Item")}
          onChange={(e) => onField(item.id, "Item", e.target.value)}
          disabled={deleted}
          placeholder="Item"
          className={inputCls}
        />
        <input
          value={fieldValue(item, "line_notes")}
          onChange={(e) => onField(item.id, "line_notes", e.target.value)}
          disabled={deleted}
          placeholder="Notes"
          className={`${inputCls} mt-1 text-xs`}
        />
      </td>
      <td className="px-3 py-2.5">
        <GlCodeCombobox
          options={glOptions}
          value={fieldValue(item, "GL_Account") || null}
          onChange={(code, fullName) => onGl(item.id, code, fullName)}
          disabled={deleted}
        />
        {glCategory ? (
          <p className="mt-1 text-xs leading-snug text-[var(--muted)] break-words">{glCategory}</p>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          step="any"
          value={fieldValue(item, "QTY")}
          onChange={(e) => onField(item.id, "QTY", e.target.value)}
          disabled={deleted}
          className={numInputCls}
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          step="any"
          value={fieldValue(item, "CU_Price")}
          onChange={(e) => onField(item.id, "CU_Price", e.target.value)}
          disabled={deleted}
          className={numInputCls}
        />
      </td>
      {/* Amount is derived (Qty × Price), not editable. */}
      <td
        className={
          isNegative
            ? "whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--error-text-muted)]"
            : "whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--text)]"
        }
        title="Derived from Qty × Unit Price"
      >
        {isNaN(amount) ? "—" : currencyFmt.format(amount)}
      </td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          step="any"
          value={fieldValue(item, "Confidence")}
          onChange={(e) => onField(item.id, "Confidence", e.target.value)}
          disabled={deleted}
          className={numInputCls}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={() => onToggleDelete(item.id)}
          className="text-xs text-[var(--muted)] underline hover:text-[var(--error-text)]"
          aria-label={deleted ? "Restore line item" : "Delete line item"}
        >
          {deleted ? "Undo" : "Delete"}
        </button>
      </td>
    </tr>
  );
}
