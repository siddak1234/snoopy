/**
 * A8X brand mark — geometric sans construction.
 * Use currentColor; works on light or dark backgrounds.
 */
export default function LogoMark({
  width = 60,
  height = 24,
  className = "",
  accentEight = false,
}: {
  width?: number;
  height?: number;
  className?: string;
  /** Optional: use accent color on the 8 (e.g. teal). Requires CSS var --brand-accent. */
  accentEight?: boolean;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* A — geometric sans, apex and crossbar */}
      <path
        d="M3 20 9 4l6 16M6 12h6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 8 — two circles (loops / process cycles), clearly reads as 8 */}
      <path
        d="M33 8a5 5 0 0 1-10 0 5 5 0 0 1 10 0M33 16a5 5 0 0 1-10 0 5 5 0 0 1 10 0"
        stroke={accentEight ? "var(--brand-accent, currentColor)" : "currentColor"}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* X — crossing diagonals, same weight as A */}
      <path
        d="M42 4l16 16M58 4 42 20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
