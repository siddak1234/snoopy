/**
 * Search, sort and pages on a list or a table (backend ADR-0048 amendment 1,
 * decision 4), the same rules as the app's: a query is trimmed and matched,
 * whatever its case and accents, anywhere in any of a row's fields; a value
 * reads as a number by one rule; a sort keeps ties in the order sent and puts
 * what has no value last. The platform publishes the cases both clients pass
 * (`snoopy-backend/packages/contracts/fixtures/block-rules/search.json` and
 * `sort.json`, generated into
 * `lib/generated/platform-contracts/block-rules.ts`) and the words
 * (`BLOCK_WORDS`), handed in here so nothing in this file is a word.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** The words a choice is named in: `BLOCK_WORDS`' sort words. */
export type SortWords = {
  defaultOrder: string;
  aToZ: string;
  highToLow: string;
  columnAToZ: string;
  columnHighToLow: string;
};

/** A list row as a sort reads it. */
export type SortListRow = {
  title: string;
  value?: string;
  valueLabel?: string;
};
/** A table column as a sort reads it: its title, or none (no choice). */
export type SortColumn = { title?: string | null };

/** One sort choice: what the page holds, and what it says. */
export type SortChoice = { value: string; label: string };

/** The first choice: the order as sent. */
export const DEFAULT_ORDER = "default";

/** A word with its `{name}` filled. */
export function fill(words: string, values: Record<string, string | number>) {
  return words.replace(/\{(\w+)\}/gu, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}

/** Lower case, accents removed (NFD, combining marks out): what a search compares. */
export function folded(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US");
}

/** Whether a row, by its fields, holds the query: an empty query holds in every row. */
export function matches(
  query: string,
  fields: readonly (string | null | undefined)[],
): boolean {
  const wanted = folded(query.trim());
  if (!wanted) return true;
  return fields.some(
    (field) => typeof field === "string" && folded(field).includes(wanted),
  );
}

/** The rows a query holds, in the order sent. */
export function search<T>(
  rows: readonly T[],
  query: string,
  fieldsOf: (row: T) => readonly (string | null | undefined)[],
): T[] {
  return rows.filter((row) => matches(query, fieldsOf(row)));
}

/**
 * A value as a number, or null: `$ € £ ,` and spaces removed, then one
 * trailing `%`, and what is left `-12` or `3.5`.
 */
export function asNumber(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const bare = value.replace(/[$€£,\s]/gu, "").replace(/%$/u, "");
  return /^-?\d+(\.\d+)?$/u.test(bare) ? Number(bare) : null;
}

const present = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

/** A to Z whatever the case and accents; this site's `byWords`. */
function byWords(a: string, b: string): number {
  return a.localeCompare(b, "en-US", { sensitivity: "base" });
}

/** The label a list's numbers share, when every row with a value reads as one. */
function listNumberLabel(rows: readonly SortListRow[]): string | null {
  const valued = rows.filter((row) => present(row.value));
  if (valued.length === 0) return null;
  if (!valued.every((row) => asNumber(row.value) !== null)) return null;
  const labels = new Set(valued.map((row) => row.valueLabel ?? ""));
  if (labels.size !== 1) return null;
  const [label] = labels;
  return label ? label : null;
}

/** Whether a column's every non-empty cell reads as a number (and it has one). */
function numericColumn(
  rows: readonly (readonly (string | null | undefined)[])[],
  at: number,
): boolean {
  const cells = rows.map((row) => row[at]).filter(present);
  return cells.length > 0 && cells.every((cell) => asNumber(cell) !== null);
}

/** A list's sort choices: as sent, A to Z, and "{label}: high to low" when its values are numbers. */
export function listChoices(
  rows: readonly SortListRow[],
  words: SortWords,
): SortChoice[] {
  const label = listNumberLabel(rows);
  return [
    { value: DEFAULT_ORDER, label: words.defaultOrder },
    { value: "az", label: words.aToZ },
    ...(label
      ? [{ value: "high", label: fill(words.highToLow, { label }) }]
      : []),
  ];
}

/** A table's sort choices: as sent, then each titled column, "high to low" when it holds numbers. */
export function tableChoices(
  columns: readonly SortColumn[],
  rows: readonly (readonly (string | null | undefined)[])[],
  words: SortWords,
): SortChoice[] {
  const choices: SortChoice[] = [
    { value: DEFAULT_ORDER, label: words.defaultOrder },
  ];
  columns.forEach((column, at) => {
    if (!column.title) return;
    choices.push(
      numericColumn(rows, at)
        ? {
            value: `${at}:high`,
            label: fill(words.columnHighToLow, { column: column.title }),
          }
        : {
            value: `${at}:az`,
            label: fill(words.columnAToZ, { column: column.title }),
          },
    );
  });
  return choices;
}

/** Indexes in an order: by `compare`, rows without a key last, ties as sent. */
function ordered<K>(
  keys: readonly (K | null)[],
  compare: (a: K, b: K) => number,
): number[] {
  return keys
    .map((key, at) => ({ key, at }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) {
        if (a.key === b.key) return a.at - b.at;
        return a.key === null ? 1 : -1;
      }
      return compare(a.key, b.key) || a.at - b.at;
    })
    .map(({ at }) => at);
}

/** A list's rows' order for a choice, as indexes into what was sent. */
export function sortList(
  rows: readonly SortListRow[],
  choice: string,
): number[] {
  if (choice === "az")
    return ordered(
      rows.map((row) => (present(row.title) ? row.title : null)),
      byWords,
    );
  if (choice === "high")
    return ordered(
      rows.map((row) => asNumber(row.value)),
      (a, b) => b - a,
    );
  return rows.map((_, at) => at);
}

/** A table's rows' order for a choice, as indexes into what was sent. */
export function sortTable(
  rows: readonly (readonly (string | null | undefined)[])[],
  choice: string,
): number[] {
  const [column, how] = choice.split(":");
  const at = Number(column);
  if (!Number.isInteger(at) || at < 0) return rows.map((_, index) => index);
  if (how === "high")
    return ordered(
      rows.map((row) => asNumber(row[at])),
      (a, b) => b - a,
    );
  if (how === "az")
    return ordered(
      rows.map((row) => (present(row[at]) ? (row[at] as string) : null)),
      byWords,
    );
  return rows.map((_, index) => index);
}

/** How many pages `count` rows make at `size` a page: at least one. */
export function pageCount(count: number, size: number): number {
  return Math.max(1, Math.ceil(count / size));
}

/** A page number held to 1 … the last page. */
export function pageWithin(page: number, count: number, size: number): number {
  const last = pageCount(count, size);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), last);
}

/** One page of rows (pages count from 1). */
export function pageRows<T>(rows: readonly T[], page: number, size: number) {
  const at = (pageWithin(page, rows.length, size) - 1) * size;
  return rows.slice(at, at + size);
}
