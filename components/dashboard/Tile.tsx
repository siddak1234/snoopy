import Link from "next/link";
import { SPACING } from "@/lib/spacing";

/** A tile's box: the table's row padding (`rowX`, `rowY`). */
const TILE = `rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] ${SPACING.rowX.x} ${SPACING.rowY.y}`;

/**
 * A tile: its value large over its label. In a `<dl>`, the label first in
 * the markup, as a list says it — a run's details page's Duration and Steps
 * done (Build 21, spec A7), and an item's Total and verdict tallies (Round
 * 19, build 28; the owner's item 6: green and red, `tone`). With `href`, a
 * link to what it counts — Home's Today and a flow's Dashboard, each "{n}
 * {label}, see these runs in Activity" (`hint`) — the one tile, not a copy.
 */
export function Tile({
  label,
  value,
  testId,
  tone = "text-[var(--text)]",
  href,
  hint,
  linkTestId,
}: {
  label: string;
  value: string;
  testId: string;
  /** The value's colour token class. */
  tone?: string;
  /** Where the tile goes: a link, not a list's term. */
  href?: string;
  /** Read after the label by a screen reader: where the link goes. */
  hint?: string;
  linkTestId?: string;
}) {
  if (href)
    return (
      <Link
        prefetch={false}
        href={href}
        data-testid={linkTestId}
        className={`flex flex-col ${TILE} transition hover:bg-[var(--surface-hover)]`}
      >
        <span data-testid={testId} className={`text-2xl font-medium ${tone}`}>
          {value}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {label}
          {hint ? <span className="sr-only">{hint}</span> : null}
        </span>
      </Link>
    );
  return (
    <div className={`flex flex-col-reverse ${TILE}`}>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd data-testid={testId} className={`text-2xl font-medium ${tone}`}>
        {value}
      </dd>
    </div>
  );
}
