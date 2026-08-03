import Image from "next/image";

type ImagePlaceholderProps = {
  /** CSS aspect-ratio, e.g. "16/9" or "4/3". Ignored when `fill` is set. */
  aspect?: string;
  /** Cover the positioned parent (for full-bleed scroll-story layers). */
  fill?: boolean;
  alt: string;
  /**
   * The one-line swap: give it a photo (public/ path or remote) and the
   * placeholder becomes a real next/image. Prefer photographs shot on dark
   * backgrounds — the .lighten wrapper blends them into the page.
   */
  src?: string;
  /** Corner rounding for standalone (non-fill) placeholders. */
  rounded?: boolean;
  className?: string;
};

/**
 * Stand-in for the design's photo slots until photography is chosen:
 * an on-brand dark gradient with an accent glow, hairline border and a faint
 * dot grid, sized exactly like the slot it fills.
 */
export function ImagePlaceholder({
  aspect = "16/9",
  fill = false,
  alt,
  src,
  rounded = true,
  className = "",
}: ImagePlaceholderProps) {
  const shapeClasses = fill
    ? "absolute inset-0"
    : `relative w-full ${rounded ? "rounded-[var(--radius-lg)] border border-[var(--color-neutral-800)]" : ""}`;

  if (src) {
    return (
      <div
        className={`${shapeClasses} overflow-hidden ${className}`.trim()}
        style={fill ? undefined : { aspectRatio: aspect }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`${shapeClasses} overflow-hidden ${className}`.trim()}
      style={fill ? undefined : { aspectRatio: aspect }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(165deg,var(--color-neutral-900),var(--color-bg))]" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_20%,color-mix(in_srgb,var(--color-accent-900)_75%,transparent),transparent_65%)]" />
      <div className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-neutral-800)_1px,transparent_1.4px)] [background-size:28px_28px] opacity-40" />
      <span
        aria-hidden
        className="absolute bottom-3 left-4 inline-block h-px w-11 bg-[var(--color-accent)]"
      />
    </div>
  );
}
