/**
 * The one sentence for a part this build cannot draw (backend ADR-0048
 * decision 10; the owner's words, 2026-10-26): an unknown block, form or
 * page part, at the top level or inside a section, and a page whose blocks
 * did not come. The platform's other sentences ("This file isn't
 * available.", "This is too long to show here.") come as blocks; this one
 * is the website's own, held here alone.
 */
export const FALLBACK = "This part can't be shown here yet.";

export function Fallback() {
  return (
    <p data-testid="block-fallback" className="text-sm text-[var(--muted)]">
      {FALLBACK}
    </p>
  );
}
