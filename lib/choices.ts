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
