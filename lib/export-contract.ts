import type {
  components,
  operations,
} from "./generated/platform-contracts/platform";

export type WorkspaceExportResponse =
  components["schemas"]["WorkspaceExportResponse"];
export type WorkspaceExportServiceResult =
  components["schemas"]["WorkspaceExportServiceResult"];
export type ExportWorkspaceResponse =
  operations["exportWorkspace"]["responses"][200]["content"]["application/json"];
/** A complete export (backend §12.1 #39), in parts since §12.1 #181. */
export type WorkspaceExportJob = components["schemas"]["WorkspaceExportJob"];
export type WorkspaceExportFile = components["schemas"]["WorkspaceExportFile"];

/** Settings' line over the complete export (backend §12.1 #181). */
export const COMPLETE_EXPORT_INTRO =
  "Or export every record. A large workspace comes as several files, each kept for a day.";

/**
 * A ready export's files, in order (backend §12.1 #181): its `files`, else
 * the one `file` a platform from before parts sends, else none.
 */
export function exportFiles(job: WorkspaceExportJob): WorkspaceExportFile[] {
  if (job.files && job.files.length > 0) return job.files;
  return job.file ? [job.file] : [];
}

/** A file's button: "Download file" for the one, "Download file {n} of {N}" among several. */
export function downloadFileLabel(n: number, count: number): string {
  return count > 1 ? `Download file ${n} of ${count}` : "Download file";
}
export type WorkspaceExportJobResponse =
  components["schemas"]["WorkspaceExportJobResponse"];

/**
 * The server calculates `complete`, but the UI also sees each typed section.
 * Preserve the honest partial state if a future server response ever disagrees
 * with its own aggregate because a successful section is marked truncated.
 */
export function isPartialWorkspaceExport(
  response: WorkspaceExportResponse,
): boolean {
  return (
    !response.complete ||
    response.services.some(
      (section) => section.ok && section.data.truncated === true,
    )
  );
}

export function exportServiceLabel(
  service: WorkspaceExportServiceResult["service"],
): string {
  return service.charAt(0).toUpperCase() + service.slice(1);
}
