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
 * name and an x"), it holds every start form's file words too: Take photo
 * beside Upload off Home's card (`TAKE_PHOTO_LABEL`), the error of a
 * required file missing (`addFileFirst`, found by `missingFile`), each
 * pill's x (`removeFileLabel`, `withoutFile`), and what a screen reader is
 * told as an upload ends or an x takes a file out (`uploadedLine`,
 * `uploadedCountLine`, `removedLine`). ~~`filesSelected`, "{n} files
 * selected" under a field of several~~ until build 43: its pills. ~~Upload's
 * menu row "Choose file" on Home's card (`CHOOSE_FILE_LABEL`)~~ until build
 * 43, item 3: the browser's own chooser (`RunFileField`).
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

/** The camera: a button beside Upload, on a phone or a tablet, off Home's card. */
export const TAKE_PHOTO_LABEL = "Take photo";

/** Spoken, not shown, when one file chosen has uploaded. */
export function uploadedLine(name: string): string {
  return `Uploaded ${name}.`;
}

/** Spoken, not shown, when several files chosen at once have uploaded. */
export function uploadedCountLine(count: number): string {
  return `Uploaded ${count} files.`;
}

/** Spoken, not shown, when a pill's x takes its file out. */
export function removedLine(name: string): string {
  return `Removed ${name}.`;
}

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
