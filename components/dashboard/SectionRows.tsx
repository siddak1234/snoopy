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
 * too (Round 21: py-3, the document bar's py-4 gone).
 */
export const SECTION_BAR = "flex items-center justify-between gap-3 px-4 py-3";
