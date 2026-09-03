import { cookies, headers } from "next/headers";
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
    /** Public, structured details. Callers must whitelist what they render. */
    public readonly details?: Record<string, unknown>,
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

export async function platformServerJson<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const origin = backendApiOrigin();
  if (!origin) throw new PlatformNotConfiguredError();

  const cookieStore = await cookies();
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
        cookie: cookieStore.toString(),
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
