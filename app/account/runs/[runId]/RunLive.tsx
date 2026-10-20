"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleDashedIcon } from "@phosphor-icons/react/dist/ssr/CircleDashed";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/ssr/FlowArrow";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { MinusCircleIcon } from "@phosphor-icons/react/dist/ssr/MinusCircle";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { ApprovalDecision } from "@/app/account/approvals/ApprovalDecision";
import type {
  Approval,
  CreateRunPackageFileRequest,
  RunDetail,
  RunOrigin,
  RunPackageFile,
} from "@/lib/automations";
import { formatDateTimeMediumUTC as formatWhen } from "@/lib/date";
import { flowPath } from "@/lib/flow-steps";
import { PlatformApiError, platformApiJson } from "@/lib/platform-api";
import {
  DOCUMENT_MORE_LINES,
  DOWNLOAD_EXCEL,
  DOWNLOAD_FAILED,
  DOWNLOAD_PDF,
  VIEW_PACKAGE,
  packageAvailable,
  packageFileHref,
  packageRetryWaitMs,
  toDocumentCards,
  type DocumentCardView,
  type DocumentRowView,
} from "@/lib/run-documents";
import {
  RUN_REREAD_MS,
  heldDecision,
  runDuration,
  runLabel,
  runResultLine,
  stepsDone,
  trackerRows,
  type DeclaredStep,
  type ProgressGroup,
  type TrackerFlow,
  type TrackerRow,
  type TrackerState,
} from "@/lib/run-progress";
import { CancelRunButton } from "./CancelRunButton";

// Every origin the contract names, so a run says how it started. A new origin
// fails the build here rather than reading as a manual start.
const ORIGIN_LABEL: Record<RunOrigin, string> = {
  trigger: "Triggered",
  manual: "Manual",
  "approval-continuation": "After approval",
  "retry-continuation": "After retry",
};

/**
 * The flow a run belongs to, as the catalog lists it — its name, steps and
 * groups, the newest version's — and, when the flow could be read, its step
 * titles and setting lines as its settings make them now (Build 22, S23).
 */
export type RunFlow = {
  name: string;
  pipeline: DeclaredStep[];
  groups?: ProgressGroup[];
  tracker?: TrackerFlow;
} | null;

/**
 * A held job's approval while it waits, and whether this person may decide it
 * — the approval's eligible roles against their role, as Approvals reads it.
 */
export type RunDecision = { approval: Approval; canDecide: boolean } | null;

/**
 * One run, live (Build 21, spec A7; the owner's build 20 item 10: "It shoukd
 * show all the steps and a live tracker of which ones are done"): its full id
 * and status; how it went; Duration and Steps done; every step from the start,
 * each where the run is — a held step with Approve and Deny under it (Build 24,
 * P6); each document it read on a card of its own; the facts; View package,
 * Download PDF and Download Excel once the job can be packaged (Build 24,
 * P12; ~~Download JSON~~ until then); Cancel run while it goes on, and View
 * flow. Read
 * again every 2 s while the run is pending or running (`RUN_REREAD_MS`),
 * through `/api/platform`, one read at a time; the page as the server drew it
 * comes back whenever it is drawn again (a cancel or a decision revalidates
 * it).
 */
export function RunLive({
  workspaceId,
  initial,
  flow,
  approvals,
  decision,
}: {
  workspaceId: string;
  initial: RunDetail;
  flow: RunFlow;
  /** A held job's approvals, read once: what became of them. */
  approvals: Approval[];
  /** Its approval while it waits: step 4's Approve and Deny. */
  decision: RunDecision;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again (a cancel, a refresh): its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setDetail(initial);
  }
  const [reads, setReads] = useState(0);
  const { run, steps, details, documents } = detail;
  const going = run.status === "pending" || run.status === "running";

  useEffect(() => {
    if (!going) return;
    let live = true;
    const timer = setTimeout(() => {
      platformApiJson<RunDetail>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(run.id)}`,
      )
        .then((answer) => {
          if (live) setDetail(answer);
        })
        // A read that fails leaves the page as it was; the next one may answer.
        .catch(() => undefined)
        .finally(() => {
          if (live) setReads((count) => count + 1);
        });
    }, RUN_REREAD_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [going, reads, workspaceId, run.id]);

  // Every step from the start (spec A7; S14): by the catalog's groups, the
  // newest version's, for any run whose every reported step they still
  // declare (Build 22, the session's S25: a v3 run is drawn by v4's five
  // steps); a run that reported a step they no longer declare is drawn by the
  // steps it reported. ~~Only a run of the catalog's own version drawn by its
  // groups~~ until Build 22. Step 2 says the flow's integration, step 4's title
  // follows it, step 5 is the run's email.
  const decided = heldDecision(run, approvals);
  const tracker = trackerRows(
    steps,
    flow?.pipeline,
    flow?.groups,
    run,
    undefined,
    flow?.pipeline,
    { flow: flow?.tracker, email: detail.email, decision: decided },
  );
  const cards = toDocumentCards(
    documents,
    decided === "rejected"
      ? "rejected"
      : decided === "closed"
        ? "expired"
        : null,
    detail.files,
  );
  const result = runResultLine(run, approvals);
  const facts = [
    {
      label: "Started",
      value: run.startedAt ? formatWhen(run.startedAt) : "—",
    },
    { label: "Ended", value: run.endedAt ? formatWhen(run.endedAt) : "—" },
    { label: "Trigger", value: ORIGIN_LABEL[run.origin] },
    { label: "Run ID", value: run.id },
  ];

  return (
    <SectionCard
      title={runLabel(run.id)}
      subheader={flow?.name ?? run.templateId}
      back={<BackLink href="/account/runs" />}
      primaryAction={<StatusPill status={run.status} />}
    >
      <div className="py-5 first:pt-0">
        {/* How it went, on a line of its own, in the automation's words. */}
        {result ? (
          <p
            data-testid="run-result"
            {...(run.status === "failed" ? { role: "alert" } : {})}
            className={`text-sm ${RESULT_TONE[run.status] ?? "text-[var(--text)]"}`}
          >
            {result}
          </p>
        ) : null}
        <dl
          className={`grid grid-cols-2 gap-3 sm:max-w-sm ${result ? "mt-4" : ""}`}
        >
          <Tile
            label="Duration"
            value={runDuration(run.startedAt, run.endedAt)}
          />
          <Tile label="Steps done" value={stepsDone(tracker)} />
        </dl>
      </div>

      <section aria-labelledby="run-steps-title" className="py-5">
        <h2
          id="run-steps-title"
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          Steps
        </h2>
        <ol data-testid="run-steps" className="mt-4 flex flex-col gap-4">
          {tracker.map((row) => (
            <TrackerItem key={row.key} row={row}>
              {/* The decision where the job waits (Build 24, P6): one press,
                  then the page is drawn again — running on, or Denied */}
              {row.state === "held" &&
              decided === "pending" &&
              decision?.approval.status === "pending" ? (
                <ApprovalDecision
                  approvalId={decision.approval.id}
                  canDecide={decision.canDecide}
                  eligibleRoles={decision.approval.eligibleRoles}
                  workspaceId={workspaceId}
                  onDecision={(_, state) => {
                    if (state === "saved") router.refresh();
                  }}
                />
              ) : null}
            </TrackerItem>
          ))}
        </ol>
      </section>

      {cards.length > 0 ? (
        <section aria-labelledby="run-documents-title" className="py-5">
          <h2
            id="run-documents-title"
            className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
          >
            Documents
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {cards.map((card) => (
              <DocumentCard key={card.index} card={card} />
            ))}
          </div>
        </section>
      ) : details && details.length > 0 ? (
        // What a v1/v2 run saved, as its automation wrote it for people
        // (backend ADR-0037) — drawn only where no documents are.
        <section aria-labelledby="run-details-title" className="py-5">
          <h2
            id="run-details-title"
            className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
          >
            Details
          </h2>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
            {details.map((line, index) => (
              <div key={`${line.label}-${index}`} className="contents">
                <dt className="text-sm text-[var(--muted)]">{line.label}</dt>
                <dd className="text-sm break-words text-[var(--text)]">
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div className="py-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs text-[var(--muted)]">{fact.label}</dt>
              <dd
                data-testid={`run-fact-${fact.label}`}
                className="mt-0.5 text-sm break-all text-[var(--text)] select-all"
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {packageAvailable(run.status, documents) ? (
            <PackageActions workspaceId={workspaceId} runId={run.id} view />
          ) : null}
          {/* Only the two states the platform cancels; any other answers 404. */}
          {going ? (
            <CancelRunButton runId={run.id} workspaceId={run.workspaceId} />
          ) : null}
          <Button
            href={flowPath(run.subscriptionId)}
            variant="secondary"
            size="sm"
            prefetch={false}
            className="inline-flex items-center gap-2"
          >
            <FlowArrowIcon size={20} aria-hidden />
            View flow
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

type PackageFormat = CreateRunPackageFileRequest["format"];

/** The browser's IANA zone, for the times a package file prints; "" when it names none. */
function browserTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && zone.length <= 64 ? zone : "";
}

/**
 * A job's package file behind its signed link (Build 24, P12; backend
 * `createRunPackageFile`), asked through `/api/platform` in the browser's
 * zone. Each request carries its own key — a replay could only answer the
 * same link, and a fresh one never meets a refusal kept under the last. The
 * platform busy building others (503) is asked once more after its
 * `retry-after`; then the refusal is the caller's.
 */
async function createPackageFile(
  workspaceId: string,
  runId: string,
  format: PackageFormat,
): Promise<RunPackageFile> {
  const zone = browserTimeZone();
  const body: CreateRunPackageFileRequest = {
    format,
    ...(zone ? { timeZone: zone } : {}),
  };
  const ask = () =>
    platformApiJson<RunPackageFile>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(runId)}/package`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `run-package-${format}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify(body),
      },
    );
  try {
    return await ask();
  } catch (error) {
    const wait =
      error instanceof PlatformApiError && error.status === 503
        ? packageRetryWaitMs(error.retryAfterSeconds)
        : null;
    if (wait === null) throw error;
    await new Promise((resolve) => setTimeout(resolve, wait));
    return ask();
  }
}

/**
 * The run package's buttons (Build 24, P12; the owner's build 23 words): View
 * package — on the run page — and Download PDF and Download Excel, on both. A
 * download goes to the file's signed link, which saves it (an attachment; no
 * page is left and nothing crosses origins); a refusal is said under the row.
 */
export function PackageActions({
  workspaceId,
  runId,
  view,
}: {
  workspaceId: string;
  runId: string;
  /** Whether to offer View package too: the run page's row. */
  view: boolean;
}) {
  const [busy, setBusy] = useState<PackageFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const download = async (format: PackageFormat) => {
    if (busy) return;
    setBusy(format);
    setError(null);
    try {
      const file = await createPackageFile(workspaceId, runId, format);
      window.location.assign(file.downloadUrl);
    } catch {
      setError(DOWNLOAD_FAILED);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {view ? (
        <Button
          href={`/account/runs/${encodeURIComponent(runId)}/package`}
          variant="secondary"
          size="sm"
          prefetch={false}
          className="inline-flex items-center gap-2"
        >
          <FileTextIcon size={20} aria-hidden />
          {VIEW_PACKAGE}
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        disabled={busy !== null}
        onClick={() => void download("pdf")}
        className="inline-flex items-center gap-2"
      >
        <DownloadSimpleIcon size={20} aria-hidden />
        {DOWNLOAD_PDF}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy !== null}
        onClick={() => void download("xlsx")}
        className="inline-flex items-center gap-2"
      >
        <DownloadSimpleIcon size={20} aria-hidden />
        {DOWNLOAD_EXCEL}
      </Button>
      <FormError message={error} className="order-last basis-full" />
    </>
  );
}

const noSubscription = () => () => {};

/**
 * The package page's PDF (Build 24, P12; the owner's build 23 words: the page
 * shows the package): the site's own route, in a frame the page's height. The
 * frame waits for the browser's zone — the server has none of the person's —
 * so the PDF prints their times, and a Download PDF after it is the same file.
 */
export function PackageFrame({ runId }: { runId: string }) {
  const zone = useSyncExternalStore(
    noSubscription,
    browserTimeZone,
    () => null,
  );
  const frame =
    "block h-[calc(100dvh-16rem)] min-h-[28rem] w-full rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]";
  return zone === null ? (
    <div aria-hidden className={frame} />
  ) : (
    <iframe
      title="Run package"
      src={packageFileHref(runId, zone || null)}
      className={frame}
    />
  );
}

const RESULT_TONE: Partial<Record<RunDetail["run"]["status"], string>> = {
  succeeded: "text-[var(--success-text)]",
  failed: "text-[var(--error-text)]",
  held: "text-[var(--warning-text)]",
};

/** A tile: its value large over its label — the label first in the markup, as a list says it. */
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-4 py-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd
        data-testid={`run-tile-${label}`}
        className="text-2xl font-medium text-[var(--text)]"
      >
        {value}
      </dd>
    </div>
  );
}

const STATE_LOOK: Record<
  TrackerState,
  { Icon: typeof CheckCircleIcon; tone: string; motion?: string }
> = {
  waiting: { Icon: CircleDashedIcon, tone: "text-[var(--muted)]" },
  // The running step's icon spins; with reduced motion it stays still (Build
  // 23's A4, the app's rule). Only this state moves.
  working: {
    Icon: CircleNotchIcon,
    tone: "text-[var(--link)]",
    motion: "motion-safe:animate-spin",
  },
  done: { Icon: CheckCircleIcon, tone: "text-[var(--success-text)]" },
  held: { Icon: HandPalmIcon, tone: "text-[var(--warning-text)]" },
  failed: { Icon: WarningCircleIcon, tone: "text-[var(--error-text)]" },
  skipped: { Icon: MinusCircleIcon, tone: "text-[var(--muted)]" },
  stopped: { Icon: MinusCircleIcon, tone: "text-[var(--muted)]" },
  // A platform step this build does not know: no state (backend ADR-0041).
  unknown: { Icon: CircleDashedIcon, tone: "text-[var(--muted)]" },
};

/**
 * One row of Steps: "3 · AI processing", its state's icon (24) and its state
 * in words — Waiting, Working… (its icon spinning), Done and when, Waiting for
 * approval and why, Denied, the run's failure, Skipped or Stopped; a setting
 * step's integration; step 5's Email sent and when, Sending email… or Done
 * (Build 23's A7, `lib/run-progress.ts`) — never a step's own summary
 * and never a step id (B6). A platform step this build does not know has no
 * state, so no line. Under it, what the row offers: a held step's decision.
 */
function TrackerItem({
  row,
  children,
}: {
  row: TrackerRow;
  children?: ReactNode;
}) {
  const { Icon, tone, motion } = STATE_LOOK[row.state];
  const quiet =
    row.state === "waiting" ||
    row.state === "skipped" ||
    row.state === "stopped" ||
    row.state === "unknown";
  return (
    <li
      data-testid={`run-step-${row.key}`}
      data-state={row.state}
      className="flex items-start gap-3"
    >
      <Icon
        size={24}
        aria-hidden
        className={`mt-0.5 shrink-0 ${tone}${motion ? ` ${motion}` : ""}`}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p
          className={`text-sm font-medium ${quiet ? "text-[var(--muted)]" : "text-[var(--text)]"}`}
        >
          {row.title}
        </p>
        {row.sub ? (
          <p
            className={`text-sm ${row.state === "waiting" || quiet ? "text-[var(--muted)]" : tone}`}
          >
            {row.sub}
          </p>
        ) : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </li>
  );
}

const CHIP_TONE: Record<DocumentCardView["tone"], string> = {
  ok: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warn: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  muted: "bg-[var(--surface-strong)] text-[var(--muted)]",
};

/**
 * One document a run read, on its own card (Build 21, spec A7; backend
 * ADR-0039), closed until it is opened (Build 24, P10): "Invoice 1 of 3", what
 * happened to it and `{vendor} · {total}` (S9); open, its Document type and
 * Format, then the type and seller; where; when; the numbers that match it to
 * its record (AM7); each line with "{quantity} × {unit price}" under it; the
 * totals; how it was paid; the result line; then the automation's own detail
 * lines. Each opens on its own. The app's
 * `snoopy-mobile/components/runs/document-card.tsx` on the website.
 */
function DocumentCard({ card }: { card: DocumentCardView }) {
  const pairs = (rows: DocumentRowView[], prefix: string) =>
    rows.map((row, index) => (
      <div
        key={`${prefix}-${row.label}-${index}`}
        className="flex items-start justify-between gap-4"
      >
        <dt className="text-sm text-[var(--muted)]">{row.label}</dt>
        <dd
          className={`text-right text-sm break-words text-[var(--text)] ${row.strong ? "font-medium" : ""}`}
        >
          {row.value}
        </dd>
      </div>
    ));
  return (
    <details
      data-testid={`document-${card.index}`}
      className="group rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-[var(--text)]">
            {card.heading}
          </span>
          {card.glance ? (
            <span
              data-testid={`document-${card.index}-glance`}
              className="text-xs break-words text-[var(--muted)]"
            >
              {card.glance}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            data-testid={`document-${card.index}-chip`}
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP_TONE[card.tone]}`}
          >
            {card.chip}
          </span>
          <CaretDownIcon
            size={20}
            aria-hidden
            className="text-[var(--muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className="border-t border-[var(--ring)] px-4 pt-3 pb-4">
        <dl className="flex flex-col gap-1.5">{pairs(card.facts, "fact")}</dl>
        <p className="mt-3 text-sm font-medium text-[var(--text)]">
          {card.title}
        </p>
        {card.location ? (
          <p className="text-xs text-[var(--muted)]">{card.location}</p>
        ) : null}
        {card.when ? (
          <p className="text-xs text-[var(--muted)]">{card.when}</p>
        ) : null}
        {card.ids.length > 0 ? (
          <dl className="mt-3 flex flex-col gap-1.5">
            {pairs(card.ids, "id")}
          </dl>
        ) : null}
        {card.lines.length > 0 || card.moreLines ? (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--ring)] pt-3">
            {card.lines.map((line, index) => (
              <div
                key={`line-${index}`}
                data-testid={`document-${card.index}-line-${index + 1}`}
                className="flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text)]">
                    {line.description}
                  </p>
                  {line.each ? (
                    <p className="text-xs text-[var(--muted)]">{line.each}</p>
                  ) : null}
                </div>
                {line.amount ? (
                  <p className="text-sm text-[var(--text)]">{line.amount}</p>
                ) : null}
              </div>
            ))}
            {card.moreLines ? (
              <p className="text-xs text-[var(--muted)]">
                {DOCUMENT_MORE_LINES}
              </p>
            ) : null}
          </div>
        ) : null}
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-[var(--ring)] pt-3">
          {pairs(card.rows, "row")}
        </dl>
      </div>
    </details>
  );
}
