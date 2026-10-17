export function formatDateMediumUTC(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(d);
}

/**
 * A timestamp as a person reads it: fixed locale and UTC on purpose — these
 * screens are drawn on the server, and a locale-dependent string differs
 * between the server and the browser, which React reports as a hydration
 * mismatch.
 */
export function formatDateTimeMediumUTC(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}
