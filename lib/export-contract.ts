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
