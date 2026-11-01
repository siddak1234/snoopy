/**
 * Several files in one upload (Round 21, platform round 2's B2 as the batch
 * addendum amends it; backend ADR-0048 amendments 3 and 4): a run-input
 * `artifact` field that declares `multiple` uploads every file into ONE run —
 * its value the list of upload ids, under the one key. The field posts each
 * file's id under its `input:<key>` with the control `artifact-multiple`
 * (`RunFileField`), and the start-run action sends them as that list
 * (`declaredValues`). ~~One run per file and "{n} runs started"~~ until the
 * batch addendum.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import. (`run-files.ts` is the files a run made; this is the files a run is given.)
 */

/** The most files a field of several takes when its manifest names no `maxFiles` (the platform's default). */
export const DEFAULT_MAX_FILES = 50;

/** Said, and nothing sent, when a choice holds more than the field takes. */
export function tooManyFiles(max: number): string {
  return `Add up to ${max} files at a time.`;
}

/** The control a field of several files posts. */
export const SEVERAL_FILES = "artifact-multiple";

/** Under the field once its files are uploaded. */
export function filesSelected(count: number): string {
  return `${count} files selected`;
}
