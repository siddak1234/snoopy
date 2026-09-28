import { busyMessage, retryAfterSeconds } from "@/lib/retry-after";

const PLATFORM_API_BASE_PATH = "/api/platform";
const DEFAULT_RETURN_TO = "/account";
const RETURN_TO_VALIDATION_ORIGIN = "https://return-target.invalid";

export function safePlatformReturnTo(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized || !normalized.startsWith("/") || normalized.includes("\\")) {
    return DEFAULT_RETURN_TO;
  }
  try {
    const parsed = new URL(normalized, RETURN_TO_VALIDATION_ORIGIN);
    if (parsed.origin !== RETURN_TO_VALIDATION_ORIGIN) return DEFAULT_RETURN_TO;
    // Dot segments normalise away — "/.//evil.example" and "/%2e//evil.example"
    // both parse to the path "//evil.example" — and a path that begins with
    // "//" is read by the browser as another host. Refuse it after
    // normalisation, where it can no longer hide.
    if (parsed.pathname.startsWith("//")) return DEFAULT_RETURN_TO;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

/**
 * The sign-in page with a return to `returnTo`, validated the same way the
 * login page reads it back, so a caller cannot build a return the page would
 * refuse. Every sign-in return is built here (register F42); a plain "Sign in"
 * link with nowhere to come back to is just `/login`.
 */
export function loginHref(returnTo: string | null | undefined): string {
  return `/login?callbackUrl=${encodeURIComponent(safePlatformReturnTo(returnTo))}`;
}

export function platformApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PLATFORM_API_BASE_PATH}${normalized}`;
}

export class PlatformApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    /** From a 429's `retry-after`: how long the platform asked to be left. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}

/**
 * The session ended while the page was open — the one failure a person answers
 * by signing in again, rather than by waiting or retrying (register F40). One
 * rule for every browser caller; each pairs it with `loginHref()` so the way
 * back returns to where they were.
 */
export function sessionEnded(error: unknown): boolean {
  return error instanceof PlatformApiError && error.status === 401;
}

export async function platformApiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(platformApiPath(path), {
    credentials: "same-origin",
    ...init,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) {
      const wait = retryAfterSeconds(response.headers.get("retry-after"));
      throw new PlatformApiError(busyMessage(wait), 429, wait);
    }
    // Only a non-empty string is a title (register F41): anything else a JSON
    // intermediary put there would render as "[object Object]" or as nothing.
    const title =
      body !== null &&
      typeof body === "object" &&
      "title" in body &&
      typeof body.title === "string" &&
      body.title.length > 0
        ? body.title
        : `Platform request failed with status ${response.status}`;
    throw new PlatformApiError(title, response.status);
  }
  return body as T;
}

export async function signOutFromPlatform(): Promise<void> {
  const response = await fetch(platformApiPath("/v1/auth/logout"), {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 401) {
    throw new Error("Could not sign out");
  }
}

/**
 * How long a file may take to reach the store: as long as its signed URL is
 * good for (the store's upload sessions last 15 minutes). A PUT still going
 * after that could not be completed anyway, so it is given up rather than left
 * "Uploading…" for ever.
 */
const UPLOAD_TIMEOUT_MS = 15 * 60_000;

/**
 * Sends a file straight to the store, at a URL the platform signed for it
 * (backend FR-14) — not a platform call, so no cookie and no `/api/platform`.
 * The size is signed into the URL, and the browser sets `Content-Length` from
 * the file itself, so only this file fits it. `signal` is the caller's: a file
 * chosen again, or a form closed, stops the one in flight.
 */
export async function putFileToSignedUrl(
  url: string,
  file: Blob,
  signal?: AbortSignal,
): Promise<void> {
  const upload = new AbortController();
  const stop = () => upload.abort();
  const timer = setTimeout(stop, UPLOAD_TIMEOUT_MS);
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      body: file,
      credentials: "omit",
      signal: upload.signal,
    });
  } catch {
    throw new PlatformApiError("The file could not be sent. Try again.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
  if (!response.ok) {
    throw new PlatformApiError(
      "The file was not accepted. Choose it again.",
      response.status,
    );
  }
}
