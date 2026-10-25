/**
 * A tile: its value large over its label — the label first in the markup,
 * as a list says it — inside a `<dl>`. A run's details page's Duration and
 * Steps done (Build 21, spec A7), and an item's Total and verdict tallies
 * (Round 19, build 28; the owner's item 6: green and red, `tone`).
 */
export function Tile({
  label,
  value,
  testId,
  tone = "text-[var(--text)]",
}: {
  label: string;
  value: string;
  testId: string;
  /** The value's colour token class. */
  tone?: string;
}) {
  return (
    <div className="flex flex-col-reverse rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-4 py-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd data-testid={testId} className={`text-2xl font-medium ${tone}`}>
        {value}
      </dd>
    </div>
  );
}
