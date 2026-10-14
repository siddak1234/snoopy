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
}: {
  /** The provider's published icon name (`ConnectionProvider.icon`), when known. */
  icon: string | null | undefined;
  displayName: string;
}) {
  const logo = brandLogo(icon);
  if (logo) return <VendorLogo logo={logo} />;
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
 * shape, and the clear space around it is the caller's margin.
 *
 * The logo carries the vendor's name, so nothing beside it repeats the name;
 * `alt` says it once, on the image the theme shows.
 */
export function VendorLogo({
  logo,
  height = 24,
}: {
  logo: BrandLogo;
  height?: number;
}) {
  const width = Math.round(height * logo.aspect);
  return (
    <span className="inline-flex shrink-0 items-center">
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
 * name is the vendor's words, said once for a screen reader.
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
      className={`vendor-connect inline-flex shrink-0 rounded-[4px] disabled:opacity-60 ${className}`.trim()}
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
