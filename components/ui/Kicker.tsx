import type { HTMLAttributes } from "react";

/**
 * Uppercase tracked eyebrow above a heading, in the accent voice
 * (the design's "Automation × AI" / "Solutions" section openers).
 */
export function Kicker({
  className = "",
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      {...rest}
      className={`mb-3.5 block text-[13px] tracking-[0.06em] text-[var(--color-accent)] uppercase ${className}`.trim()}
    />
  );
}
