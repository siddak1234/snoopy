/**
 * A section with nothing to list yet, or no workspace to list it for — the one
 * row the account pages render in that case, instead of a private copy each
 * (register F29).
 */
export function EmptyRow({ text }: { text: string }) {
  return (
    <div className="py-5 first:pt-0">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}
