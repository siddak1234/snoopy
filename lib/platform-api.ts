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
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

export function platformApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PLATFORM_API_BASE_PATH}${normalized}`;
}

export class PlatformApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}

export async function platformApiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(platformApiPath(path), {
    credentials: "same-origin",
    ...init,
  });
  const body = (await response.json().catch(() => null)) as
    { detail?: string } | T | null;
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? body.detail
        : undefined;
    throw new PlatformApiError(
      detail || `Platform request failed with status ${response.status}`,
      response.status,
    );
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
