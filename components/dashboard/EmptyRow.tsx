import type { ReactNode } from "react";
import { SPACING } from "@/lib/spacing";

/**
 * A section with nothing to list yet, or no workspace to list it for — the one
 * row the account pages render in that case, instead of a private copy each
 * (register F29).
 *
 * Given a `title`, it is a whole screen that is empty, in the app's standard
 * (the owner, build 9): centred, an accent-tinted icon, the title, one line and
 * somewhere to go. Only a whole page takes the title; a section inside one
 * stays the single line: a band of its page card, or, inside the blocks
 * (`band={false}`), the line alone, which the blocks space (`inner`). The
 * band keeps its 20 above and below, which `test/structure-contract` holds.
 */
export function EmptyRow({
  text,
  title,
  icon,
  action,
  band = true,
}: {
  text: string;
  /** A band of the page card; false inside the blocks. */
  band?: boolean;
  title?: string;
  /** Decorative: the title says what the screen is. */
  icon?: ReactNode;
  action?: ReactNode;
}) {
  if (!title && !band)
    return <p className="text-sm text-[var(--muted)]">{text}</p>;
  if (!title) {
    return (
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">{text}</p>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col items-center text-center ${SPACING.rowX.x} ${SPACING.group.y}`}
    >
      {icon ? (
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--chip-bg)] text-[var(--accent-strong)]"
        >
          {icon}
        </span>
      ) : null}
      <h2
        className={`${SPACING.group.top} text-lg font-medium text-[var(--text)]`}
      >
        {title}
      </h2>
      <p
        className={`${SPACING.title.top} max-w-sm text-sm text-[var(--muted)]`}
      >
        {text}
      </p>
      {action ? <div className={SPACING.group.top}>{action}</div> : null}
    </div>
  );
}
