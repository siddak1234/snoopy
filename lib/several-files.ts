/**
 * Several files in one upload (Round 21, platform round 2's B2 as the batch
 * addendum amends it; backend ADR-0048 amendments 3 and 4): a run-input
 * `artifact` field that declares `multiple` uploads every file into ONE run —
 * its value the list of upload ids, under the one key. The field posts each
 * file's id under its `input:<key>` with the control `artifact-multiple`
 * (`RunFileField`), and the start-run action sends them as that list
 * (`declaredValues`).
 *
 * Since build 43, item 17 (the owner's words of 2026-11-13: "start throws an
 * error rather than starting if nothing was uploaded when required … the
 * document should dynamically show up in a horizontal pill with the document
 * name and an x"), it holds every start form's file words too: Upload's two
 * rows on Home's card (`TAKE_PHOTO_LABEL`, `CHOOSE_FILE_LABEL`), the error
 * of a required file missing (`addFileFirst`, found by `missingFile`), and
 * each pill's x (`removeFileLabel`, `withoutFile`). ~~`filesSelected`, "{n}
 * files selected" under a field of several~~ until build 43: its pills.
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

/** The camera: a button beside Upload, or the first row of Upload's menu on Home's card. */
export const TAKE_PHOTO_LABEL = "Take photo";

/** The file picker: the second row of Upload's menu on Home's card. */
export const CHOOSE_FILE_LABEL = "Choose file";

/** The start form's error when a required file field holds no file: the field's own title. */
export function addFileFirst(title: string): string {
  return `Add ${title} first.`;
}

/** The spoken name of a pill's x. */
export function removeFileLabel(name: string): string {
  return `Remove ${name}`;
}

/** A run-input field as `missingFile` reads it (the platform's `AutomationRunInputField`). */
type FieldLike = {
  key: string;
  title: string;
  control: string;
  required?: boolean;
};

/**
 * The first field, in run-input order, that is a required file (`artifact`,
 * `required: true`) and holds no uploaded file (`has` says no), or undefined:
 * Start then says `addFileFirst` of its title and sends nothing. An optional
 * file field, and every other control, is never missing here (the platform's
 * 422 stays the backstop).
 */
export function missingFile<Field extends FieldLike>(
  runInput: readonly Field[],
  has: (key: string) => boolean,
): Field | undefined {
  return runInput.find(
    (field) =>
      field.control === "artifact" &&
      field.required === true &&
      !has(field.key),
  );
}

/** The files a field holds once the one at `at` is taken out: the rest, in their order. */
export function withoutFile<Sent>(files: readonly Sent[], at: number): Sent[] {
  return files.filter((_, index) => index !== at);
}
