"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { CameraIcon } from "@phosphor-icons/react/dist/ssr/Camera";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { AutomationRunInputField } from "@/lib/automations";
import { putFileToSignedUrl } from "@/lib/platform-api";
import {
  fileAccept,
  jpegName,
  notAcceptedLine,
  planRunFile,
  reencodeImage,
  takesPhotos,
  typesInWords,
  type RunFileSource,
} from "./run-file-image";
import { completeRunUpload, openRunUpload } from "./upload-actions";
import { completeWhenMeasured } from "./upload-completion";
import { SPACING } from "@/lib/spacing";
import {
  DEFAULT_MAX_FILES,
  SEVERAL_FILES,
  filesSelected,
  tooManyFiles,
} from "@/lib/several-files";

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
// The server cannot know: Take photo is drawn once the browser says it is a
// phone or a tablet.
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
 * most 2,576 px; anything else refused in words before anything is sent. A
 * field that names its types (`acceptedContentTypes`, backend ADR-0046) offers
 * those, sends a Word file as it is, and offers Take photo only where a JPEG
 * is taken. The file is chosen with Upload; on a phone or a tablet the field
 * also offers Take photo, the camera (spec §3.D: icons 20 inside a button).
 * With `showTypes`, the accepted types in words beside it ("PDF, Word file or
 * photo"), as an item's file and its runs' show them (plan §5.2, §5.3).
 *
 * **Several** (`multiple`, platform round 2's B2 as the batch addendum
 * amends it): the chooser takes several files at once and replaces what the
 * field held; each photo the camera takes is added to it. Each file is sent
 * as one alone is, one after another; the field then says "{n} files
 * selected" (one file, its "Ready:" line), and posts each file's id under its
 * key with the control `artifact-multiple`, every one into ONE run. More than
 * the field's `maxFiles` (absent, the platform's 50): "Add up to {max} files
 * at a time.", and nothing is sent — a choice past it empties the field, a
 * photo past it keeps the files held; a file refused, or one that fails,
 * empties the field as one alone does.
 *
 * **Compact** (`compact`, Home's YOUR FLOWS card only; the owner's build 42,
 * item 16: "Maybe we dont need the clip icon and document/resume in there"):
 * the title's `<label>` is `sr-only` — the chooser keeps its name, and Take
 * photo and Upload keep theirs, " for {title}" — the button row has no
 * margin above it and puts `trailing` (the card's Start) right after
 * Upload, before a job flow's accepted types, and the
 * uploading or ready line and the error take their margin only once they
 * say something, so nothing stands empty under the row before a pick.
 * ~~The visible title over the buttons, and the line's margin always~~ until
 * build 42, on Home's card; everywhere else the field is drawn as before.
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
  showTypes = false,
  compact = false,
  trailing,
}: {
  field: AutomationRunInputField;
  /** The workspace the page showed; the upload is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  onBusyChange: (key: string, busy: boolean) => void;
  /** Say the accepted types beside the button (an item's file, and its runs'). */
  showTypes?: boolean;
  /** Home's card: the title for screen readers only, no empty gaps. */
  compact?: boolean;
  /** At the end of the button row (Home's card: its Start). */
  trailing?: ReactNode;
}) {
  const inputId = useId();
  const typesId = useId();
  const accepted = field.acceptedContentTypes;
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const offersCamera =
    useSyncExternalStore(watchPointer, onPhoneOrTablet, unknownOnServer) &&
    takesPhotos(accepted);
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
  const several = field.multiple === true;
  const maxFiles = field.maxFiles ?? DEFAULT_MAX_FILES;
  const [state, setState] = useState<
    | { kind: "empty" }
    | { kind: "uploading"; name: string }
    | { kind: "ready"; artifactId: string; name: string; sizeBytes: number }
    | { kind: "several"; files: SentFile[] }
  >({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);

  // One file sent: the platform's signed URL, the PUT, then completed —
  // nothing (`undefined`) once the upload it belongs to was aborted.
  const sendFile = async (
    file: File,
    upload: AbortController,
  ): Promise<SentFile | undefined> => {
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
    // A file with no place yet to be measured is completed again by itself
    // (`upload-completion.ts`), the field still uploading meanwhile.
    const { uploadSessionId } = opened.ticket;
    const completed = await completeWhenMeasured(
      () => completeRunUpload(workspaceId, uploadSessionId),
      upload.signal,
    );
    if (upload.signal.aborted) return;
    if (!completed.ok) throw new Error(completed.error);
    return {
      artifactId: completed.file.artifactId,
      name: completed.file.filename,
      sizeBytes: completed.file.sizeBytes,
    };
  };

  const choose = async (chosen: File | undefined, source: RunFileSource) => {
    setError(null);
    if (!chosen) {
      setState({ kind: "empty" });
      return;
    }
    // A photo takes the chooser's place, so the chooser no longer names a
    // file the field does not hold.
    if (source === "camera" && input.current) input.current.value = "";
    const plan = planRunFile(chosen.type, source, accepted);
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
      setError(notAcceptedLine(accepted));
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
      const sent = await sendFile(file, upload);
      if (!sent) return;
      setState({ kind: "ready", ...sent });
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

  // The files the field holds: one alone (`ready`), or several.
  const files: readonly SentFile[] =
    state.kind === "several"
      ? state.files
      : state.kind === "ready"
        ? [state]
        : [];

  // Several files: each sent as one alone is, one after another, under the
  // one in-flight upload.
  const chooseSeveral = async (
    chosen: readonly File[],
    source: RunFileSource,
  ) => {
    setError(null);
    // A photo is added to the files held; a choice replaces them.
    const kept = source === "camera" ? files : [];
    if (chosen.length === 0) {
      if (source === "chooser") setState({ kind: "empty" });
      return;
    }
    const empty = (message: string) => {
      setState({ kind: "empty" });
      if (input.current) input.current.value = "";
      setError(message);
    };
    // More than the field takes: nothing is sent; a photo past it keeps the files held.
    if (kept.length + chosen.length > maxFiles) {
      if (source === "camera") setError(tooManyFiles(maxFiles));
      else empty(tooManyFiles(maxFiles));
      return;
    }
    const plans = chosen.map((file) =>
      planRunFile(file.type, source, accepted),
    );
    inFlight.current?.abort();
    if (plans.includes("refuse")) {
      if (inFlight.current) {
        inFlight.current = null;
        onBusyChange(field.key, false);
      }
      empty(notAcceptedLine(accepted));
      return;
    }
    const upload = new AbortController();
    inFlight.current = upload;
    onBusyChange(field.key, true);
    const sent: SentFile[] = [...kept];
    try {
      for (const [at, chosenFile] of chosen.entries()) {
        const plan = plans[at];
        setState({
          kind: "uploading",
          name:
            plan === "re-encode" ? jpegName(chosenFile.name) : chosenFile.name,
        });
        const file =
          plan === "re-encode" ? await reencodeImage(chosenFile) : chosenFile;
        if (upload.signal.aborted) return;
        const one = await sendFile(file, upload);
        if (!one) return;
        sent.push(one);
      }
      setState({ kind: "several", files: sent });
    } catch (failure) {
      if (upload.signal.aborted) return;
      empty(
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

  const status =
    state.kind === "uploading"
      ? `Uploading ${state.name}…`
      : files.length === 1
        ? `Ready: ${files[0]!.name} (${formatSize(files[0]!.sizeBytes)})`
        : files.length > 1
          ? filesSelected(files.length)
          : null;
  // Off Home's card a line's margin is always there, as before.
  const lineTop = compact && !status ? "" : `${SPACING.inner.top} `;

  return (
    <div>
      <input
        type="hidden"
        name={`input-control:${field.key}`}
        value={several ? SEVERAL_FILES : "artifact"}
      />
      {files.map((file) => (
        <input
          key={file.artifactId}
          type="hidden"
          name={`input:${field.key}`}
          value={file.artifactId}
        />
      ))}
      {/* The manifest's title alone (spec A6, Step 1: titles only — no line
          under it, Build 21); a file field says nothing about being
          optional. */}
      <label
        htmlFor={inputId}
        className={
          compact ? "sr-only" : "block text-sm font-medium text-[var(--text)]"
        }
      >
        {field.title}
      </label>
      {/* The chooser, opened by Upload: a file input styled `display:none`
          and opened by its click(), as MDN describes. */}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={fileAccept(accepted)}
        multiple={several}
        hidden
        disabled={state.kind === "uploading"}
        onChange={(event) =>
          several
            ? void chooseSeveral(
                Array.from(event.currentTarget.files ?? []),
                "chooser",
              )
            : void choose(event.currentTarget.files?.[0], "chooser")
        }
      />
      <div
        className={`${compact ? "" : `${SPACING.inner.top} `}flex flex-wrap items-center ${SPACING.inner.gap}`}
      >
        {offersCamera ? (
          <>
            {/* The camera, opened by Take photo, as the chooser is. It has
                no name, so the form never carries it — only the file's id. */}
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              multiple={several}
              disabled={state.kind === "uploading"}
              onChange={(event) => {
                const photos = Array.from(event.currentTarget.files ?? []);
                // Emptied at once: every photo is a new choice. Closing the
                // camera keeps whatever the field already held.
                event.currentTarget.value = "";
                if (several) {
                  if (photos.length > 0) void chooseSeveral(photos, "camera");
                } else if (photos[0]) void choose(photos[0], "camera");
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className={`inline-flex items-center ${SPACING.inner.gap}`}
              disabled={state.kind === "uploading"}
              onClick={() => camera.current?.click()}
            >
              <CameraIcon size={20} aria-hidden />
              Take photo<span className="sr-only"> for {field.title}</span>
            </Button>
          </>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className={`inline-flex items-center ${SPACING.inner.gap}`}
          disabled={state.kind === "uploading"}
          onClick={() => input.current?.click()}
          aria-describedby={showTypes ? typesId : undefined}
        >
          <UploadSimpleIcon size={20} aria-hidden />
          Upload<span className="sr-only"> for {field.title}</span>
        </Button>
        {trailing}
        {showTypes ? (
          <span id={typesId} className="text-xs text-[var(--muted)]">
            {typesInWords(accepted)}
          </span>
        ) : null}
      </div>
      <p aria-live="polite" className={`${lineTop}text-xs text-[var(--muted)]`}>
        {status}
      </p>
      <FormError message={error} className={`${SPACING.inner.top} text-xs`} />
    </div>
  );
}

/** A file sent, as the field holds it. */
type SentFile = { artifactId: string; name: string; sizeBytes: number };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
