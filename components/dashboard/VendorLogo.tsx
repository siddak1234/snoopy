import Image from "next/image";
import type { ButtonHTMLAttributes } from "react";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { brandLogo, type BrandLogo } from "@/lib/brand-logos";

/**
 * A vendor as a row shows it (spec §3.C): its own logo when its provider names
 * one, with no name beside it — the logo carries it; otherwise an icon (24)
 * and its name.
 */
export function VendorMark({
  icon,
  displayName,
  logoClassName,
}: {
  /** The provider's published icon name (`ConnectionProvider.icon`), when known. */
  icon: string | null | undefined;
  displayName: string;
  /** Placement for the logo, when it is one (`VendorLogo`'s `className`). */
  logoClassName?: string;
}) {
  const logo = brandLogo(icon);
  if (logo) return <VendorLogo logo={logo} className={logoClassName} />;
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <PlugsConnectedIcon
        aria-hidden
        className="size-6 shrink-0 text-[var(--muted)]"
      />
      <span className="truncate text-sm font-medium text-[var(--text)]">
        {displayName}
      </span>
    </span>
  );
}

/**
 * A vendor's own logo, 24 px tall (spec §4.2): both of the vendor's files,
 * the theme showing one (`.vendor-logo-*` in globals.css), each served as it
 * was given — `unoptimized`, so no re-encoding stands between the vendor's
 * bytes and the page — and scaled only in proportion. No tile, no background
 * shape.
 *
 * Its clear space is its own: 12 px of padding on every side (`p-3`), at
 * least the spec's 12 and more than Intuit's half the symbol's height (the
 * symbol is 536 of the file's 600 px, so about 21 px at 24 tall: 11 px), so
 * nothing a caller puts beside it comes closer. A caller may pull the padding
 * into empty space it owns (`className`, e.g. `-ml-3` at a card's padded
 * edge), never under another element.
 *
 * The logo carries the vendor's name, so nothing beside it repeats the name;
 * `alt` says it once, on the image the theme shows.
 */
export function VendorLogo({
  logo,
  height = 24,
  className = "",
}: {
  logo: BrandLogo;
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * logo.aspect);
  return (
    <span
      className={`inline-flex shrink-0 items-center p-3 ${className}`.trim()}
    >
      <Image
        src={logo.dark}
        alt={logo.alt}
        width={width}
        height={height}
        unoptimized
        className="vendor-logo-dark"
        style={{ height, width: "auto" }}
      />
      <Image
        src={logo.light}
        alt={logo.alt}
        width={width}
        height={height}
        unoptimized
        className="vendor-logo-light"
        style={{ height, width: "auto" }}
      />
    </span>
  );
}

/**
 * The vendor's own "Connect to …" button, as the vendor gives it: its size as
 * is, its default image and, on hover or keyboard focus, its hover image. Its
 * name is the vendor's words, said once for a screen reader. While the page
 * waits it is disabled and says so with the pointer alone — never faded:
 * Intuit's rules allow no change to how the button graphic looks.
 */
export function VendorConnectButton({
  logo,
  className = "",
  ...props
}: { logo: BrandLogo } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label"
>) {
  const { src, hover, width, height } = logo.connectButton;
  return (
    <button
      type="button"
      {...props}
      aria-label={logo.connectLabel}
      className={`vendor-connect inline-flex shrink-0 rounded-[4px] disabled:cursor-wait ${className}`.trim()}
    >
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        unoptimized
        className="vendor-connect-default"
      />
      <Image
        src={hover}
        alt=""
        width={width}
        height={height}
        unoptimized
        className="vendor-connect-hover"
      />
    </button>
  );
}
