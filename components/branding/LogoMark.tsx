/**
 * A8X brand mark — geometric sans, optical kerning, interlocked-hoops "8".
 * Grouped glyphs (A, 8, X) for easy kerning tweaks.
 * Use currentColor; works on light or dark backgrounds.
 */
export default function LogoMark({
  width = 48,
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

  // Content width after optical kerning: 0–45. Center in viewBox 48×24.
  const contentWidth = 45;
  const offsetX = (48 - contentWidth) / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        {/* Top hoop passes behind bottom at overlap; mask hole in viewBox coords to align with bottom hoop */}
        <mask id="a8x-eight-top-mask" maskUnits="userSpaceOnUse">
          <rect x="-4" y="-4" width="56" height="32" fill="white" />
          <circle cx={21 + offsetX} cy="14.5" r="5.2" fill="black" />
        </mask>
      </defs>

      <g transform={`translate(${offsetX}, 0)`}>
        {/* Glyph A — geometric sans, apex and crossbar. Visual right edge ~13. */}
        <g aria-hidden>
          <path
            d="M2 20 6.5 4 11 20M4.5 12h5"
            stroke="currentColor"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Glyph 8 — interlocked hollow hoops (tubing). Center x=21. Bottom hoop raised (y=14.5). */}
        <g aria-hidden>
          {/* Bottom hoop (drawn first = behind) */}
          <path
            d="M25.5 14.5a4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1 9 0"
            stroke={eightColor}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Top hoop (masked so it goes behind at crossing) */}
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
        </g>

        {/* Glyph X — crossing diagonals. Starts at 29 so A–8 and 8–X gaps are equal (~3.5). */}
        <g aria-hidden>
          <path
            d="M29 4l16 16M45 4 29 20"
            stroke="currentColor"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
