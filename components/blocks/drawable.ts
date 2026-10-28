import {
  BLOCK_REQUIRED,
  type BlockField,
  type BlockKind,
} from "@/lib/generated/platform-contracts/block-required";

/**
 * Whether a block of a known type holds every field its schema requires, each
 * of its basic type and, where the schema gives a `const` (a group's
 * `sections[].type`, "section"), that value (Round 21, design D2.6):
 * `BLOCK_REQUIRED`, generated from
 * the contract's `Block` union, never typed here. A known type with a missing
 * field would throw in its renderer, and the item's file page is drawn on the
 * server, where no error boundary catches; so `BlockList` checks first and
 * draws `Fallback` in that block's place, and the next block still draws.
 * Uses no hooks. Returns `null` when the block can be drawn, else the first
 * field that is missing or of another type (`rows`, `rows[0].cells`), which is
 * what `notDrawn` logs — a name from the contract, never a value.
 */
export function drawable(type: string, block: object): string | null {
  const fields = BLOCK_REQUIRED[type];
  return fields ? missingIn(block, fields, "") : null;
}

function kindOf(value: unknown): BlockKind | "undefined" | "other" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const kind = typeof value;
  return kind === "string" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "object" ||
    kind === "undefined"
    ? kind
    : "other";
}

function missingIn(
  value: object,
  fields: { readonly [name: string]: BlockField },
  path: string,
): string | null {
  for (const [name, field] of Object.entries(fields)) {
    const at = path ? `${path}.${name}` : name;
    const missing = check((value as Record<string, unknown>)[name], field, at);
    if (missing) return missing;
  }
  return null;
}

function check(value: unknown, field: BlockField, at: string): string | null {
  const kind = kindOf(value);
  if (!(field.kinds as readonly string[]).includes(kind)) return at;
  if (field.value !== undefined && value !== field.value) return at;
  if (kind === "object" && field.fields)
    return missingIn(value as object, field.fields, at);
  if (kind === "array" && field.items) {
    const items = value as readonly unknown[];
    for (let index = 0; index < items.length; index += 1) {
      const missing = check(items[index], field.items, `${at}[${index}]`);
      if (missing) return missing;
    }
  }
  return null;
}

/** The type and reason pairs this browser has logged since its page loaded. */
const logged = new Set<string>();

/**
 * The one log line for a block drawn as `Fallback` (Round 21, design D2.6):
 * the field check's, `BlockBoundary`'s, `GroupCard`'s, `QuestionsBlock`'s,
 * `ChartBlock`'s and `BlockList`'s, with the block's `type` (or `unknown`)
 * and the missing field's name or the caught error — never the block's words
 * or values, which are the customer's. The platform checks every block at
 * its callback, so a line here means this build and the platform disagree.
 * On the item's file page it is the server's log (the Vercel project's
 * runtime logs), once each draw, which is once a request; on a live page,
 * that browser's console, once for each type and reason until the page is
 * loaded again, though the live pages draw again at each poll and React's
 * StrictMode draws twice.
 */
export function notDrawn(type: string, error: unknown): void {
  if (typeof window !== "undefined") {
    const key = `${type}\u0000${String(error)}`;
    if (logged.has(key)) return;
    logged.add(key);
  }
  console.error("block not drawn", { type, error });
}
