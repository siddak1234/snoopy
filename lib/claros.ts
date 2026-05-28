// Claros team project UUIDs. Add to this set if Claros ever stands up another
// team project that should use the Claros pipeline (Claros GCS bucket,
// Claros n8n webhook, 80-row Claros chart of accounts). Anything not in this
// set falls through to the Autom8x / general flow — including personal
// projects owned by Claros employees. The boundary is the project, not the
// person.

export const CLAROS_PROJECT_IDS = new Set<string>([
  "9b5afad3-3ae6-48ba-9e33-648347e81d27",
]);
