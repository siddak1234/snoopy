/**
 * Several files in one upload (Round 21, platform round 2's B2; backend
 * ADR-0048 amendment 3): a run-input `artifact` field that declares
 * `multiple` takes several files, and each file starts its own run with the
 * same other inputs — the one start-run call (`startRun`), once per file.
 * The field posts its files' ids under one `input:<key>` each, its control
 * `artifact-multiple` (`RunFileField`); `perFileForms` turns that one form
 * into one form per file, each the plain `artifact` control `declaredValues`
 * already sends.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import. (`run-files.ts` is the files a run made; this is the files a run is given.)
 */

/** The most files one choice may add (a client guard; the platform names no other limit). */
export const FILES_AT_ONCE = 200;

/** Said, and nothing sent, when a choice holds more than `FILES_AT_ONCE`. */
export const TOO_MANY_FILES = "Add up to 200 files at a time.";

/** The control a field of several files posts. */
export const SEVERAL_FILES = "artifact-multiple";

/** Under the field once its files are uploaded. */
export function filesSelected(count: number): string {
  return `${count} files selected`;
}

/** Once their runs are started. */
export function runsStarted(count: number): string {
  return `${count} runs started`;
}

/**
 * One form per file of the first field of several files: the same other
 * inputs, that field's one file under the plain `artifact` control, and the
 * run's key made one per file (`<key>.<n>`) so a resubmission after a lost
 * answer returns each run already started rather than starting it again. A
 * form with no such field, or with one file or none in it, is one form, its
 * key as it was.
 */
export function perFileForms(form: FormData): FormData[] {
  let key: string | undefined;
  for (const [name, value] of form.entries()) {
    if (name.startsWith("input-control:") && value === SEVERAL_FILES) {
      key = name.slice("input-control:".length);
      break;
    }
  }
  if (key === undefined) return [form];
  const files = form
    .getAll(`input:${key}`)
    .filter((id): id is string => typeof id === "string" && id !== "");
  const runs = files.length === 0 ? [undefined] : files;
  return runs.map((file, at) => {
    const one = new FormData();
    for (const [name, value] of form.entries()) {
      if (name === `input:${key}`) continue;
      if (name === `input-control:${key}`) {
        one.append(name, "artifact");
        continue;
      }
      if (name === "idempotencyKey" && runs.length > 1) {
        one.append(name, `${String(value)}.${at + 1}`);
        continue;
      }
      one.append(name, value);
    }
    if (file !== undefined) one.append(`input:${key}`, file);
    return one;
  });
}
