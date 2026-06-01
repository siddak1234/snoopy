// Types and thresholds for the Flagged-for-Review feature.
// Mirrors the Supabase RPC `flagged_invoices_for_project` and the modal UI.
//
// The detection RPC returns one row per flagged item with `reason` discriminating
// the case and `details` carrying case-specific data as JSON.

// Default thresholds — exposed here so they can be tuned without touching SQL.
// If we move to per-project config later, replace these constants with lookups.
export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 70;
export const DEFAULT_HIGH_VALUE_THRESHOLD = 5000;

// Tolerance (dollars) for running-total drift detection. Below this, treat as noise.
export const DRIFT_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------
// Reason discriminator + per-reason details payload
// ---------------------------------------------------------------------------

export type FlagReason =
  | "duplicate_invoice"
  | "running_total_drift"
  | "low_confidence"
  | "orphan_refund"
  | "date_outside_period"
  | "high_value";

export type DuplicateFile = {
  filename: string;
  total: number;
  line_count: number;
  first_seen: string; // ISO timestamp
};

export type DuplicateInvoiceDetails = {
  files: DuplicateFile[];
  files_count: number;
  // What you'd save in the running total if all but one copy were deleted.
  overcount: number;
};

export type RunningTotalDriftDetails = {
  allocation_row_id: number;
  stored_total: number;
  computed_total: number;
  // Positive = stored exceeds line items (over-count). Negative = stored is short.
  drift: number;
};

export type LowConfidenceDetails = {
  avg_confidence: number;
  line_count: number;
  threshold: number;
};

export type OrphanRefundDetails = {
  total: number; // negative
};

export type DateOutsidePeriodDetails = {
  period_start: string; // date
  period_end: string;
  invoice_date: string;
};

export type HighValueDetails = {
  total: number;
  threshold: number;
};

// Discriminated union — each row from the RPC pairs `reason` with a specific
// `details` shape.
export type FlaggedItem =
  | (FlaggedBase & { reason: "duplicate_invoice"; details: DuplicateInvoiceDetails })
  | (FlaggedBase & { reason: "running_total_drift"; details: RunningTotalDriftDetails })
  | (FlaggedBase & { reason: "low_confidence"; details: LowConfidenceDetails })
  | (FlaggedBase & { reason: "orphan_refund"; details: OrphanRefundDetails })
  | (FlaggedBase & { reason: "date_outside_period"; details: DateOutsidePeriodDetails })
  | (FlaggedBase & { reason: "high_value"; details: HighValueDetails });

type FlaggedBase = {
  merchant: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number | null;
  filename: string | null;
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  duplicate_invoice: "Duplicate invoice",
  running_total_drift: "Running-total drift",
  low_confidence: "Low confidence",
  orphan_refund: "Orphan refund",
  date_outside_period: "Date outside period",
  high_value: "High-value invoice",
};

// Short subtext shown on the KPI tile when the user has multiple kinds of flags
// — e.g. "2 dupes · 1 drift". Drops zero-count entries.
export function summarizeFlagCounts(items: FlaggedItem[]): string {
  const counts: Partial<Record<FlagReason, number>> = {};
  for (const it of items) counts[it.reason] = (counts[it.reason] ?? 0) + 1;
  const labels: Partial<Record<FlagReason, string>> = {
    duplicate_invoice: "dupe",
    running_total_drift: "drift",
    low_confidence: "low-conf",
    orphan_refund: "orphan",
    date_outside_period: "off-period",
    high_value: "high-value",
  };
  const parts: string[] = [];
  for (const reason of Object.keys(labels) as FlagReason[]) {
    const n = counts[reason] ?? 0;
    if (n > 0) parts.push(`${n} ${labels[reason]}${n === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

// Sum potential over-count across duplicate_invoice flags. Used in the KPI subtext.
export function totalOvercount(items: FlaggedItem[]): number {
  let sum = 0;
  for (const it of items) {
    if (it.reason === "duplicate_invoice") sum += it.details.overcount;
  }
  return Math.round(sum * 100) / 100;
}
