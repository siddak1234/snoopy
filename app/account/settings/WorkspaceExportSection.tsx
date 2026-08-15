"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import {
  exportServiceLabel,
  isPartialWorkspaceExport,
  type WorkspaceExportResponse,
} from "@/lib/export-contract";
import { requestWorkspaceExport } from "./export-actions";

function downloadExport(response: WorkspaceExportResponse) {
  const file = new Blob([JSON.stringify(response, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `workspace-export-${response.workspaceId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceExportSection() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<WorkspaceExportResponse | null>(
    null,
  );

  const requestExport = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestWorkspaceExport();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResponse(result.response);
    });
  };

  const partial = response ? isPartialWorkspaceExport(response) : false;

  return (
    <section className="border-t border-[var(--ring)] py-5">
      <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
        Workspace data export
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Download the records and references currently available for this
        workspace.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={requestExport}
        >
          {pending ? "Preparing export…" : "Prepare export"}
        </Button>
        {response ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => downloadExport(response)}
          >
            Download JSON
          </Button>
        ) : null}
      </div>
      <FormError message={error} className="mt-3" />

      {response ? (
        <div className="mt-4 space-y-3 text-sm">
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
          <ul className="space-y-1 text-[var(--muted)]">
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
