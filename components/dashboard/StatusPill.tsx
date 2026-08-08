/**
 * One status pill, for every status vocabulary the platform returns.
 *
 * There were three: this file (invoice statuses, left over from the deleted
 * vertical product and with no callers), a private copy inside `ProjectList`,
 * and `DecisionPill` in `DashboardKit`. All three rendered the same rounded chip
 * with the same tokens and differed only in which words mapped to which tone —
 * which is data, not a component.
 *
 * Adding a status is a line in the map below. Unknown values render neutral
 * rather than throwing, because the server owns these vocabularies and may add
 * to one before this file hears about it.
 *
 * Colour comes from role tokens only. No hex, so light and dark follow the theme.
 */

type Tone = "success" | "warning" | "error" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  error: "bg-[var(--error-bg)] text-[var(--error-text)]",
  info: "bg-[var(--chip-bg)] text-[var(--chip-text)]",
  neutral: "bg-[var(--surface-strong)] text-[var(--muted)]",
};

/**
 * Status → tone, across every vocabulary in play.
 *
 * Grouped by origin so it stays readable as the platform grows. Keys are
 * lowercased on lookup, which is what lets the mobile client's `Live` and the
 * server's `live` be the same thing without either side changing.
 */
const STATUS_TONE: Record<string, Tone> = {
  // Subscription — catalog.subscriptions.status
  live: "success",
  paused: "warning",
  draft: "neutral",

  // Run — runs.runs.status
  succeeded: "success",
  running: "info",
  pending: "info",
  held: "warning",
  failed: "error",
  cancelled: "neutral",

  // Approval — runs.approvals.status
  approved: "success",
  rejected: "error",
  expired: "neutral",

  // Project — the tenancy vocabulary
  active: "success",
  archived: "neutral",

  // Connection, from Phase 5. Listed now because the screens that will use it
  // are being written against a server that already names these states.
  connected: "success",
  disconnected: "neutral",
  "reauthorization-required": "warning",
};

/** Display casing. `capitalize` handles the rest; only hyphenated words need help. */
function label(status: string): string {
  return status.replace(/-/g, " ");
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS.neutral}`}
      >
        —
      </span>
    );
  }
  const tone = STATUS_TONE[status.toLowerCase().trim()] ?? "neutral";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_CLASS[tone]}`}
    >
      {label(status)}
    </span>
  );
}
