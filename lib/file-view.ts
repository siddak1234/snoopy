import type { NextRequest } from "next/server";
import { getAppSession } from "@/lib/app-session";
import type { RunFileLink } from "@/lib/automations";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
  platformSignedFile,
} from "@/lib/platform-server";
import { RUN_FILE_MAXIMUM_BYTES, shownInPlace } from "@/lib/run-files";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * A run's or an item's uploaded file, handed on by this site (Round 19, build
 * 28; the owner's items 4 and 7): the platform answers a short-lived signed
 * link whose file saves as an attachment (`readRunFile`, `readItemFile`), so a
 * file page's own view route (`app/account/runs/[runId]/files/[fileId]/view/route.ts`, the item's alike) reads the link and the file here, on the
 * server, as the run package's route does (`platformSignedFile`). A PDF, a
 * JPEG or a PNG goes on `inline` in its own type, framed by this site alone;
 * any other type as `application/octet-stream`, an attachment, so nothing an
 * upload holds runs on this origin. Never cached, `nosniff`, nothing over the
 * bound. Only this site's own pages, or the person opening it, ask
 * (`Sec-Fetch-Site`); the share sheet reads it the same way
 * (`siteFileBlob`).
 */

const COULD_NOT_SHOW = "Could not open the file. Try again.";

function said(status: number, words: string): Response {
  return new Response(words, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

/** A filename safe in a header: the platform's, every other character made a dash. */
function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/gu, "-").slice(0, 100) || "file";
}

export async function fileViewResponse(
  request: NextRequest,
  read: (workspaceId: string) => Promise<RunFileLink>,
): Promise<Response> {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== "same-origin" && fetchSite !== "none")
    return said(403, "Open the file from its page.");
  try {
    const workspaceId = await resolveActiveWorkspaceId(await getAppSession());
    if (!workspaceId) return said(404, "Not found.");
    const { file, downloadUrl } = await read(workspaceId);
    if (file.sizeBytes > RUN_FILE_MAXIMUM_BYTES)
      return said(413, COULD_NOT_SHOW);
    const body = await platformSignedFile(downloadUrl, RUN_FILE_MAXIMUM_BYTES);
    const inPlace = shownInPlace(file.contentType);
    return new Response(body.stream, {
      headers: {
        "content-type": inPlace
          ? file.contentType.toLowerCase()
          : "application/octet-stream",
        "content-disposition": `${inPlace ? "inline" : "attachment"}; filename="${safeFilename(file.filename)}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "frame-ancestors 'self'",
        ...(body.length !== null
          ? { "content-length": String(body.length) }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError)
      return said(503, COULD_NOT_SHOW);
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 404) return said(404, "Not found.");
    if (error.status === 401) return said(401, "Sign in again to see it.");
    if (error.status === 413) return said(413, COULD_NOT_SHOW);
    return said(502, COULD_NOT_SHOW);
  }
}
