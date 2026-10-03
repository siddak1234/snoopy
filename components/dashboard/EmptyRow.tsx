import type { ReactNode } from "react";

/**
 * A section with nothing to list yet, or no workspace to list it for — the one
 * row the account pages render in that case, instead of a private copy each
 * (register F29).
 *
 * Given a `title`, it is a whole screen that is empty, in the app's standard
 * (the owner, build 9): centred, an accent-tinted icon, the title, one line and
 * somewhere to go. Only a whole page takes the title; a section inside one
 * stays the single line.
 */
export function EmptyRow({
  text,
  title,
  icon,
  action,
}: {
  text: string;
  title?: string;
  /** Decorative: the title says what the screen is. */
  icon?: ReactNode;
  action?: ReactNode;
}) {
  if (!title) {
    return (
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">{text}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {icon ? (
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--chip-bg)] text-[var(--accent-strong)]"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="mt-5 text-lg font-medium text-[var(--text)]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">{text}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
