/**
 * A signed link the browser goes to (Build 25, the review's R5c 2): the run
 * package's Download PDF and Download Excel, and the complete export's Download
 * file. Only an `https:` link is followed. Anything else (`http:`,
 * `javascript:`, no address at all) is refused and never followed, and the
 * page says it could not download. The same rule as the server's
 * `platformSignedFile` (`lib/platform-server.ts`) and the app's `signedLink`
 * (`snoopy-mobile/lib/platform/signed-file.ts`).
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** The link when it is `https:`, else `null`. */
export function httpsLink(url: string): string | null {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Goes to a signed link when it is `https:` and says so (`true`); anything
 * else is not followed (`false`), so the caller says its refusal. `go` is the
 * browser's `location.assign`, and a test's own.
 */
export function followSignedLink(
  url: string,
  go: (link: string) => void = (link) => window.location.assign(link),
): boolean {
  const link = httpsLink(url);
  if (link === null) return false;
  go(link);
  return true;
}
