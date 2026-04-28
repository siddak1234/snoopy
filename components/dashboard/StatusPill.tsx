/**
 * Status pill used throughout the GL Code dashboard and invoice sub-pages.
 *
 * Vocabulary in production data: "Complete" and "In Progress". Anything else
 * (including null) renders neutral — defensive default for new statuses or
 * legacy values.
 *
 * All colors come from existing CSS tokens — no hex; auto light/dark.
 */
export function StatusPill({ status }: { status: string | null }) {
  const normalized = (status ?? "").toLowerCase().trim();
  let cls =
    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize";
  if (normalized === "complete") {
    cls += " bg-[var(--success-bg)] text-[var(--success-text)]";
  } else if (normalized === "in progress") {
    cls += " bg-[var(--chip-bg)] text-[var(--chip-text)]";
  } else {
    cls += " bg-[var(--surface-strong)] text-[var(--muted)]";
  }
  return <span className={cls}>{status ?? "—"}</span>;
}
