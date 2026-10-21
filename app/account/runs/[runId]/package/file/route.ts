import type { NextRequest } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { createRunPackageFile } from "@/lib/automations";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
  platformSignedFile,
} from "@/lib/platform-server";
import {
  PACKAGE_UNAVAILABLE,
  RUN_PACKAGE_MAXIMUM_BYTES,
  askPackageOnceMore,
} from "@/lib/run-documents";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * A job's run package as a PDF shown in place (Build 24, P12; the owner's
 * build 23 words: the package page shows the package). The platform answers a
 * signed link and never the bytes, and its links save as attachments
 * (backend ADR-0045), so this route — server only, through
 * `lib/platform-server.ts` — asks for the PDF, reads its link here and hands
 * the file on inline: `application/pdf`, `inline`, never cached, framed only
 * by this site, and nothing over the platform's package bound.
 *
 * Asked by the package page's frame, or opened by the person: a request
 * another site started is refused here, since the call it makes is a
 * mutation the platform takes only from this site's origin.
 */

export const dynamic = "force-dynamic";
/**
 * The package's ask (up to 30 s, `RUN_PACKAGE_REQUEST_TIMEOUT_MS`), one wait
 * when the platform is busy, and the file handed on: stated, not left to the
 * host's default.
 */
export const maxDuration = 60;

/** A run id as the platform mints them, or a fixture's: safe in a header. */
const RUN_ID = /^[A-Za-z0-9-]{1,64}$/u;
/** A filename safe in a header: the platform's, every other character made a dash. */
function safeFilename(name: string): string {
  const kept = name.replace(/[^A-Za-z0-9._-]/gu, "-").slice(0, 100);
  return /\.pdf$/u.test(kept) ? kept : "package.pdf";
}

/** An IANA zone's spelling; the platform reads any other as UTC. */
const TIME_ZONE = /^[A-Za-z0-9_+\-/]{1,64}$/u;

const COULD_NOT_SHOW = "Could not open the package. Try again.";

function said(status: number, words: string): Response {
  return new Response(words, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

/**
 * This site's origin, as the page that asked names it — the frame's request
 * carries its page as `Referer` — else as this request reached the site.
 * Forwarded to the platform, which takes a cookie-carrying mutation only from
 * the site's own origin.
 */
function siteOrigin(request: NextRequest): string {
  const host = request.headers.get("host") ?? "";
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const page = new URL(referer);
      if (page.host === host) return page.origin;
    } catch {
      // Not a URL: the request's own origin below.
    }
  }
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol.split(",")[0]!.trim()}://${host}`;
}

export async function GET(
  request: NextRequest,
  context: RouteContext<"/account/runs/[runId]/package/file">,
) {
  const { runId } = await context.params;
  if (!RUN_ID.test(runId)) return said(404, "Not found.");
  // Only this site's pages, or the person opening it themselves — and a
  // request that does not say (every current browser does) is refused too:
  // `siteOrigin` vouches for this site to the platform, so it must not answer
  // a request it cannot place.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== "same-origin" && fetchSite !== "none")
    return said(403, "Open the package from its run.");
  const zone = request.nextUrl.searchParams.get("timeZone");
  const body = {
    format: "pdf" as const,
    ...(zone && TIME_ZONE.test(zone) ? { timeZone: zone } : {}),
  };

  try {
    const workspaceId = await resolveActiveWorkspaceId(await getAppSession());
    if (!workspaceId) return said(404, "Not found.");
    const origin = siteOrigin(request);
    // Busy building others' packages: asked once more after its wait.
    const file = await askPackageOnceMore(
      () => createRunPackageFile(workspaceId, runId, body, origin),
      (error) => (error instanceof PlatformServerError ? error : null),
    );
    if (file.format !== "pdf" || file.sizeBytes > RUN_PACKAGE_MAXIMUM_BYTES)
      return said(413, COULD_NOT_SHOW);
    const pdf = await platformSignedFile(
      file.downloadUrl,
      RUN_PACKAGE_MAXIMUM_BYTES,
    );
    return new Response(pdf.stream, {
      headers: {
        "content-type": "application/pdf",
        // The platform's name for the file: the job's own id (ADR-0044),
        // never the one this address used.
        "content-disposition": `inline; filename="${safeFilename(file.filename)}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "frame-ancestors 'self'",
        ...(pdf.length !== null
          ? { "content-length": String(pdf.length) }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError)
      return said(503, COULD_NOT_SHOW);
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 404) return said(404, "Not found.");
    if (error.status === 409) return said(409, PACKAGE_UNAVAILABLE);
    if (error.status === 401) return said(401, "Sign in again to see it.");
    if (error.status === 413) return said(413, COULD_NOT_SHOW);
    return said(502, COULD_NOT_SHOW);
  }
}
