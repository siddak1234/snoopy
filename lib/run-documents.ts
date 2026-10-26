/**
 * The run package's words and rules (Build 24, P12; backend ADR-0045): the
 * job's documents as the A8X PDF and an Excel workbook. Whether a job has a
 * package is the platform's (`RunDetail.packageAvailable`). ~~A run's
 * documents as the run page's cards draw them~~ until Round 21 (backend
 * ADR-0048): the platform sends them as blocks (`components/blocks`), and
 * the backend's tests hold every word the cards said.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/*
 * The platform builds the package and answers it behind a short-lived signed
 * link — never the bytes. ~~Download JSON~~ until
 * Build 24: the package's two files replace it.
 */

/** The run page's way to the package page, and the two downloads (the app's words). */
export const VIEW_PACKAGE = "View package";
export const DOWNLOAD_PDF = "Download PDF";
export const DOWNLOAD_EXCEL = "Download Excel";
export const DOWNLOAD_FAILED = "Could not download. Try again.";
/** The package page of a job the platform cannot package yet (no documents, or still going). */
export const PACKAGE_UNAVAILABLE = "This run has no package yet.";

/**
 * The largest package file shown inline: the platform's own bound, 25 MiB —
 * the file store's ceiling, past which `createRunPackageFile` answers 422
 * `package_too_large` — so no file the platform built is refused here.
 */
export const RUN_PACKAGE_MAXIMUM_BYTES = 25 * 1024 * 1024;

/** The longest `retry-after` a package request waits out before asking once more. */
const PACKAGE_LONGEST_WAIT_SECONDS = 10;

/**
 * How long to wait before asking once more for a package the platform is too
 * busy to build (503 `package_busy`): its `retry-after` (2 s when it names
 * none), or `null` — not waited out, said at once — when that is over 10 s.
 */
export function packageRetryWaitMs(
  retryAfterSeconds: number | undefined,
): number | null {
  if (retryAfterSeconds === undefined) return 2_000;
  return retryAfterSeconds <= PACKAGE_LONGEST_WAIT_SECONDS
    ? retryAfterSeconds * 1_000
    : null;
}

/**
 * A package request as both its askers make it: the run page's downloads,
 * through `/api/platform`, and the package page's route, on the server. A
 * platform busy building others (503) is asked once more after
 * `packageRetryWaitMs`. Busy again, a wait over 10 s, or any other refusal is
 * thrown to the caller. `refusal` reads a thrown error's status and
 * `retry-after` from each asker's own error class, else `null`. The app's
 * `requestRunPackageFile`. `sleep` is for tests.
 */
export async function askPackageOnceMore<T>(
  ask: () => Promise<T>,
  refusal: (
    error: unknown,
  ) => { status: number; retryAfterSeconds?: number } | null,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  try {
    return await ask();
  } catch (error) {
    const refused = refusal(error);
    const wait =
      refused?.status === 503
        ? packageRetryWaitMs(refused.retryAfterSeconds)
        : null;
    if (wait === null) throw error;
    await sleep(wait);
    return ask();
  }
}

/**
 * The package page's frame: the site's own route, which asks the platform for
 * the PDF in this zone and hands it on inline (`…/package/file`).
 */
export function packageFileHref(
  runId: string,
  timeZone: string | null,
): string {
  const zone = timeZone ? `?timeZone=${encodeURIComponent(timeZone)}` : "";
  return `/account/runs/${encodeURIComponent(runId)}/package/file${zone}`;
}
