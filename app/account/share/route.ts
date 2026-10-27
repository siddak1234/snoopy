import type { NextRequest } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { createRunPackageFile } from "@/lib/automations";
import { readWorkspaceExport } from "@/lib/exports";
import { askedHere, safeFilename, said, siteOrigin } from "@/lib/file-view";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
  platformSignedFile,
} from "@/lib/platform-server";
import {
  RUN_PACKAGE_MAXIMUM_BYTES,
  askPackageOnceMore,
} from "@/lib/run-documents";
import { SHARE_FAILED } from "@/lib/run-files";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * A document's bytes for the share sheet (the owner's F4 and Q7: Download,
 * then Share, on every document). The platform's links to a run package's
 * files and to the complete export are signed, short-lived and on another
 * origin, and always save as attachments, so the browser cannot read them;
 * and Share sends the file itself, never its link. So this route — server
 * only, through `lib/platform-server.ts` — asks for the file as Download
 * does, reads its signed link here and hands the bytes on to this site's
 * own page: `?run={id}&format=pdf|xlsx` (the package's documents, in the
 * browser's `timeZone`) or `?export={id}` (the complete export). Like the
 * file pages' route (`lib/file-view.ts`): only this site's pages ask
 * (`Sec-Fetch-Site`), never cached, `nosniff`, nothing over the bound — and
 * always an attachment of no type, so nothing in it runs on this origin. The
 * browser reads it with `siteFileNamed`, which reads `/account/` paths only.
 */

export const dynamic = "force-dynamic";
/** A package's ask (up to 30 s), one wait when the platform is busy, and the file handed on. */
export const maxDuration = 60;

/** An id as the platform mints them, or a fixture's: safe in a path. */
const ID = /^[A-Za-z0-9-]{1,64}$/u;
/** An IANA zone's spelling; the platform reads any other as UTC. */
const TIME_ZONE = /^[A-Za-z0-9_+\-/]{1,64}$/u;
const FORMATS = new Set(["pdf", "xlsx"]);

/** The file's bytes, as an attachment of no type, under its platform name. */
async function handOn(url: string, filename: string): Promise<Response> {
  const body = await platformSignedFile(url, RUN_PACKAGE_MAXIMUM_BYTES);
  return new Response(body.stream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${safeFilename(filename)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(body.length !== null
        ? { "content-length": String(body.length) }
        : {}),
    },
  });
}

export async function GET(request: NextRequest) {
  if (!askedHere(request)) return said(403, "Share the file from its page.");
  const query = request.nextUrl.searchParams;
  const runId = query.get("run");
  const format = query.get("format");
  const exportId = query.get("export");
  const forRun = runId !== null && ID.test(runId) && FORMATS.has(format ?? "");
  const forExport = exportId !== null && ID.test(exportId);
  if (forRun === forExport) return said(404, "Not found.");

  try {
    const workspaceId = await resolveActiveWorkspaceId(await getAppSession());
    if (!workspaceId) return said(404, "Not found.");
    if (forExport) {
      const job = await readWorkspaceExport(workspaceId, exportId!);
      if (job.status !== "ready" || !job.file) return said(404, "Not found.");
      if (job.file.sizeBytes > RUN_PACKAGE_MAXIMUM_BYTES)
        return said(413, SHARE_FAILED);
      return await handOn(job.file.downloadUrl, job.file.filename);
    }
    const zone = query.get("timeZone");
    const body = {
      format: format as "pdf" | "xlsx",
      ...(zone && TIME_ZONE.test(zone) ? { timeZone: zone } : {}),
    };
    const origin = siteOrigin(request);
    const file = await askPackageOnceMore(
      () => createRunPackageFile(workspaceId, runId!, body, origin),
      (error) => (error instanceof PlatformServerError ? error : null),
    );
    if (file.sizeBytes > RUN_PACKAGE_MAXIMUM_BYTES)
      return said(413, SHARE_FAILED);
    return await handOn(file.downloadUrl, file.filename);
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError)
      return said(503, SHARE_FAILED);
    if (!(error instanceof PlatformServerError)) throw error;
    if (error.status === 404) return said(404, "Not found.");
    if (error.status === 401) return said(401, "Sign in again to share it.");
    if (error.status === 413) return said(413, SHARE_FAILED);
    return said(502, SHARE_FAILED);
  }
}
