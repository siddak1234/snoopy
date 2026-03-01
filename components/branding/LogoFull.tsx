import Link from "next/link";
import LogoMark from "./LogoMark";

const brandName = "Autom8x";

type LogoFullProps = {
  width?: number;
  height?: number;
  className?: string;
  /** Show only the mark (no wordmark). */
  markOnly?: boolean;
  /** Wrap in home link when true. */
  asLink?: boolean;
  accentEight?: boolean;
};

export default function LogoFull({
  width = 60,
  height = 24,
  className = "",
  markOnly = false,
  asLink = true,
  accentEight = false,
}: LogoFullProps) {
  const content = (
    <>
      <LogoMark
        width={width}
        height={height}
        accentEight={accentEight}
        className="shrink-0"
      />
      {!markOnly && (
        <span className="ml-2.5 text-lg font-bold tracking-tight text-[var(--text)] sm:text-xl">
          {brandName}
        </span>
      )}
    </>
  );

  const wrapperClass =
    "flex shrink-0 items-center gap-2.5 text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] rounded-full";

  if (asLink) {
    return (
      <Link href="/" className={wrapperClass} aria-label={brandName}>
        {content}
      </Link>
    );
  }

  return <span className={wrapperClass}>{content}</span>;
}
