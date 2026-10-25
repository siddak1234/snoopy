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
  positiveCount?: number;
  negativeCount?: number;
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
};

/** What a run's verdict is called (`items.verdictWords`): "Advance", "Decline". */
export type VerdictWords = { positive: string; negative: string };

/** One of an item's tiles: its value over its label, in its tone. */
export type ItemTile = {
  key: "total" | "positive" | "negative";
  label: string;
  value: number;
};

/** The first of an item's tiles: all its runs. */
export const TOTAL = "Total";

/**
 * An item's tiles, side by side at the top of its page (plan §3; the owner's
 * build 28 item 6: "total candidates, green … would be the hireable ones and
 * red would be do not hire"): Total, then the flow's words for a positive and
 * a negative verdict with the item's tallies (`positiveCount`,
 * `negativeCount`) — green and red. None for a flow whose items declare no
 * verdict words: it gives no verdict to count.
 */
export function itemTiles(
  item: { runCount: number; positiveCount: number; negativeCount: number },
  words: VerdictWords | undefined,
): ItemTile[] {
  if (!words) return [];
  return [
    { key: "total", label: TOTAL, value: item.runCount },
    { key: "positive", label: words.positive, value: item.positiveCount },
    { key: "negative", label: words.negative, value: item.negativeCount },
  ];
}

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

/** A–Z whatever the case, as the app sorts them. */
function byWords(a: string, b: string): number {
  return a.localeCompare(b, "en-US", { sensitivity: "base" });
}

/** By title A–Z; two of the same title keep the platform's order. */
function titlesAZ<T extends { title: string }>(items: readonly T[]): T[] {
  return items
    .map((item, at) => ({ item, at }))
    .sort((a, b) => byWords(a.item.title, b.item.title) || a.at - b.at)
    .map(({ item }) => item);
}

/** A group of the flow page's items: its header (null for none) and its rows. */
export type ItemGroup<T> = { title: string | null; items: T[] };

/**
 * A word for many, in a sentence — "departments", "areas", "categories" —
 * from the field's own title (`AutomationItemField.title`), which the
 * contract gives in one form only.
 */
export function pluralOf(word: string): string {
  const small = inSentence(word);
  if (/[^aeiou]y$/iu.test(small)) return `${small.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/iu.test(small)) return `${small}es`;
  return `${small}s`;
}

/** The group filter's choice for every group. */
export const ALL_GROUPS = "all";
/** A group's choice: these words, then the value's own. */
const GROUP = "group:";

/**
 * The group filter's choices (plan §3; the owner's build 28 items 2 and 3):
 * "All {field, many}" first — "All departments" — then each value the items
 * carry, A–Z. A value is held by its words (`group:<words>`), never by its
 * place, so a re-read of the list never moves the one picked.
 */
export function groupChoices(
  items: readonly Pick<ItemRowOf, "fields">[],
  groupField: Pick<ItemField, "key" | "title">,
): SelectChoice[] {
  const values = new Set<string>();
  for (const item of items) {
    const value = item.fields[groupField.key];
    if (value) values.add(value);
  }
  return [
    { value: ALL_GROUPS, label: `All ${pluralOf(groupField.title)}` },
    ...[...values]
      .sort(byWords)
      .map((label) => ({ value: `${GROUP}${label}`, label })),
  ];
}

/**
 * The flow page's items (plan §3; the owner's build 28 items 2 and 3),
 * grouped by the flow's `groupField`: the groups A–Z — the options and the
 * values typed for it alike — then items with no value, under no header; the
 * rows A–Z by title in each. `chosen` (a `groupChoices` value) keeps the one
 * group it names; "All", or a group no item carries now, keeps them all. No
 * group field: one group, under no header, A–Z.
 */
export function groupItems<T extends ItemRowOf>(
  items: readonly T[],
  groupField: Pick<ItemField, "key"> | undefined,
  chosen: string = ALL_GROUPS,
): ItemGroup<T>[] {
  if (!groupField) {
    return items.length > 0 ? [{ title: null, items: titlesAZ(items) }] : [];
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
  const picked = chosen.startsWith(GROUP) ? chosen.slice(GROUP.length) : null;
  if (picked !== null && byValue.has(picked)) {
    return [{ title: picked, items: titlesAZ(byValue.get(picked) ?? []) }];
  }
  const groups: ItemGroup<T>[] = [...byValue.keys()]
    .sort(byWords)
    .map((value) => ({
      title: value,
      items: titlesAZ(byValue.get(value) ?? []),
    }));
  if (ungrouped.length > 0)
    groups.push({ title: null, items: titlesAZ(ungrouped) });
  return groups;
}

/** One choice of a select: what the browser holds, and what it says. */
export type SelectChoice = { value: string; label: string };

/** The choice that shows a text box for a value of the person's own. */
export const OTHER_CHOICE = "other";
/** A saved value's choice: these words, then the value's own. */
const SAVED = "saved:";

/**
 * A select's choices on the upload card (plan §5.2): its `options`, then the
 * values typed for it on earlier items (`listItems`' `choices`, the owner's
 * "save that name in case future jobs are uploaded to that name") that are not
 * among them, then "Other" when it takes a typed value. An option is held by
 * its place and a saved value by its words (`saved:<words>`), never by its
 * place in `choices`: that list is read again while the card is open, and a
 * name typed meanwhile that sorts ahead would move the one picked. No choice
 * can be mistaken for "Other".
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
  for (const label of saved ?? []) {
    if (seen.has(label)) continue;
    seen.add(label);
    choices.push({ value: `${SAVED}${label}`, label });
  }
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
          : choice.startsWith(SAVED)
            ? choice.slice(SAVED.length)
            : (label?.label ?? "");
    }
    value = value.trim();
    if (value) values[field.key] = value;
  }
  return values;
}

/**
 * One of an item's runs, as its page ranks it: a compact row, the height of a
 * section's row — its rank, its title, its score and the arrow (the owner's
 * build 28 item 5); ~~its result line~~ until build 28.
 */
export type RankedRow = {
  id: string;
  rank: number;
  title: string;
  score: number | null;
  /** A run that failed or was stopped: drawn dimmed. */
  dim: boolean;
};

/**
 * A finished run's name when it has none of its own: its status, in the
 * app's words (`statusLabel`); its page says why.
 */
const UNNAMED: Record<
  Exclude<ItemRunOf["status"], "pending" | "running">,
  string
> = {
  held: "Held",
  succeeded: "Success",
  failed: "Failed",
  cancelled: "Cancelled",
};

/**
 * An item's runs, ranked exactly as the platform answers them (`readItem`:
 * highest score first, runs without one after them, then newest), never
 * sorted again here, numbered 1…n: a run still going "Reading…", with no
 * score; a finished one its title, else its status; its score — and a failed
 * or stopped one dimmed. The app's `rankedRuns`.
 */
export function rankedRows(runs: readonly ItemRunOf[]): RankedRow[] {
  return runs.map((run, at) => {
    const going = run.status === "pending" || run.status === "running";
    return {
      id: run.id,
      rank: at + 1,
      title:
        run.status === "pending" || run.status === "running"
          ? READING
          : (run.title ?? UNNAMED[run.status]),
      score: !going && typeof run.score === "number" ? run.score : null,
      dim: run.status === "failed" || run.status === "cancelled",
    };
  });
}

/**
 * Whether an item's page offers "Add {run}" (plan §5.3): to an owner or admin,
 * for an item that is ready and not archived, on a flow whose run can start —
 * live, answering, and declaring a run file — as the app's `canStartRun`;
 * otherwise the section is not drawn at all.
 */
export function canAddRun(state: {
  canManage: boolean;
  item: Pick<ItemRowOf, "status" | "archivedAt">;
  live: boolean;
  available: boolean;
  runInputs: number;
}): boolean {
  return (
    state.canManage &&
    state.item.status === "ready" &&
    !state.item.archivedAt &&
    state.live &&
    state.available &&
    state.runInputs > 0
  );
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
