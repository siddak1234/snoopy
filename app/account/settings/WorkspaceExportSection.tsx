"use client";

import { useState, useTransition } from "react";
import { FileActions } from "@/components/dashboard/FileActions";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import {
  exportServiceLabel,
  isPartialWorkspaceExport,
  type WorkspaceExportResponse,
} from "@/lib/export-contract";
import { GROUP_BAND, SPACING } from "@/lib/spacing";
import { CompleteExportSection } from "./CompleteExportSection";
import { requestWorkspaceExport } from "./export-actions";

/** The summary's file: its JSON, under the workspace's name for it. */
function exportFile(response: WorkspaceExportResponse) {
  return {
    filename: `workspace-export-${response.workspaceId}.json`,
    blob: new Blob([JSON.stringify(response, null, 2)], {
      type: "application/json",
    }),
  };
}

function downloadExport(response: WorkspaceExportResponse) {
  const { filename, blob } = exportFile(response);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * `canExport` is the page's reading of the platform's rule — an export is every
 * member's email, every project and every run, so it is an owner's or an
 * admin's (Access's `assertWorkspaceAdministrator`). A member is told who can
 * rather than offered a button the platform would refuse (register F8).
 * Download JSON, then Share, the same JSON file (`FileActions`; the owner's
 * F4 and Q7).
 */
export function WorkspaceExportSection({
  canExport,
  workspaceId,
}: {
  canExport: boolean;
  /** The workspace this page shows; an export of any other is refused. */
  workspaceId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<WorkspaceExportResponse | null>(
    null,
  );

  const requestExport = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestWorkspaceExport(workspaceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResponse(result.response);
    });
  };

  const partial = response ? isPartialWorkspaceExport(response) : false;

  return (
    <section className={`border-t border-[var(--ring)] ${GROUP_BAND}`}>
      <SectionTitle>Workspace data export</SectionTitle>
      <p className={`${SPACING.title.top} text-sm text-[var(--muted)]`}>
        Download a quick summary of this workspace&apos;s records — each part
        bounded to its most recent entries.
      </p>
      {canExport ? (
        <div
          className={`${SPACING.inner.top} flex flex-wrap ${SPACING.inner.gap}`}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={requestExport}
          >
            {pending ? "Preparing export…" : "Prepare export"}
          </Button>
          {response ? (
            <FileActions
              testId="workspace-export-actions"
              downloads={[
                {
                  label: "Download JSON",
                  disabled: pending,
                  run: async () => {
                    downloadExport(response);
                    return null;
                  },
                },
              ]}
              share={{
                filename: exportFile(response).filename,
                contentType: "application/json",
                read: async () => exportFile(response),
              }}
            />
          ) : null}
        </div>
      ) : null}
      {canExport ? (
        <CompleteExportSection workspaceId={workspaceId} />
      ) : (
        <p className={`${SPACING.inner.top} text-sm text-[var(--muted)]`}>
          Exporting a workspace is for its owners and admins, because the export
          holds every member&apos;s email and every department.
        </p>
      )}
      <FormError message={error} className={SPACING.inner.top} />

      {response ? (
        <div
          className={`${SPACING.group.top} flex flex-col ${SPACING.inner.gap} text-sm`}
        >
          <p
            role="status"
            className={
              partial
                ? "text-[var(--warning-text)]"
                : "text-[var(--success-text)]"
            }
          >
            {partial
              ? "This is a partial export. Some records or service sections are unavailable or bounded."
              : "This export is complete."}
          </p>
          <ul className="flex flex-col text-[var(--muted)]">
            {response.services.map((section) => (
              <li key={section.service}>
                {exportServiceLabel(section.service)}:{" "}
                {section.ok ? "included" : section.reason}
                {section.ok && section.data.truncated ? " (bounded)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
