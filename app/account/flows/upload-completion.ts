import type { CompleteUploadResult } from "./upload-actions";

/**
 * A run's file whose completion finds no place yet to measure it is completed
 * again by itself (Round 17's B5; the owner's rule of 2026-10-13: "dont start
 * adding blockers, see how we can work around them").
 *
 * Since backend BUILD-PLAN 25.2.39 the platform measures files in turn — two
 * places a process, one a workspace — and a completion that finds none is
 * answered at once, 429 `measurement_busy`: nothing was refused and nothing was
 * lost, the upload stays open, and completing it again shortly measures it (its
 * sealing is idempotent). Two runs started at once in one workspace meet it. So
 * the same upload is completed again, at most four more times, each after the
 * wait the answer's `retry-after` names or else 1.5 s, while the field still
 * says it is uploading and nothing else. Only a file still waiting after the
 * last is said in words (`upload-refusals.ts`). Any other answer — another 429,
 * or this reason on another status — is returned at once, as before.
 *
 * Bounded: a `retry-after` over 5 s is not waited out — that answer is said at
 * once — so the waits come to 20 s at most, and to 6 s when the platform names
 * none, as it does not today. Each wait is in the browser, between completions,
 * never inside one: each keeps its own 10 s (`lib/platform-server.ts`), and
 * Next dispatches a client's server actions one at a time, so a wait inside one
 * would hold every other action of the page behind it. The upload's session
 * lasts 15 minutes from its opening (the PUT's own bound, `lib/platform-api.ts`);
 * one that ends anyway is refused `session_expired` and said as it always was.
 * A new choice, or the field going, stops the waiting at once, and nothing is
 * completed after it.
 */

/** The completions asked after the first while the file waits to be measured. */
export const MEASUREMENT_RETRIES = 4;
/** The wait before each when the answer names none. */
export const MEASUREMENT_RETRY_WAIT_MS = 1_500;
/** The longest `retry-after` waited out; a longer one ends the retries. */
export const MEASUREMENT_RETRY_LONGEST_WAIT_MS = 5_000;

/**
 * A completion whose file has no place yet to be measured: a 429 naming
 * `measurement_busy`, and nothing else — not another 429 (the platform's
 * request limits), and not that reason on another status.
 */
export function waitsToBeMeasured(
  status: number,
  details: Record<string, unknown> | undefined,
): boolean {
  return status === 429 && details?.reason === "measurement_busy";
}

/** Resolves after `ms`, or as soon as `signal` aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const end = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", end);
      resolve();
    };
    const timer = setTimeout(end, ms);
    signal.addEventListener("abort", end, { once: true });
  });
}

/**
 * `complete` asked once, and again while its answer says the file waits to be
 * measured. The last answer is returned: the file, any other refusal, or —
 * after the fourth retry, or a `retry-after` too long to wait — the wait's own
 * words. Once `signal` aborts nothing more is asked, and the caller, which
 * checks it, shows nothing.
 */
export async function completeWhenMeasured(
  complete: () => Promise<CompleteUploadResult>,
  signal: AbortSignal,
): Promise<CompleteUploadResult> {
  let answer = await complete();
  for (let retry = 1; retry <= MEASUREMENT_RETRIES; retry += 1) {
    if (answer.ok || !answer.measurementBusy) return answer;
    const wait =
      answer.retryAfterSeconds === undefined
        ? MEASUREMENT_RETRY_WAIT_MS
        : answer.retryAfterSeconds * 1_000;
    if (wait > MEASUREMENT_RETRY_LONGEST_WAIT_MS) return answer;
    // Ends at once if the field has gone, before the wait or during it.
    await pause(wait, signal);
    if (signal.aborted) return answer;
    answer = await complete();
  }
  return answer;
}
