"use client";

import { useEffect, useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import {
  FLAG_REASON_LABELS,
  type FlagReason,
  type FlaggedItem,
} from "@/lib/flagged-invoices";
import {
  deleteDuplicateInvoiceCopyAction,
  recomputeAllocationAction,
} from "@/app/account/projects/[id]/invoices/flagged/actions";

// Modal listing flagged items for the current (project, lounge, period) scope.
// Each card knows how to resolve its own reason — delete duplicate copy,
// recompute drift, view invoice for the rest. On a successful action the card
// removes itself and the parent dashboard refreshes via revalidatePath.

const REASON_ORDER: FlagReason[] = [
  "duplicate_invoice",
  "running_total_drift",
  "low_confidence",
  "orphan_refund",
  "high_value",
  "date_outside_period",
];

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function FlaggedItemsModal({
  open,
  onClose,
  projectId,
  loungeCode,
  periodStart,
  periodEnd,
  items: initialItems,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  loungeCode: string;
  periodStart: string;
  periodEnd: string;
  items: FlaggedItem[];
}) {
  // Local copy so we can optimistically remove resolved cards without waiting
  // for the dashboard to re-fetch.
  const [items, setItems] = useState<FlaggedItem[]>(initialItems);

  // Resync from the parent when the modal opens or when the parent fetches
  // new flagged data. Deferred via queueMicrotask so the setState doesn't
  // happen synchronously inside the effect body (codebase convention).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setItems(initialItems));
  }, [open, initialItems]);

  // Escape closes (Modal handles backdrop click and scroll lock).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Group items by reason, in display order.
  const grouped = new Map<FlagReason, FlaggedItem[]>();
  for (const reason of REASON_ORDER) grouped.set(reason, []);
  for (const item of items) {
    const bucket = grouped.get(item.reason);
    if (bucket) bucket.push(item);
  }

  // Stable key for an item — use filename when available, else the reason+invoice.
  function itemKey(item: FlaggedItem): string {
    if (item.filename) return `${item.reason}:${item.filename}`;
    if (item.reason === "running_total_drift") {
      return `running_total_drift:${item.details.allocation_row_id}`;
    }
    return `${item.reason}:${item.merchant ?? ""}:${item.invoice_number ?? ""}`;
  }

  function removeItem(key: string) {
    setItems((curr) => curr.filter((i) => itemKey(i) !== key));
  }

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy="flagged-modal-title"
      bubble
      zIndex={100}
      contentClassName="max-w-3xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="flagged-modal-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Flagged for review
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {loungeCode} · {periodStart} to {periodEnd}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary inline-flex !min-h-0 !px-3 !py-1.5 text-sm"
          aria-label="Close"
        >
          Close
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          All clear — nothing flagged for this period.
        </div>
      ) : (
        <div className="mt-5 max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {REASON_ORDER.map((reason) => {
            const bucket = grouped.get(reason) ?? [];
            if (bucket.length === 0) return null;
            return (
              <section key={reason}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {FLAG_REASON_LABELS[reason]} · {bucket.length}
                </h3>
                <div className="space-y-2.5">
                  {bucket.map((item) => (
                    <FlaggedCard
                      key={itemKey(item)}
                      item={item}
                      projectId={projectId}
                      loungeCode={loungeCode}
                      onResolved={() => removeItem(itemKey(item))}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Per-item card
// ---------------------------------------------------------------------------

function FlaggedCard({
  item,
  projectId,
  loungeCode,
  onResolved,
}: {
  item: FlaggedItem;
  projectId: string;
  loungeCode: string;
  onResolved: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--ring)] bg-[var(--card)] p-3.5">
      {item.reason === "duplicate_invoice" ? (
        <DuplicateInvoiceCard
          item={item}
          projectId={projectId}
          loungeCode={loungeCode}
          onResolved={onResolved}
        />
      ) : item.reason === "running_total_drift" ? (
        <RunningTotalDriftCard
          item={item}
          projectId={projectId}
          onResolved={onResolved}
        />
      ) : (
        <SimpleFlaggedCard item={item} projectId={projectId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duplicate invoice — pick which copy is canonical, delete the others
// ---------------------------------------------------------------------------

function DuplicateInvoiceCard({
  item,
  projectId,
  loungeCode,
  onResolved,
}: {
  item: Extract<FlaggedItem, { reason: "duplicate_invoice" }>;
  projectId: string;
  loungeCode: string;
  onResolved: () => void;
}) {
  const { details } = item;
  // Default: keep the oldest (first_seen) copy, queue the rest for deletion.
  const [keepFilename, setKeepFilename] = useState<string>(details.files[0]?.filename ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDeleteOthers() {
    if (!keepFilename) return;
    setError(null);
    const toDelete = details.files.filter((f) => f.filename !== keepFilename);
    startTransition(async () => {
      for (const f of toDelete) {
        const result = await deleteDuplicateInvoiceCopyAction(
          projectId,
          loungeCode,
          f.filename,
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      onResolved();
    });
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text)]">
            {item.merchant} · #{item.invoice_number}
          </p>
          <p className="text-[11px] text-[var(--muted)]">
            {item.invoice_date} · {details.files_count} copies · over-count{" "}
            <span className="font-medium text-[var(--warning-text)]">
              +{currencyFmt.format(details.overcount)}
            </span>
          </p>
        </div>
      </header>

      <ul className="mt-3 space-y-1.5">
        {details.files.map((f) => (
          <li key={f.filename} className="flex items-center gap-2.5">
            <input
              type="radio"
              id={`keep-${f.filename}`}
              name={`keep-${item.invoice_number}`}
              value={f.filename}
              checked={keepFilename === f.filename}
              onChange={() => setKeepFilename(f.filename)}
              disabled={isPending}
              className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent-strong)] disabled:cursor-not-allowed"
            />
            <label
              htmlFor={`keep-${f.filename}`}
              className={`flex flex-1 cursor-pointer items-baseline justify-between gap-3 text-xs ${
                isPending ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <span className="truncate font-mono text-[var(--muted)]">
                {shortFilename(f.filename)}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--text)]">
                {currencyFmt.format(f.total)} · {f.line_count} lines
              </span>
            </label>
            <a
              href={fileViewUrl(projectId, f.filename, loungeCode)}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] uppercase tracking-wide text-[var(--link)] hover:underline"
            >
              View
            </a>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-2 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-2 py-1 text-[11px] text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleDeleteOthers}
          disabled={isPending || !keepFilename}
          className="btn-primary inline-flex !min-h-0 !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Deleting…"
            : `Delete ${details.files_count - 1} other ${details.files_count - 1 === 1 ? "copy" : "copies"}`}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running-total drift — recompute the allocation row
// ---------------------------------------------------------------------------

function RunningTotalDriftCard({
  item,
  projectId,
  onResolved,
}: {
  item: Extract<FlaggedItem, { reason: "running_total_drift" }>;
  projectId: string;
  onResolved: () => void;
}) {
  const { details } = item;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRecompute() {
    setError(null);
    startTransition(async () => {
      const result = await recomputeAllocationAction(
        projectId,
        details.allocation_row_id,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onResolved();
    });
  }

  return (
    <div>
      <header>
        <p className="text-sm font-medium text-[var(--text)]">
          Total disagrees with line items
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          Stored {currencyFmt.format(details.stored_total)} · computed{" "}
          {currencyFmt.format(details.computed_total)} ·{" "}
          <span
            className={
              details.drift > 0
                ? "font-medium text-[var(--warning-text)]"
                : "font-medium text-[var(--error-text)]"
            }
          >
            {details.drift > 0 ? "+" : ""}
            {currencyFmt.format(details.drift)} drift
          </span>
        </p>
      </header>

      {error ? (
        <p className="mt-2 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-2 py-1 text-[11px] text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleRecompute}
          disabled={isPending}
          className="btn-primary inline-flex !min-h-0 !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Recomputing…" : "Recompute from line items"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only cards for the other reasons (low_confidence, orphan_refund,
// date_outside_period, high_value) — no auto-action, just visibility + View.
// ---------------------------------------------------------------------------

function SimpleFlaggedCard({
  item,
  projectId,
}: {
  item: Exclude<FlaggedItem, { reason: "duplicate_invoice" | "running_total_drift" }>;
  projectId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text)]">
          {item.merchant ?? "(no merchant)"} · #{item.invoice_number ?? "—"}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          {item.invoice_date ?? "no date"} ·{" "}
          {item.total !== null ? currencyFmt.format(item.total) : "—"} ·{" "}
          <DetailLine item={item} />
        </p>
      </div>
      {item.filename ? (
        <a
          href={fileViewUrl(projectId, item.filename, "")}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--link)] hover:underline"
        >
          View
        </a>
      ) : null}
    </div>
  );
}

function DetailLine({
  item,
}: {
  item: Exclude<FlaggedItem, { reason: "duplicate_invoice" | "running_total_drift" }>;
}) {
  if (item.reason === "low_confidence") {
    return (
      <>
        avg confidence {item.details.avg_confidence} (threshold{" "}
        {item.details.threshold})
      </>
    );
  }
  if (item.reason === "high_value") {
    return <>over threshold {currencyFmt.format(item.details.threshold)}</>;
  }
  if (item.reason === "orphan_refund") {
    return <>refund with no matching purchase in this period</>;
  }
  // date_outside_period
  return (
    <>
      invoice date outside period {item.details.period_start} –{" "}
      {item.details.period_end}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortFilename(filename: string): string {
  // The stored filename is URL-encoded; the trailing path segment is the most
  // useful identifier (the message_id directory + invoice file).
  const decoded = decodeURIComponent(filename);
  const parts = decoded.split("/");
  const segments = parts.slice(-2).join("/");
  return segments.length > 38 ? "…" + segments.slice(-38) : segments;
}

function fileViewUrl(projectId: string, filename: string, loungeCode: string): string {
  const lounge = loungeCode ? `&lounge=${encodeURIComponent(loungeCode)}` : "";
  return `/api/invoices/file?file=${encodeURIComponent(filename)}${lounge}&project=${encodeURIComponent(projectId)}`;
}
