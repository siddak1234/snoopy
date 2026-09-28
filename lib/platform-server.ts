import { cookies, headers } from "next/headers";
import { backendApiOrigin } from "@/lib/backend-origin";
import { requestCookieHeader } from "@/lib/cookie-header";
import { busyMessage, retryAfterSeconds } from "@/lib/retry-after";

/**
 * Server-side calls to the backend, from a Server Component or a Server Action.
 *
 * Distinct from `lib/platform-api.ts`, which is the browser's path: that one
 * uses the relative `/api/platform` rewrite and lets the browser attach the
 * cookie. On the server there is no ambient cookie jar, so the session has to be
 * forwarded explicitly and the origin named.
 *
 * This module never imports a database driver. The website's only source of
 * truth is the backend, and every helper here goes through the same Edge routes
 * a browser would.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export class PlatformServerError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    /** The RFC 9457 `code`, when the backend supplied one. */
    public readonly code?: string,
    /** Public, structured details. Callers must whitelist what they render. */
    public readonly details?: Record<string, unknown>,
    /** From a 429's `retry-after`: how long the platform asked to be left. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PlatformServerError";
  }
}

/** Thrown when the site has no backend configured, so callers can render an honest empty state. */
export class PlatformNotConfiguredError extends Error {
  public constructor() {
    super("BACKEND_API_ORIGIN is not configured");
    this.name = "PlatformNotConfiguredError";
  }
}

type Problem = {
  title?: string;
  code?: string;
  details?: Record<string, unknown>;
};

function fallbackProblemTitle(status: number): string {
  if (status === 400) return "The request could not be accepted.";
  if (status === 401) return "Sign in is required.";
  if (status === 403) return "You are not allowed to complete this action.";
  if (status === 404) return "The requested resource is unavailable.";
  if (status === 409)
    return "This request conflicts with an earlier operation.";
  if (status === 502 || status === 503)
    return "The platform could not complete this request.";
  return "The platform could not complete this request.";
}

function publicProblem(value: unknown): Problem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const problem = value as Record<string, unknown>;
  return {
    ...(typeof problem.title === "string" ? { title: problem.title } : {}),
    ...(typeof problem.code === "string" ? { code: problem.code } : {}),
    ...(problem.details &&
    typeof problem.details === "object" &&
    !Array.isArray(problem.details)
      ? { details: problem.details as Record<string, unknown> }
      : {}),
  };
}

/**
 * The path of one workspace's resources — every workspace-scoped call builds its
 * path here, so an id is always encoded (register F9). The id comes from the
 * server's own session read, but a path that could be steered by one is a path
 * built in one place.
 */
export function workspacePath(workspaceId: string): string {
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export async function platformServerJson<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const origin = backendApiOrigin();
  if (!origin) throw new PlatformNotConfiguredError();

  const cookieHeader = requestCookieHeader(await cookies());
  // The Edge refuses cookie-carrying mutations whose Origin is not the public
  // web origin (its CSRF check). Server-side fetch sends no Origin on its own,
  // so forward the caller's — a value Next has already verified against Host
  // for server actions, not a guess.
  const headerStore = await headers();
  const requestOrigin =
    headerStore.get("origin") ?? `https://${headerStore.get("host")}`;
  const { idempotencyKey, ...request } = init ?? {};

  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      ...request,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader,
        origin: requestOrigin,
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        ...request.headers,
      },
      // Session-scoped data. Caching it would show one workspace another's
      // catalog state, which is the one mistake this layer must not make.
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new PlatformServerError("The platform is unreachable", 502);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const problem = publicProblem(body);
    if (response.status === 429) {
      const wait = retryAfterSeconds(response.headers.get("retry-after"));
      throw new PlatformServerError(
        busyMessage(wait),
        429,
        problem.code,
        problem.details,
        wait,
      );
    }
    throw new PlatformServerError(
      problem.title ?? fallbackProblemTitle(response.status),
      response.status,
      problem.code,
      problem.details,
    );
  }
  return body as T;
}

/**
 * A PUBLIC read — the same answer for every visitor — cached for
 * `revalidateSeconds`. Backend §12.1 #160 and ADR-0029: every request the website
 * makes reaches the Edge from the website's own servers, and a signed-out visitor
 * is keyed by that shared address, so a read every visitor makes is the one worth
 * making once a minute rather than once a view.
 *
 * **No cookie and no forwarded header is sent**, which is what makes caching it
 * safe: nothing session-scoped can reach this cache, and the platform answers it
 * identically for everyone. Session-scoped reads stay on `platformServerJson`,
 * which never caches.
 */
export async function platformPublicJson<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T> {
  const origin = backendApiOrigin();
  if (!origin) throw new PlatformNotConfiguredError();

  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new PlatformServerError("The platform is unreachable", 502);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) {
      const wait = retryAfterSeconds(response.headers.get("retry-after"));
      throw new PlatformServerError(
        busyMessage(wait),
        429,
        undefined,
        undefined,
        wait,
      );
    }
    throw new PlatformServerError(
      fallbackProblemTitle(response.status),
      response.status,
    );
  }
  return body as T;
}

/**
 * An idempotency key for one mutation.
 *
 * The backend requires 16-128 characters and treats the same key with different
 * input as a conflict rather than a replay, so this is per-attempt rather than
 * per-form: a user who edits and resubmits is making a new request, not retrying
 * the old one.
 */
export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`.slice(0, 128);
}
