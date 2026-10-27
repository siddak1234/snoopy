import { ROW, SPACING } from "@/lib/spacing";

/**
 * A section's row: its box — a section block's (`components/blocks`), and
 * `PageRow` beside it. ~~The sections a run or an item's file read, drawn
 * here~~ until Round 21 (backend ADR-0048): they come as section blocks.
 */
export const SECTION_ROW =
  "rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]";
/**
 * A section's bar, closed: one line of small text and its 20 px caret — the
 * height every row that opens something keeps (the owner's build 28 item 5:
 * "the size of the must haves drop down"). Every section's, document cards
 * too (Round 21: the document bar's py-4 gone): the table's row, `ROW`
 * (`lib/spacing.ts`).
 */
export const SECTION_BAR = `flex items-center justify-between ${SPACING.inner.gap} ${ROW}`;
/**
 * One card of rows, divided (the spacing table's rule: a group of related
 * rows is one card, never a stack of boxes): a list block's rows and a
 * group's sections (`GroupCard`).
 */
export const LIST_CARD =
  "flex flex-col divide-y divide-[var(--ring)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]";
