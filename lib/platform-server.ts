import { cookies } from "next/headers";
import { backendApiOrigin } from "@/lib/backend-origin";

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

type Problem = { detail?: string; code?: string };

export async function platformServerJson<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const origin = backendApiOrigin();
  if (!origin) throw new PlatformNotConfiguredError();

  const cookieStore = await cookies();
  const { idempotencyKey, ...request } = init ?? {};

  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      ...request,
      headers: {
        "content-type": "application/json",
        cookie: cookieStore.toString(),
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
    const problem = (body ?? {}) as Problem;
    throw new PlatformServerError(
      problem.detail ?? `Request failed with status ${response.status}`,
      response.status,
      problem.code,
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
