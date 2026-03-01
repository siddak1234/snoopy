/**
 * A8X brand mark — geometric sans, tight wordmark spacing.
 * "8" = interlocked hollow hoops (stroke-based, mask for over-under).
 * Use currentColor; works on light or dark backgrounds.
 */
export default function LogoMark({
  width = 50,
  height = 24,
  className = "",
  accentEight = false,
}: {
  width?: number;
  height?: number;
  className?: string;
  /** Optional: use accent color on the 8. Requires CSS var --brand-accent. */
  accentEight?: boolean;
}) {
  const strokeW = 2.5;
  const eightColor = accentEight ? "var(--brand-accent, currentColor)" : "currentColor";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 50 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        {/* Top loop passes behind bottom at overlap; mask hides top stroke inside bottom circle */}
        <mask id="a8x-eight-top-mask">
          <rect x="-2" y="-2" width="54" height="28" fill="white" />
          <circle cx="21" cy="16" r="5.2" fill="black" />
        </mask>
      </defs>

      {/* A — geometric sans, apex and crossbar; tightened */}
      <path
        d="M2 20 6.5 4 11 20M4.5 12h5"
        stroke="currentColor"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 8 — interlocked hollow hoops: bottom loop full, top loop masked so it goes "behind" */}
      {/* Bottom loop (drawn first = behind) */}
      <path
        d="M25.5 16a4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1 9 0"
        stroke={eightColor}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top loop (masked to appear behind at crossing) */}
      <g mask="url(#a8x-eight-top-mask)">
        <path
          d="M25.5 8a4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1 9 0"
          stroke={eightColor}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* X — crossing diagonals, same weight; tightened */}
      <path
        d="M28 4l16 16M44 4 28 20"
        stroke="currentColor"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
