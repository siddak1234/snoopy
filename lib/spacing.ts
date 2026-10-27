/**
 * The spacing table (backend `BLOCK_SPACING`, ADR-0048 amendment 1; the
 * owner's Q8, 2026-10-26) as this site's classes: each name's number in
 * pixels, at Tailwind's 4 px a step (`app/globals.css` keeps that step). The
 * platform publishes the names and numbers
 * (`lib/generated/platform-contracts/block-rules.ts`); Tailwind reads class
 * names from the source, so each is written out whole here, and
 * `test/spacing.test.mjs` proves every one equals its number. No screen types
 * its own spacing: the parts below carry it, and the spacing check fails on a
 * padding, margin or gap class that is not one of these.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */
export const SPACING = {
  /** The page's left and right edge on a phone: 20. */
  edge: { x: "px-5" },
  /** The same on a wide screen (768 px and up): 24; and beside the side menu (1024 px and up). */
  edgeWide: { x: "md:px-6", gap: "lg:gap-6" },
  /** Between groups: block to block, a header to its first block, a band's top and bottom: 16. */
  group: {
    gap: "gap-4",
    top: "mt-4",
    bottom: "mb-4",
    y: "py-4",
    pt: "pt-4",
    pb: "pb-4",
  },
  /** A title to what it heads: 8. */
  title: { top: "mt-2" },
  /** Between the things inside one card, or one row: 8. */
  inner: {
    gap: "gap-2",
    top: "mt-2",
    x: "gap-x-2",
    y: "gap-y-2",
    py: "py-2",
    pb: "pb-2",
  },
  /** A row's top and bottom padding: 12. */
  rowY: { y: "py-3" },
  /** A row's side padding, and the room between a table's columns: 16. */
  rowX: { x: "px-4", left: "pl-4" },
  /** A row's least height: 44. */
  rowMinHeight: { min: "min-h-11" },
  /** Inside a card: 16. */
  card: { all: "p-4" },
  /** The page card on a wide screen: 24. */
  cardWide: { all: "md:p-6" },
  /** Below the page's last part: 24. */
  bottom: { bottom: "pb-6" },
} as const;

/**
 * Nothing: no gap above the first group (the table's rule), and nothing
 * between two things that read as one line.
 */
export const NONE = [
  "first:pt-0",
  "pt-0",
  "pb-0",
  "m-0",
  "gap-0",
  "lg:mb-0",
] as const;

/** The page's edge, a phone's then a wide screen's. */
export const EDGE = `${SPACING.edge.x} ${SPACING.edgeWide.x}`;
/** A band of a page card between dividers: `group` above and below, none above the first. */
export const GROUP_BAND = `${SPACING.group.y} first:pt-0`;
/** A row: its padding, and at least 44 tall. */
export const ROW = `${SPACING.rowX.x} ${SPACING.rowY.y} ${SPACING.rowMinHeight.min}`;
/** Inside a card. */
export const CARD = SPACING.card.all;
/** The page card: `card`, and `cardWide` on a wide screen. */
export const PAGE_CARD = `${SPACING.card.all} ${SPACING.cardWide.all}`;

/** Every class above: the only padding, margin and gap classes a screen uses. */
export function spacingClasses(): string[] {
  return [
    ...Object.values(SPACING).flatMap((forms) => Object.values(forms)),
    ...NONE,
  ];
}
