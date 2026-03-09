export function formatDateMediumUTC(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(d);
}

