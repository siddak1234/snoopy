import { createElement, type ReactNode } from "react";
import { iconFor } from "@/lib/flow-icons";
import { CARD, SPACING } from "@/lib/spacing";

/**
 * The one flow card (the owner's builds 37 and 39, item 4: "Make a standard
 * for flow cards. It should be a reusable block. Icon, short deacription and
 * live. Not meta data under."; item 1: "Basically just the title and the
 * short description, that is all."): the flow's icon (`iconFor`, the
 * catalog's `icon`), its name, its short description (the catalog's
 * `description`) and, at its end, one thing (`aside`): its status pill, the
 * day it was archived, or Add. Never a line of metadata under it — its
 * department is its group's header, its runs are on its own page. The app's
 * flow card (`snoopy-mobile`), on the website.
 *
 * Drawn on the Flows page (a card per catalog entry, then each flow added:
 * Open and its pill, then Add or "Added ✓", as `children`), on its archived
 * rows (`boxed={false}`, a row of the list) and on Home's YOUR FLOWS (a card
 * per flow, its run form under it). A flow's own page and its Set up keep
 * "Department: {kind}" under their title: they are pages, not cards.
 *
 * `compact` (Home's YOUR FLOWS only; the owner's build 41, item 14: "The
 * component cards do not need to be this big for the quick access cards.
 * Just the logo, title, then the buttons and items"): the card pads by the
 * table's row steps (`SPACING.rowY` top and bottom, `SPACING.rowX` at the
 * sides) instead of `CARD`, and its icon and name sit centred in one row
 * (`flow-card-head`); Home passes it no description, and as its `aside` a
 * flow with jobs' job drop-down, in that row (the owner's build 42, item 16;
 * ~~no `aside`, the drop-down a row of its own~~ until build 42).
 */
export function FlowCard({
  icon,
  name,
  description,
  nameId,
  aside,
  children,
  boxed = true,
  compact = false,
  heading: Heading = "h3",
  testId = "flow-card",
}: {
  /** The catalog's icon name; an unknown one draws the neutral icon. */
  icon: string | null | undefined;
  name: string;
  /** The catalog's short description; none draws no line. */
  description?: string | null | undefined;
  /** The name's id, for a part that names itself by it. */
  nameId?: string;
  /** At the card's end, beside its name: one pill, one line or one button. */
  aside?: ReactNode;
  /** Under the card's head, inside it. */
  children?: ReactNode;
  /** A card of its own (`bubble`); else a row inside a list's card. */
  boxed?: boolean;
  /** Home's smaller card: the row steps' padding, its head centred. */
  compact?: boolean;
  /** Its name's heading: one level under the title it sits under. */
  heading?: "h3" | "h4";
  testId?: string;
}) {
  const head = (
    <div
      data-testid="flow-card-head"
      className={`flex ${compact ? "items-center" : "items-start"} ${SPACING.inner.gap}`}
    >
      <span
        data-testid="flow-card-icon"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--icon-text)]"
      >
        {/* The catalog's name, resolved by the one map (`iconFor`). */}
        {createElement(iconFor(icon), { size: 24, "aria-hidden": true })}
      </span>
      <div className="min-w-0 flex-1">
        <Heading
          id={nameId}
          data-testid="flow-card-name"
          className="truncate text-base font-medium text-[var(--text)]"
        >
          {name}
        </Heading>
        {description ? (
          <p
            data-testid="flow-card-description"
            className="text-sm text-[var(--muted)]"
          >
            {description}
          </p>
        ) : null}
      </div>
      {aside ? (
        <div
          className={`flex shrink-0 flex-col items-end ${SPACING.inner.gap}`}
        >
          {aside}
        </div>
      ) : null}
    </div>
  );
  return (
    <div
      data-testid={testId}
      className={
        boxed
          ? `bubble flex flex-col ${SPACING.inner.gap} ${compact ? `${SPACING.rowY.y} ${SPACING.rowX.x}` : CARD}`
          : `flex flex-col ${SPACING.inner.gap}`
      }
    >
      {head}
      {children}
    </div>
  );
}
