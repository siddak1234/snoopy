import type { HTMLAttributes } from "react";

/**
 * Canonical page column: one max-width, one padding scale, everywhere.
 * (Replaces the 13 ad-hoc max-w-* values and pasted container divs.)
 */
export function Container({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`.trim()}
    />
  );
}

type SectionProps = HTMLAttributes<HTMLElement> & {
  /**
   * Saturated full-bleed section band (--color-section) with its top-glow —
   * the design's "presence at page scale". Content inside still needs a
   * Container.
   */
  band?: boolean;
  /** Skip the default vertical rhythm (for bespoke sections). */
  flush?: boolean;
};

/** Vertical page section with the Nocturne rhythm. */
export function Section({
  band = false,
  flush = false,
  className = "",
  ...rest
}: SectionProps) {
  const classes = [
    band
      ? "bg-[radial-gradient(900px_420px_at_85%_-40%,color-mix(in_srgb,var(--color-section-glow)_70%,transparent),transparent_64%),linear-gradient(var(--color-section),var(--color-section))]"
      : "",
    flush ? "" : band ? "py-16 sm:py-20" : "py-14 sm:py-20",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <section {...rest} className={classes} />;
}
