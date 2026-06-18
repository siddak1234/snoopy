"use client";

import type React from "react";

/**
 * Shared presentational primitives for project dashboards.
 *
 * These were originally module-private functions inside
 * GlCodeAllocationDashboard.tsx. They're extracted here verbatim (the pure
 * ones) or lightly generalized (BreakdownList / RankedList / ClickableKpiTile)
 * so a second dashboard (ResumeReviewerDashboard) can reuse the exact same
 * look. The GL dashboard passes formatters/colors that reproduce its previous
 * output byte-for-byte, so extraction is behavior-preserving for it.
 *
 * Everything is styled with CSS tokens (var(--...)) — no hex — so any consumer
 * inherits the shared light/dark theme automatically.
 */

// Palette cycled across breakdown rows when an item doesn't carry an explicit
// color. Matches the GL dashboard's original CATEGORY_COLORS exactly.
export const DEFAULT_BREAKDOWN_PALETTE = [
  "var(--accent-strong)",
  "var(--success-text)",
  "var(--warning-text)",
  "var(--accent)",
  "var(--link)",
] as const;

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------

export function KpiTile({
  label,
  value,
  delta,
  subtext,
  valueClassName,
}: {
  label: string;
  value: string | null;
  delta?: { text: string; positive: boolean } | null;
  subtext?: string | null;
  /** Override the value color (e.g. a success token). Ignored when value is null. */
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-semibold ${
          value == null
            ? "text-[var(--muted)]"
            : valueClassName ?? "text-[var(--text)]"
        }`}
      >
        {value ?? "—"}
      </p>
      {delta ? (
        <p
          className={
            delta.positive
              ? "mt-1 text-[11px] text-[var(--success-text)]"
              : "mt-1 text-[11px] text-[var(--error-text)]"
          }
        >
          {delta.text}
        </p>
      ) : subtext ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{subtext}</p>
      ) : null}
    </div>
  );
}

/**
 * Clickable KPI tile that switches to a warning treatment when `highlighted`.
 * Generalized from the GL dashboard's FlaggedKpiTile so any "needs attention"
 * count tile (flagged invoices, candidates needing review, …) can reuse it.
 */
export function ClickableKpiTile({
  label,
  value,
  subtext,
  highlighted,
  disabled,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  /** Warning accents + emphasized value when true. */
  highlighted: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        highlighted
          ? "rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-left transition hover:bg-[var(--warning-bg)]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] cursor-pointer"
          : "rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4 text-left disabled:cursor-default"
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={
          highlighted
            ? "mt-1.5 text-2xl font-semibold text-[var(--warning-text)]"
            : "mt-1.5 text-2xl font-semibold text-[var(--text)]"
        }
      >
        {value}
      </p>
      {subtext ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{subtext}</p>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Filter pill (dropdown styled as a labeled card)
// ---------------------------------------------------------------------------

export function FilterPill({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const displayed = options.find((o) => o.value === value)?.label;

  return (
    <div
      className={`relative flex items-center justify-between gap-3 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-[var(--text)]">
          {displayed ?? (
            <span className="text-[var(--muted)]">{placeholder}</span>
          )}
        </div>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 text-[var(--muted)]"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent opacity-0 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] rounded-xl"
        aria-label={label}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section panel (titled card with optional right-side content)
// ---------------------------------------------------------------------------

export function SectionPanel({
  title,
  rightLabel,
  rightContent,
  children,
}: {
  title: string;
  rightLabel?: string;
  /** Use for richer right-side content (button row, search, etc). Wins over `rightLabel`. */
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--text)]">{title}</h4>
        {rightContent
          ? rightContent
          : rightLabel
            ? <span className="text-[11px] text-[var(--muted)]">{rightLabel}</span>
            : null}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown list (labeled rows with a value, percent, and progress bar)
// ---------------------------------------------------------------------------

export type BreakdownItem = {
  key: string;
  label: string;
  amount: number;
  /** Explicit bar/percent color. Falls back to the palette (or muted for `muted`). */
  color?: string;
  /** Render this row in the muted treatment (label + bar recede). */
  muted?: boolean;
};

/**
 * Generalized from the GL dashboard's CategoryBreakdownList. Callers supply
 * `formatValue` (e.g. currency or integer formatting) so this stays
 * domain-agnostic. With no per-item color and a "__other" key, it reproduces
 * the GL behavior exactly (cycled palette + muted rollup row).
 */
export function BreakdownList({
  items,
  total,
  formatValue,
  palette = DEFAULT_BREAKDOWN_PALETTE,
  pctDigits = 1,
}: {
  items: BreakdownItem[];
  total: number;
  formatValue: (amount: number) => string;
  palette?: readonly string[];
  pctDigits?: number;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const pct = total > 0 ? (item.amount / total) * 100 : 0;
        const muted = item.muted ?? item.key === "__other";
        const color =
          item.color ?? (muted ? "var(--muted)" : palette[i % palette.length]);
        return (
          <div key={item.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span
                className={
                  muted
                    ? "truncate text-[var(--muted)]"
                    : "truncate text-[var(--text)]"
                }
              >
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--muted)]">
                {formatValue(item.amount)}{" "}
                <span style={{ color }}>{pct.toFixed(pctDigits)}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked list (title + subtitle on the left, value on the right)
// ---------------------------------------------------------------------------

export type RankedItem = {
  key: string;
  title: string;
  subtitle?: string;
  value: string;
  /** Tailwind classes appended to the value span (e.g. a color token). */
  valueClassName?: string;
};

/**
 * Generalized from the GL dashboard's VendorsList. Used for "Top vendors"
 * (merchant + invoice count + spend) and "Top candidates" (name + decision +
 * fit score) alike.
 */
export function RankedList({ items }: { items: RankedItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text)]">
              {item.title}
            </p>
            {item.subtitle ? (
              <p className="text-[10px] text-[var(--muted)]">{item.subtitle}</p>
            ) : null}
          </div>
          <p
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              item.valueClassName ?? "text-[var(--text)]"
            }`}
          >
            {item.value}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Decision pill (outcome chip with success/warning/error tones)
// ---------------------------------------------------------------------------

/**
 * Colored outcome chip. Unlike StatusPill (which only knows invoice statuses),
 * this maps decision-style outcomes to success/warning/error tokens. Unknown
 * values render neutral.
 */
export function DecisionPill({ decision }: { decision: string | null }) {
  const normalized = (decision ?? "").toLowerCase().trim();
  let cls =
    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize";
  if (normalized === "advance") {
    cls += " bg-[var(--success-bg)] text-[var(--success-text)]";
  } else if (normalized === "hold") {
    cls += " bg-[var(--warning-bg)] text-[var(--warning-text)]";
  } else if (normalized === "reject") {
    cls += " bg-[var(--error-bg)] text-[var(--error-text)]";
  } else {
    cls += " bg-[var(--surface-strong)] text-[var(--muted)]";
  }
  return <span className={cls}>{decision ?? "—"}</span>;
}

// ---------------------------------------------------------------------------
// Empty-state message
// ---------------------------------------------------------------------------

export function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center px-4 text-center text-xs text-[var(--muted)]">
      {text}
    </div>
  );
}
