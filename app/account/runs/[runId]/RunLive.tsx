"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleDashedIcon } from "@phosphor-icons/react/dist/ssr/CircleDashed";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/ssr/FlowArrow";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { MinusCircleIcon } from "@phosphor-icons/react/dist/ssr/MinusCircle";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { Approval, RunDetail, RunOrigin } from "@/lib/automations";
import { formatDateTimeMediumUTC as formatWhen } from "@/lib/date";
import { flowPath } from "@/lib/flow-steps";
import { platformApiFile, platformApiJson } from "@/lib/platform-api";
import {
  DOCUMENT_MORE_LINES,
  DOWNLOAD_FAILED,
  DOWNLOAD_JSON,
  documentsFileName,
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
 * One run, live (Build 21, spec A7; the owner's build 20 item 10: "It shoukd
 * show all the steps and a live tracker of which ones are done"): its full id
 * and status; how it went; Duration and Steps done; every step from the start,
 * each where the run is; each document it read on a card of its own, with
 * Download JSON; the facts; Cancel run while it goes on, and View flow. Read
 * again every 2 s while the run is pending or running (`RUN_REREAD_MS`),
 * through `/api/platform`, one read at a time; the page as the server drew it
 * comes back whenever it is drawn again (a cancel revalidates it).
 */
export function RunLive({
  workspaceId,
  initial,
  flow,
  approvals,
}: {
  workspaceId: string;
  initial: RunDetail;
  flow: RunFlow;
  /** A held run's approval, read once: what became of it. */
  approvals: Approval[];
}) {
  const [detail, setDetail] = useState(initial);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again (a cancel, a refresh): its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setDetail(initial);
  }
  const [reads, setReads] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
  const tracker = trackerRows(
    steps,
    flow?.pipeline,
    flow?.groups,
    run,
    undefined,
    flow?.pipeline,
    { flow: flow?.tracker, email: detail.email },
  );
  const decided = heldDecision(run, approvals);
  const cards = toDocumentCards(
    documents,
    decided === "rejected"
      ? "rejected"
      : decided === "closed"
        ? "expired"
        : null,
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

  /**
   * Download JSON (spec A7, C2; the session's S25): the run's documents as the
   * platform serves them for keeping (`readRunDocuments`), read at the press,
   * saved by the browser as `run-{full id}.json`.
   */
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const file = await platformApiFile(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(run.id)}/documents`,
      );
      const href = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = documentsFileName(run.id);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
    } catch {
      setDownloadError(DOWNLOAD_FAILED);
    } finally {
      setDownloading(false);
    }
  };

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
        {/* A continuation belongs to the run it continues. The link is how a
            person follows the chain rather than reading two unrelated runs. */}
        {run.continuesRunId ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Continues{" "}
            <Link
              prefetch={false}
              href={`/account/runs/${run.continuesRunId}`}
              className="text-[var(--accent)] underline underline-offset-2"
            >
              the run that was held
            </Link>
            .
          </p>
        ) : null}
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
            <TrackerItem key={row.key} row={row} />
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
          {cards.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={downloading}
              onClick={() => void download()}
              className="inline-flex items-center gap-2"
            >
              <DownloadSimpleIcon size={20} aria-hidden />
              {DOWNLOAD_JSON}
            </Button>
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
        <FormError message={downloadError} className="mt-2" />
      </div>
    </SectionCard>
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
 * approval and why, the run's failure, Skipped or Stopped; a setting step's
 * integration; step 5's Email sent and when, Sending email… or Done (Build
 * 23's A7, `lib/run-progress.ts`) — never a step's own summary
 * and never a step id (B6). A platform step this build does not know has no
 * state, so no line.
 */
function TrackerItem({ row }: { row: TrackerRow }) {
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
 * ADR-0039): "Document 1 of 3" and what happened to it; the type and seller;
 * where; when; the numbers that match it to its record (AM7); each line with
 * "{quantity} × {unit price}" under it; the totals; how it was paid; the
 * result line; then the automation's own detail lines. The app's
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
    <article
      data-testid={`document-${card.index}`}
      aria-label={card.heading}
      className="rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-4 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[var(--muted)]">
          {card.heading}
        </p>
        <span
          data-testid={`document-${card.index}-chip`}
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP_TONE[card.tone]}`}
        >
          {card.chip}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-[var(--text)]">
        {card.title}
      </p>
      {card.location ? (
        <p className="text-xs text-[var(--muted)]">{card.location}</p>
      ) : null}
      {card.when ? (
        <p className="text-xs text-[var(--muted)]">{card.when}</p>
      ) : null}
      {card.ids.length > 0 ? (
        <dl className="mt-3 flex flex-col gap-1.5">{pairs(card.ids, "id")}</dl>
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
                <p className="text-sm text-[var(--text)]">{line.description}</p>
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
            <p className="text-xs text-[var(--muted)]">{DOCUMENT_MORE_LINES}</p>
          ) : null}
        </div>
      ) : null}
      <dl className="mt-3 flex flex-col gap-1.5 border-t border-[var(--ring)] pt-3">
        {pairs(card.rows, "row")}
      </dl>
    </article>
  );
}
