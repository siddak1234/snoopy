"use client";

import { useId, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import type { AutomationRunInputField } from "@/lib/automations";
import { putFileToSignedUrl } from "@/lib/platform-api";
import { completeRunUpload, openRunUpload } from "./upload-actions";

/**
 * A run's file field (backend FR-14, ADR-0030's `artifact` control).
 *
 * Choosing a file uploads it at once: the platform answers a signed URL, the
 * browser PUTs the file there directly — the bytes never pass through the
 * website or the platform's API — and the platform then says what arrived.
 * What the form carries is only the file's id, in the same `input:<key>` field
 * every other control uses, so the run's input is built the one way.
 */
export function RunFileField({
  field,
  subscriptionId,
  onBusyChange,
}: {
  field: AutomationRunInputField;
  subscriptionId: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputId = useId();
  const [state, setState] = useState<
    | { kind: "empty" }
    | { kind: "uploading"; name: string }
    | { kind: "ready"; artifactId: string; name: string; sizeBytes: number }
  >({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    setError(null);
    if (!file) {
      setState({ kind: "empty" });
      return;
    }
    setState({ kind: "uploading", name: file.name });
    onBusyChange(true);
    try {
      const opened = await openRunUpload({
        subscriptionId,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!opened.ok) throw new Error(opened.error);
      await putFileToSignedUrl(opened.ticket.uploadUrl, file);
      const completed = await completeRunUpload(opened.ticket.uploadSessionId);
      if (!completed.ok) throw new Error(completed.error);
      setState({
        kind: "ready",
        artifactId: completed.file.artifactId,
        name: completed.file.filename,
        sizeBytes: completed.file.sizeBytes,
      });
    } catch (failure) {
      setState({ kind: "empty" });
      setError(
        failure instanceof Error
          ? failure.message
          : "The file could not be sent.",
      );
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div>
      <input
        type="hidden"
        name={`input-control:${field.key}`}
        value="artifact"
      />
      {state.kind === "ready" ? (
        <input
          type="hidden"
          name={`input:${field.key}`}
          value={state.artifactId}
        />
      ) : null}
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {field.title}
        {field.required ? null : (
          <span className="ml-1 font-normal text-[var(--muted)]">
            (optional)
          </span>
        )}
      </label>
      <p className="mt-1 text-xs text-[var(--muted)]">{field.description}</p>
      <input
        id={inputId}
        type="file"
        disabled={state.kind === "uploading"}
        onChange={(event) => void choose(event.currentTarget.files?.[0])}
        className="mt-2 block w-full text-sm text-[var(--text)] file:mr-3 file:rounded-lg file:border file:border-[var(--ring)] file:bg-[var(--card)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--text)]"
      />
      <p aria-live="polite" className="mt-1 text-xs text-[var(--muted)]">
        {state.kind === "uploading"
          ? `Uploading ${state.name}…`
          : state.kind === "ready"
            ? `Ready: ${state.name} (${formatSize(state.sizeBytes)})`
            : null}
      </p>
      <FormError message={error} className="mt-1 text-xs" />
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
