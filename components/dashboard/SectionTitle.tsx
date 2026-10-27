import type { ReactNode } from "react";

/** A title's small capitals: every heading over a page's parts. */
export const TITLE =
  "text-xs font-medium tracking-wide text-[var(--muted)] uppercase";

/**
 * A section's title, in small capitals (`TITLE`): over a page card's band, a
 * label block, a form ("Add candidate") or a group. What it heads sits the
 * table's `title` gap under it — `Group`'s, or the blocks' (`BlockList`) —
 * and `group` under whatever came before (F3; `lib/spacing.ts`).
 */
export function SectionTitle({
  children,
  id,
  testId,
  as: Tag = "h2",
}: {
  children: ReactNode;
  id?: string;
  testId?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag id={id} data-testid={testId} className={TITLE}>
      {children}
    </Tag>
  );
}
