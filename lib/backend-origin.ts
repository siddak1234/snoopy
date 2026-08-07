/** Parse the only backend location the website is allowed to know. */
export function backendApiOrigin(): string | null {
  const configured = process.env.BACKEND_API_ORIGIN?.trim();
  if (!configured) return null;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("BACKEND_API_ORIGIN must be an absolute URL");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error("BACKEND_API_ORIGIN must contain only an origin");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("BACKEND_API_ORIGIN must use HTTP or HTTPS");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("BACKEND_API_ORIGIN must use HTTPS in production");
  }
  return parsed.origin;
}
