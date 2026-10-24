/**
 * A flow's ITEMS as the website draws them (Round 19, plan §5; backend
 * ADR-0046): things a person makes once, from a file, that the flow's runs
 * then belong to. Every word for them is the platform's — `items.words`,
 * `items.runWords`, each field's `title` and `options` — so nothing here names
 * one flow's things, and the next flow with items needs no change. The same
 * rules as the app's, so both clients say the same thing.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export type ItemWords = { singular: string; plural: string };

/** One value a person gives an item (`AutomationItemField`). */
export type ItemField = {
  key: string;
  title: string;
  control: "text" | "select";
  options?: string[];
  allowOther?: boolean;
  defaultValue?: string;
  required: boolean;
  maxLength?: number;
};

/** What a row needs of an item (`Item`). */
export type ItemRowOf = {
  id: string;
  title: string;
  fields: Record<string, string>;
  status: "reading" | "ready" | "failed";
  failureReason?: string;
  runCount: number;
  topScore: number | null;
  createdAt: string;
  archivedAt?: string | null;
};

/** What a ranked row needs of one of an item's runs (`Run`). */
export type ItemRunOf = {
  id: string;
  status: "pending" | "running" | "held" | "succeeded" | "failed" | "cancelled";
  title?: string;
  score?: number;
  resultSummary?: string;
  failureReason?: string;
};

/** An item, or a run, whose file is still being read. */
export const READING = "Reading…";
/** An item whose file could not be read. */
export const COULD_NOT_READ = "Couldn't read";
/** An item that takes runs. */
export const READY = "Ready";
/** An item archived: it takes no new runs. */
export const ARCHIVED = "Archived";
/** A select's last choice, for a value of the person's own (`allowOther`). */
export const OTHER = "Other";
/** The longest value typed for "Other" (`AutomationItemField.allowOther`). */
export const OTHER_MAX_LENGTH = 40;
/** A text field's longest value when it declares none. */
export const TEXT_MAX_LENGTH = 80;

/**
 * A word as it reads inside a sentence — "Upload job", "4 candidates": its
 * first letter made small when the next one is small too, so a word written
 * in capitals ("NDA") stays as it is.
 */
export function inSentence(word: string): string {
  return /^\p{Lu}\p{Ll}/u.test(word)
    ? word.charAt(0).toLocaleLowerCase("en-US") + word.slice(1)
    : word;
}

/** An item's own page, under its flow's. */
export function itemPath(subscriptionId: string, itemId: string): string {
  return `/account/flows/${encodeURIComponent(subscriptionId)}/items/${encodeURIComponent(itemId)}`;
}

/** The flow page's button that makes an item: "Upload job". */
export function uploadLabel(words: ItemWords): string {
  return `Upload ${inSentence(words.singular)}`;
}

/** The item page's heading over the file that starts a run: "Add candidate". */
export function addRunLabel(runWords: ItemWords): string {
  return `Add ${inSentence(runWords.singular)}`;
}

/** The item page's button that archives it: "Archive job". */
export function archiveLabel(words: ItemWords): string {
  return `Archive ${inSentence(words.singular)}`;
}

/** The one line where there is nothing yet: "No jobs yet." */
export function noneYet(words: ItemWords): string {
  return `No ${inSentence(words.plural)} yet.`;
}

/**
 * A row's line on the flow page: "Reading…", "Couldn't read", or how many
 * runs it has and the best score among them — "4 candidates · Top 86".
 */
export function itemLine(item: ItemRowOf, runWords: ItemWords): string {
  if (item.status === "reading") return READING;
  if (item.status === "failed") return COULD_NOT_READ;
  const word = item.runCount === 1 ? runWords.singular : runWords.plural;
  const count = `${item.runCount} ${inSentence(word)}`;
  return item.topScore === null ? count : `${count} · Top ${item.topScore}`;
}

/** Where an item is, on its own page: "Ready", "Reading…", or why it was not read. */
export function itemStatusLine(item: ItemRowOf): string {
  if (item.status === "ready") return READY;
  if (item.status === "reading") return READING;
  return item.failureReason
    ? `${COULD_NOT_READ}: ${item.failureReason}`
    : COULD_NOT_READ;
}

/**
 * An item's page's line under its title: its group's value, then where it is
 * ("Accounting · Ready"), or "Archived" once it is.
 */
export function itemSubheader(
  item: ItemRowOf,
  groupField: string | undefined,
): string {
  const group = groupField ? item.fields[groupField] : undefined;
  return [group, item.archivedAt ? ARCHIVED : itemStatusLine(item)]
    .filter(Boolean)
    .join(" · ");
}

/** Newest first; two made at the same moment keep the platform's order. */
function newestFirst<T extends { createdAt: string }>(
  items: readonly T[],
): T[] {
  return items
    .map((item, at) => ({ item, at }))
    .sort(
      (a, b) =>
        Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt) ||
        a.at - b.at,
    )
    .map(({ item }) => item);
}

/** A group of the flow page's items: its header (null for none) and its rows. */
export type ItemGroup<T> = { title: string | null; items: T[] };

/**
 * The flow page's items, grouped by the flow's `groupField` (plan §5.1): the
 * groups in the order of its `options`, then the values typed for it A–Z,
 * then items with no value, under no header; rows newest first in each. No
 * group field: one group, under no header.
 */
export function groupItems<T extends ItemRowOf>(
  items: readonly T[],
  groupField: ItemField | undefined,
): ItemGroup<T>[] {
  if (!groupField) {
    return items.length > 0 ? [{ title: null, items: newestFirst(items) }] : [];
  }
  const byValue = new Map<string, T[]>();
  const ungrouped: T[] = [];
  for (const item of items) {
    const value = item.fields[groupField.key];
    if (!value) {
      ungrouped.push(item);
      continue;
    }
    byValue.set(value, [...(byValue.get(value) ?? []), item]);
  }
  const options = groupField.options ?? [];
  const typed = [...byValue.keys()]
    .filter((value) => !options.includes(value))
    .sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }));
  const groups: ItemGroup<T>[] = [...options, ...typed]
    .filter((value) => byValue.has(value))
    .map((value) => ({
      title: value,
      items: newestFirst(byValue.get(value) ?? []),
    }));
  if (ungrouped.length > 0)
    groups.push({ title: null, items: newestFirst(ungrouped) });
  return groups;
}

/** One choice of a select: what the browser holds, and what it says. */
export type SelectChoice = { value: string; label: string };

/** The choice that shows a text box for a value of the person's own. */
export const OTHER_CHOICE = "other";

/**
 * A select's choices on the upload card (plan §5.2): its `options`, then the
 * values typed for it on earlier items (`listItems`' `choices`, the owner's
 * "save that name in case future jobs are uploaded to that name") that are not
 * among them, then "Other" when it takes a typed value. Each held by its place,
 * never its words, so no option can be mistaken for "Other".
 */
export function selectChoices(
  field: ItemField,
  saved: readonly string[] | undefined,
): SelectChoice[] {
  const options = field.options ?? [];
  const choices: SelectChoice[] = options.map((label, at) => ({
    value: `option:${at}`,
    label,
  }));
  if (!field.allowOther) return choices;
  const seen = new Set(options);
  (saved ?? []).forEach((label, at) => {
    if (seen.has(label)) return;
    seen.add(label);
    choices.push({ value: `saved:${at}`, label });
  });
  choices.push({ value: OTHER_CHOICE, label: OTHER });
  return choices;
}

/** The choice a select starts at: its declared default, else none. */
export function firstChoice(field: ItemField): string {
  const at = field.defaultValue
    ? (field.options ?? []).indexOf(field.defaultValue)
    : -1;
  return at >= 0 ? `option:${at}` : "";
}

/**
 * What `createItem` is sent as `fields`: each select's chosen words — an
 * option, a saved value, or what was typed for "Other" — and each text box's,
 * trimmed; a value left empty is left out, so the platform applies the
 * field's default or refuses a required one (`createItem`).
 */
export function itemFieldValues(
  fields: readonly ItemField[],
  saved: Readonly<Record<string, readonly string[]>>,
  picked: Readonly<Record<string, string>>,
  typed: Readonly<Record<string, string>>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    let value = "";
    if (field.control === "text") {
      value = typed[field.key] ?? "";
    } else {
      const choice = picked[field.key] ?? "";
      const label = selectChoices(field, saved[field.key]).find(
        (candidate) => candidate.value === choice,
      );
      value =
        choice === OTHER_CHOICE
          ? (typed[field.key] ?? "")
          : (label?.label ?? "");
    }
    value = value.trim();
    if (value) values[field.key] = value;
  }
  return values;
}

/** One of an item's runs, as its page ranks it. */
export type RankedRow = {
  id: string;
  rank: number;
  title: string;
  score: number | null;
  line: string | null;
  /** A run that failed or was stopped: drawn dimmed. */
  dim: boolean;
};

/** A run's name before it has one of its own, by where it is. */
const UNNAMED: Record<ItemRunOf["status"], string> = {
  pending: READING,
  running: READING,
  held: "Waiting",
  succeeded: "Done",
  failed: COULD_NOT_READ,
  cancelled: "Stopped",
};

/**
 * An item's runs, ranked exactly as the platform answers them (`readItem`:
 * highest score first, runs without one after them, then newest), numbered
 * 1…n: each its title or, still being read, "Reading…"; its score; its result
 * line — and a failed one its failure, dimmed.
 */
export function rankedRows(runs: readonly ItemRunOf[]): RankedRow[] {
  return runs.map((run, at) => ({
    id: run.id,
    rank: at + 1,
    title: run.title ?? UNNAMED[run.status],
    score: typeof run.score === "number" ? run.score : null,
    line:
      run.status === "succeeded"
        ? (run.resultSummary ?? null)
        : run.status === "failed"
          ? (run.failureReason ?? null)
          : null,
    dim: run.status === "failed" || run.status === "cancelled",
  }));
}

/** Whether an item's page is read again: it, or one of its runs, is still going. */
export function itemGoing(
  item: Pick<ItemRowOf, "status">,
  runs: readonly Pick<ItemRunOf, "status">[],
): boolean {
  return (
    item.status === "reading" ||
    runs.some((run) => run.status === "pending" || run.status === "running")
  );
}

/** A section entry's link, only when it is `http:` or `https:`; else none. */
export function sectionLink(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

/**
 * The field a refused item's `details.problems` names (`createItem`'s 422):
 * each problem's `path`, read as `fields.<key>` or the key alone, kept only
 * when it is one of the item's fields. The contract does not publish the
 * problems' shape; this reads the one the platform's run input refusal uses
 * (`{ path, message }`), and anything else names no field.
 */
export function problemFields(
  problems: unknown,
  fields: readonly Pick<ItemField, "key">[],
): string[] {
  if (!Array.isArray(problems)) return [];
  const keys = new Set(fields.map((field) => field.key));
  const named = new Set<string>();
  for (const problem of problems) {
    const path =
      problem && typeof problem === "object" && "path" in problem
        ? (problem as { path: unknown }).path
        : undefined;
    if (typeof path !== "string") continue;
    const key = path.replace(/^\$?\.?(?:fields\.)?/u, "").split(".")[0];
    if (keys.has(key)) named.add(key);
  }
  return [...named];
}
