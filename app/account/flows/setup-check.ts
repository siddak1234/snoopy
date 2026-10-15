/**
 * What Set up checks before it sends (spec §3.B): an amount left empty —
 * "Enter an amount for {title}." — and every required field left empty —
 * "Fill in: {titles}." An amount is required whenever it has a value to fall
 * back to: emptying one is not how a limit is turned off. The platform checks
 * everything else.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

type SetupField = {
  key: string;
  title: string;
  control: string;
  required: boolean;
  defaultValue?: unknown;
};

export function setupProblem(
  setup: readonly SetupField[],
  form: FormData,
): string | null {
  const blank = (field: SetupField) => {
    const value = form.get(`config:${field.key}`);
    return typeof value !== "string" || value.trim() === "";
  };
  const money = setup.find(
    (field) =>
      field.control === "money" &&
      (field.required || Object.hasOwn(field, "defaultValue")) &&
      blank(field),
  );
  if (money) return `Enter an amount for ${money.title}.`;
  const missing = setup.filter(
    (field) =>
      field.required &&
      !Object.hasOwn(field, "defaultValue") &&
      field.control !== "toggle" &&
      blank(field),
  );
  if (missing.length > 0)
    return `Fill in: ${missing.map((field) => field.title).join(", ")}.`;
  return null;
}
