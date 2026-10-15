/**
 * A vendor's own brand mark, by the icon name the platform publishes for its
 * provider (`ConnectionProvider.icon`, backend BUILD-PLAN 25.4.18): still a
 * name, never a URL (backend §12.1 #72), resolved here to the vendor's approved
 * files, bundled under `public/vendors/` byte for byte as the vendor gives them.
 * A name not listed here is not a brand: the page draws an icon for it instead.
 *
 * QuickBooks's rules (Intuit's naming and logo guidelines and its co-branding
 * guidelines, read 2026-10-14): the full logo, never the round symbol alone;
 * unaltered, scaled only in proportion; the preferred (dark wordmark) logo on a
 * light ground and the reversed (white wordmark) one on a dark ground; no
 * containing shape; Intuit's own green "Connect to QuickBooks" button, used as
 * it is, while QuickBooks is not connected, and "Disconnect from QuickBooks"
 * once it is. test/brand-logos.test.mjs holds every file to its sha256.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

export type BrandLogo = {
  /** The logo for the light theme: the preferred, dark wordmark. */
  light: string;
  /** The logo for the dark theme: the reversed, white wordmark. */
  dark: string;
  /** Width over height of both logo files, so a height alone sizes them. */
  aspect: number;
  /** What the logo says, for a screen reader. */
  alt: string;
  /** The vendor's own connect button, its hover state, and its size as given. */
  connectButton: {
    src: string;
    hover: string;
    width: number;
    height: number;
  };
  /** The words the vendor requires on its connect and disconnect controls. */
  connectLabel: string;
  disconnectLabel: string;
};

export const BRAND_LOGOS = {
  QuickBooksLogo: {
    light: "/vendors/quickbooks-logo.png",
    dark: "/vendors/quickbooks-logo-reversed.png",
    aspect: 2345 / 600,
    alt: "QuickBooks",
    connectButton: {
      src: "/vendors/connect-to-quickbooks.svg",
      hover: "/vendors/connect-to-quickbooks-hover.svg",
      width: 274,
      height: 48,
    },
    connectLabel: "Connect to QuickBooks",
    disconnectLabel: "Disconnect from QuickBooks",
  },
} as const satisfies Record<string, BrandLogo>;

/** Every bundled file and its sha256, as recorded from Intuit's downloads. */
export const BRAND_FILE_SHA256 = {
  // https://digitalasset.intuit.com/content/dam/intuit/sa/en_us/quickbooks/brand-design-guidelines/quickbooks-brand-preferred-logo-50-50-black-external.png
  "public/vendors/quickbooks-logo.png":
    "67fcdc67a032a068feeecddecb0cd9f4d12020dddb199a3c155837abef3cc2eb",
  // …-50-50-white-external.png
  "public/vendors/quickbooks-logo-reversed.png":
    "3837c7d32394cc53f9785d02a307cfa71fa5b602b2be159964e02cdcd735b21e",
  // https://static.developer.intuit.com/resources/Connect_to_QuickBooks_buttons.zip
  // (sha256 8f21125be0720874d0c6c90558bbd62565b8a993d1d8f7fb23ce677bb4651a78),
  // Connect_to_QuickBooks_English/Connect_to_QuickBooks_SVG/C2QB_green_btn_tall_default.svg
  "public/vendors/connect-to-quickbooks.svg":
    "7feb6af9992966c8ab6bf8369b076aaec4ad9f55413a066d840c3073ec845ab8",
  // …/C2QB_green_btn_tall_hover.svg
  "public/vendors/connect-to-quickbooks-hover.svg":
    "0b7fd52dd2287ca94d791e419670a8fb3458e038f8373b31c7e3b3820a236784",
} as const;

export type BrandName = keyof typeof BRAND_LOGOS;

/** The brand mark an icon name names, or null when it names none. */
export function brandLogo(icon: string | null | undefined): BrandLogo | null {
  if (!icon || !Object.hasOwn(BRAND_LOGOS, icon)) return null;
  return BRAND_LOGOS[icon as BrandName];
}

/**
 * A disconnect's confirm (spec §3.C, §3.I), in the app's words: the vendor's
 * own words where it has them — "Disconnect from QuickBooks?" — else
 * "Disconnect {name}?"; and one line under it.
 */
export function disconnectTitle(
  icon: string | null | undefined,
  displayName: string,
): string {
  const logo = brandLogo(icon);
  return `${logo ? logo.disconnectLabel : `Disconnect ${displayName}`}?`;
}

export const DISCONNECT_BODY = "You can connect it again any time.";
