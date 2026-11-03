/**
 * A drop-down's words for what it holds (Round 21, the platform round's F1;
 * ICD-10 Code Check's words.md section 3, word for word, the app's
 * `chosenLabel` too): "Choose" with nothing chosen, the one choice, two as
 * "{first}, {second}", three or more as "{n} chosen".
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** Said while nothing is chosen. */
export const CHOOSE = "Choose";

/** Under a required drop-down left empty, on save. */
export const CHOOSE_AT_LEAST_ONE = "Choose at least one.";

/** The closed drop-down's words for its choices, in the order they were chosen. */
export function chosenLabel(
  chosen: readonly string[],
  placeholder: string = CHOOSE,
): string {
  if (chosen.length === 0) return placeholder;
  if (chosen.length <= 2) return chosen.join(", ");
  return `${chosen.length} chosen`;
}

/** The search box's placeholder, in a drop-down of more than `SEARCH_ABOVE` choices (Round 21, platform round 2's B1). */
export const SEARCH = "Search";

/** Under the search box when no choice's label holds what was typed. */
export const NO_MATCHES = "No matches.";

/** A drop-down holding more choices than this draws a search box. */
export const SEARCH_ABOVE = 10;

/** One choice as a drop-down draws it: what is saved, what is said, the heading it is under. */
export type Choice = { value: string; label: string; group?: string };

/**
 * A manifest `select`'s `options` as choices (backend ADR-0048 amendment 3):
 * a string is its own value and label; an object `{value, label, group?}` is
 * kept as it is. Anything else is left out.
 */
export function choicesOf(options: readonly unknown[] | undefined): Choice[] {
  return (options ?? []).flatMap((option): Choice[] => {
    if (typeof option === "string") return [{ value: option, label: option }];
    if (typeof option !== "object" || option === null) return [];
    const { value, label, group } = option as Record<string, unknown>;
    if (typeof value !== "string" || typeof label !== "string") return [];
    return [
      typeof group === "string" && group !== ""
        ? { value, label, group }
        : { value, label },
    ];
  });
}

/**
 * The choices a drop-down shows for what was typed in its search box: those
 * whose label holds it, ignoring case and the spaces around it; under their
 * headings, each heading once, in the order it first appears (the
 * manifest's). Choices without a group are one run with no heading
 * (`group: null`).
 */
export function choiceGroups<T extends Choice>(
  choices: readonly T[],
  query = "",
): { group: string | null; choices: T[] }[] {
  const needle = query.trim().toLocaleLowerCase("en-US");
  const groups: { group: string | null; choices: T[] }[] = [];
  const byName = new Map<string | null, T[]>();
  for (const choice of choices) {
    if (needle && !choice.label.toLocaleLowerCase("en-US").includes(needle))
      continue;
    const name = choice.group ?? null;
    let list = byName.get(name);
    if (!list) {
      list = [];
      byName.set(name, list);
      groups.push({ group: name, choices: list });
    }
    list.push(choice);
  }
  return groups;
}

/**
 * A setup `select` whose choices carry groups is drawn as a sheet in two
 * steps, not the drop-down (the owner's build 34 F1: "rather than one drop
 * down is it possible to do two? One for category and then the sub
 * specialty … add a typing feature"): its first step lists the groups under
 * "Category", with a "Search all" box over every choice; its second, one
 * group's choices with a "Search" box over them. The same words as the app.
 */
export const CATEGORY = "Category";

/** The sheet's first step's search box: every choice, whatever its group. */
export const SEARCH_ALL = "Search all";

/** Whether a select's choices carry groups (a manifest gives one on every option or none). */
export function carriesGroups(choices: readonly Choice[]): boolean {
  return choices.some((choice) => choice.group !== undefined);
}

/** The groups, each once, in the order they first appear (the manifest's). */
export function groupsOf(choices: readonly Choice[]): string[] {
  return choiceGroups(choices).flatMap(({ group }) =>
    group === null ? [] : [group],
  );
}

/** One group's choices whose label holds what was typed, in order. */
export function choicesIn<T extends Choice>(
  choices: readonly T[],
  group: string,
  query = "",
): T[] {
  return (
    choiceGroups(
      choices.filter((choice) => choice.group === group),
      query,
    )[0]?.choices ?? []
  );
}
