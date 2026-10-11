"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { AutomationRunInputField } from "@/lib/automations";
import { putFileToSignedUrl } from "@/lib/platform-api";
import {
  NOT_A_RUN_FILE,
  RUN_FILE_ACCEPT,
  jpegName,
  planRunFile,
  reencodeImage,
  type RunFileSource,
} from "./run-file-image";
import { completeRunUpload, openRunUpload } from "./upload-actions";

/**
 * A phone or a tablet: its primary pointer is a finger, "a pointing device of
 * limited accuracy" (MDN, `pointer`). A computer's primary pointer is a mouse or
 * a trackpad even when it has a touchscreen as well — that is `any-pointer` —
 * and a computer's browser ignores `capture`, so Take photo there would open
 * the same file picker as the chooser. A media query, not the user agent:
 * Safari on an iPad presents itself as a Mac.
 */
const PHONE_OR_TABLET = "(pointer: coarse)";

function watchPointer(changed: () => void) {
  const query = window.matchMedia(PHONE_OR_TABLET);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}

const onPhoneOrTablet = () => window.matchMedia(PHONE_OR_TABLET).matches;
// The server cannot know; the field is drawn only in a dialog a click opens.
const unknownOnServer = () => false;

/**
 * A run's file field (backend FR-14, ADR-0030's `artifact` control).
 *
 * Choosing a file uploads it at once: the platform answers a signed URL, the
 * browser PUTs the file there directly — the bytes never pass through the
 * website or the platform's API — and the platform then says what arrived.
 * What the form carries is only the file's id, in the same `input:<key>` field
 * every other control uses, so the run's input is built the one way.
 *
 * What is sent is `run-file-image.ts`'s (backend BUILD-PLAN 25.8.5, the owner's
 * decision 8 of 2026-10-10), as the app sends it: a PDF as it is; a JPEG or a
 * PNG, and every photo, drawn upright and saved as a JPEG whose long side is at
 * most 2,576 px; anything else refused in words before anything is sent. On a
 * phone or a tablet the field also offers Take photo, the camera.
 *
 * An upload belongs to the field that started it: its busy state is reported
 * under the field's key, it stops when the field goes (the form closed), and an
 * answer that arrives for one no longer in flight changes nothing.
 */
export function RunFileField({
  field,
  workspaceId,
  subscriptionId,
  onBusyChange,
}: {
  field: AutomationRunInputField;
  /** The workspace the page showed; the upload is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  onBusyChange: (key: string, busy: boolean) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const offersCamera = useSyncExternalStore(
    watchPointer,
    onPhoneOrTablet,
    unknownOnServer,
  );
  const inFlight = useRef<AbortController | null>(null);
  const report = useRef(onBusyChange);
  useEffect(() => {
    report.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(() => {
    const key = field.key;
    return () => {
      const upload = inFlight.current;
      if (!upload) return;
      inFlight.current = null;
      upload.abort();
      report.current(key, false);
    };
  }, [field.key]);
  const [state, setState] = useState<
    | { kind: "empty" }
    | { kind: "uploading"; name: string }
    | { kind: "ready"; artifactId: string; name: string; sizeBytes: number }
  >({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);

  const choose = async (chosen: File | undefined, source: RunFileSource) => {
    setError(null);
    if (!chosen) {
      setState({ kind: "empty" });
      return;
    }
    // A photo takes the chooser's place, so the chooser no longer names a
    // file the field does not hold.
    if (source === "camera" && input.current) input.current.value = "";
    const plan = planRunFile(chosen.type, source);
    inFlight.current?.abort();
    if (plan === "refuse") {
      // Refused here, before anything is sent: the platform refuses it too,
      // only later. Like any new choice, it ends the upload it replaces.
      if (inFlight.current) {
        inFlight.current = null;
        onBusyChange(field.key, false);
      }
      setState({ kind: "empty" });
      if (input.current) input.current.value = "";
      setError(NOT_A_RUN_FILE);
      return;
    }
    const upload = new AbortController();
    inFlight.current = upload;
    setState({
      kind: "uploading",
      name: plan === "re-encode" ? jpegName(chosen.name) : chosen.name,
    });
    onBusyChange(field.key, true);
    try {
      // Drawn and saved before the platform is asked, so the size it signs
      // is the size of what is sent.
      const file = plan === "re-encode" ? await reencodeImage(chosen) : chosen;
      if (upload.signal.aborted) return;
      const opened = await openRunUpload({
        workspaceId,
        subscriptionId,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (upload.signal.aborted) return;
      if (!opened.ok) throw new Error(opened.error);
      await putFileToSignedUrl(opened.ticket.uploadUrl, file, upload.signal);
      const completed = await completeRunUpload(
        workspaceId,
        opened.ticket.uploadSessionId,
      );
      if (upload.signal.aborted) return;
      if (!completed.ok) throw new Error(completed.error);
      setState({
        kind: "ready",
        artifactId: completed.file.artifactId,
        name: completed.file.filename,
        sizeBytes: completed.file.sizeBytes,
      });
    } catch (failure) {
      if (upload.signal.aborted) return;
      setState({ kind: "empty" });
      // Emptied, so choosing the same file again is a change the browser
      // reports — as "Choose it again" asks.
      if (input.current) input.current.value = "";
      setError(
        failure instanceof Error
          ? failure.message
          : "The file could not be sent.",
      );
    } finally {
      if (inFlight.current === upload) {
        inFlight.current = null;
        onBusyChange(field.key, false);
      }
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
        ref={input}
        id={inputId}
        type="file"
        accept={RUN_FILE_ACCEPT}
        disabled={state.kind === "uploading"}
        onChange={(event) =>
          void choose(event.currentTarget.files?.[0], "chooser")
        }
        className="mt-2 block w-full text-sm text-[var(--text)] file:mr-3 file:rounded-lg file:border file:border-[var(--ring)] file:bg-[var(--card)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--text)]"
      />
      {offersCamera ? (
        <>
          {/* The camera, opened by Take photo: a file input styled
              `display:none` and opened by its click(), as MDN describes. It
              has no name, so the form never carries it — only the file's id. */}
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={state.kind === "uploading"}
            onChange={(event) => {
              const photo = event.currentTarget.files?.[0];
              // Emptied at once: every photo is a new choice. Closing the
              // camera keeps whatever the field already held.
              event.currentTarget.value = "";
              if (photo) void choose(photo, "camera");
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={state.kind === "uploading"}
            onClick={() => camera.current?.click()}
          >
            Take photo<span className="sr-only"> for {field.title}</span>
          </Button>
        </>
      ) : null}
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
