/**
 * The sign-in providers' glyphs exactly as the design inlines them (fill:
 * currentColor) — the same path data as the app's `ProviderGlyph`
 * (snoopy-mobile `components/nocturne/oauth-button.tsx`). Drawn at the row's
 * 24 on the one connection row (Google, spec A4; the owner's build 20 item 7:
 * "Google should also have its logo on the left then the name google after")
 * and on Settings' linked accounts (Google, Microsoft, Apple, spec A5; item 8:
 * "Rather than keys ok the left as icons i want the logos of the company's").
 * Decorative: its row says the name.
 */
export type GlyphProvider = "google" | "microsoft" | "apple";

export function ProviderGlyph({
  provider,
  size = 24,
  className = "",
}: {
  provider: GlyphProvider;
  size?: number;
  className?: string;
}) {
  if (provider === "apple") {
    return (
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox="0 0 384 512"
        className={className}
      >
        <path
          fill="currentColor"
          d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.7-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        />
      </svg>
    );
  }
  if (provider === "google") {
    return (
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
      >
        <path
          fill="currentColor"
          d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 21 21"
      className={className}
    >
      <rect x={0} y={0} width={10} height={10} fill="currentColor" />
      <rect x={11} y={0} width={10} height={10} fill="currentColor" />
      <rect x={0} y={11} width={10} height={10} fill="currentColor" />
      <rect x={11} y={11} width={10} height={10} fill="currentColor" />
    </svg>
  );
}

/** Whether a sign-in provider has a glyph: Google, Microsoft and Apple. */
export function isGlyphProvider(id: string): id is GlyphProvider {
  return id === "google" || id === "microsoft" || id === "apple";
}
