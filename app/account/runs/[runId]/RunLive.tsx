"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/ssr/FlowArrow";
import { BlockList } from "@/components/blocks/BlockList";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { FileActions, usePageFile } from "@/components/dashboard/FileActions";
import { Group } from "@/components/dashboard/Group";
import { PageRow } from "@/components/dashboard/PageRow";
import { RunScore } from "@/components/dashboard/RunScore";
import { Tile } from "@/components/dashboard/Tile";
import { TrackerItem } from "@/components/dashboard/TrackerItem";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { ApprovalDecision } from "@/app/account/approvals/ApprovalDecision";
import type {
  Approval,
  CreateRunPackageFileRequest,
  ListApprovalsResponse,
  RunDetail,
  RunOrigin,
  RunPackageFile,
} from "@/lib/automations";
import { formatDateTimeMediumUTC as formatWhen } from "@/lib/date";
import { flowPath } from "@/lib/flow-steps";
import {
  PlatformApiError,
  platformApiJson,
  siteFileNamed,
} from "@/lib/platform-api";
import {
  DOWNLOAD_EXCEL,
  DOWNLOAD_FAILED,
  DOWNLOAD_PDF,
  VIEW_PACKAGE,
  askPackageOnceMore,
  packageFileHref,
  shareHref,
} from "@/lib/run-documents";
import {
  BLOCKS_SHAPE,
  RUN_DETAILS,
  RUN_REREAD_MS,
  heldDecision,
  mayDecide,
  newestApproval,
  rereadForApproval,
  rereadForApprovalForm,
  runDetailsPath,
  runDuration,
  runLabel,
  stepsDone,
  trackerRows,
  type DeclaredStep,
  type ProgressGroup,
  type TrackerFlow,
} from "@/lib/run-progress";
import {
  offeredDecisions,
  reviewTally,
  type PendingQuestionForm,
} from "@/lib/pending-contract";
import { verdictChip, type VerdictNames } from "@/lib/run-verdict";
import { followSignedLink } from "@/lib/signed-link";
import type { WorkspaceRole } from "@/lib/tenancy";
import { CancelRunButton } from "./CancelRunButton";
import { SPACING } from "@/lib/spacing";

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
  /** The file fields of the version the flow runs, in order: what names a run's files ("Resume"). */
  fileFields?: { control: string; title: string }[];
  /** What the flow calls its verdicts ("Advance", "Decline"): the score's chip (`verdictChip`). */
  verdictNames?: VerdictNames;
  pipeline: DeclaredStep[];
  groups?: ProgressGroup[];
  tracker?: TrackerFlow;
} | null;

/**
 * One run, live (Build 21, spec A7; the owner's build 20 item 10: "It shoukd
 * show all the steps and a live tracker of which ones are done"), as one of
 * two pages (build 28, the owner's item 9: Run details "a standard … a
 * component with an arrow"; `view`):
 *
 * - **the run's page** (`run`): its header — its full id, or its title and
 *   score, and its status; then its body, the platform's blocks as it sent
 *   them (backend ADR-0048; `BlockList`), in its flow's `pages.run` order —
 *   a run of an item's "View {file}" row, its result line, a held job's
 *   approval form (drawn by `ApprovalDecision`, to a role it names, else who
 *   can), then what it read; then its footer — View package, Download PDF
 *   and Download Excel when the platform offers the package
 *   (`packageAvailable`), the Run details row (`PageRow`), Cancel run while
 *   it goes on, and View flow. An answer with no blocks draws the header,
 *   the footer and the fallback sentence. ~~Its documents, sections and
 *   details drawn here, by kind~~ until Round 21;
 * - **its details page** (`details`): Duration and Steps done; every step
 *   from the start, each where the run is — a held step its state, "Waiting
 *   for approval" (~~Approve and Deny under it~~ until build 28's review);
 *   then Started, Ended, Trigger and the full Run ID.
 *
 * Both are read again every 2 s while the run is pending or running
 * (`RUN_REREAD_MS`), through `/api/platform`, one read at a time; the page
 * as the server drew it comes back whenever it is drawn again (a cancel or a
 * decision revalidates it). A held run whose blocks hold no approval form
 * yet (it turned held while the page was open, or was read before its
 * approval was asked) is read again here, in the browser, every 2 s, one
 * read at a time and at most `HELD_APPROVAL_REREADS` times, until the form
 * comes or the run leaves held (`rereadForApprovalForm`); its details page
 * reads the job and its approvals together, until the approval is listed
 * (`rereadForApproval`; Build 25, the review's R5c 1). So Approve and Deny
 * appear with no reload. A read that fails costs only itself: the page
 * stays as it was, as the app's does.
 */
export function RunLive({
  workspaceId,
  initial,
  flow,
  approvals,
  role,
  view,
}: {
  /** Which page: the run's own, or its details (build 28, item 9). */
  view: "run" | "details";
  workspaceId: string;
  initial: RunDetail;
  flow: RunFlow;
  /** The job's approvals as the server read them, once it waited: what became of them, and a saved review's count. */
  approvals: Approval[];
  /** This person's role in the workspace: whether the approval form offers Approve and Deny. */
  role: WorkspaceRole | undefined;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [listed, setListed] = useState(approvals);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again (a cancel, a refresh): its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setDetail(initial);
    setListed(approvals);
  }
  const [reads, setReads] = useState(0);
  const { run, steps } = detail;
  // Headed by what the flow named it and its score, when it has both.
  const headed = run.title !== undefined && run.score !== undefined;
  const going = run.status === "pending" || run.status === "running";

  useEffect(() => {
    if (!going) return;
    let live = true;
    const timer = setTimeout(() => {
      platformApiJson<RunDetail>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(run.id)}${BLOCKS_SHAPE}`,
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

  // Held, with nothing yet to decide on the page: the job read again in the
  // browser — on its details page with its approvals — until there is, or
  // the job goes on (R5c 1). Each read that fails leaves its part as it was.
  const [approvalReads, setApprovalReads] = useState(0);
  const owed =
    view === "details"
      ? rereadForApproval(run, listed, approvalReads)
      : rereadForApprovalForm(run, detail.blocks, approvalReads);
  useEffect(() => {
    if (!owed) return;
    let live = true;
    const scope = `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
    const timer = setTimeout(() => {
      void Promise.allSettled([
        platformApiJson<RunDetail>(
          `${scope}/runs/${encodeURIComponent(run.id)}${BLOCKS_SHAPE}`,
        ),
        view === "details"
          ? platformApiJson<ListApprovalsResponse>(`${scope}/approvals`)
          : Promise.reject(new Error("not read on the run's page")),
      ]).then(([job, list]) => {
        if (!live) return;
        if (job.status === "fulfilled") setDetail(job.value);
        if (list.status === "fulfilled")
          setListed(
            list.value.approvals.filter(
              (approval) => approval.runId === run.id,
            ),
          );
        setApprovalReads((count) => count + 1);
      });
    }, RUN_REREAD_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [owed, approvalReads, workspaceId, run.id, view]);

  const name = headed && run.title ? run.title : runLabel(run.id);

  // The decision where the job waits (Build 24, P6; build 28's review,
  // finding 1: not one tap more): one press, or a review's Save review
  // (`review`, Round 21's F2), then the page is drawn again — running on, or
  // Denied.
  const decisionForm = (form: PendingQuestionForm) =>
    form.approvalId ? (
      <div data-testid="run-decision">
        <ApprovalDecision
          approvalId={form.approvalId}
          canDecide={mayDecide(role, form.eligibleRoles)}
          eligibleRoles={form.eligibleRoles ?? []}
          workspaceId={workspaceId}
          decisions={offeredDecisions(form)}
          role={role}
          onDecision={(_, state) => {
            if (state === "saved") router.refresh();
          }}
        />
      </div>
    ) : null;

  if (view === "details") {
    // Every step from the start (spec A7; S14): by the catalog's groups, the
    // newest version's, for any run whose every reported step they still
    // declare (Build 22, the session's S25: a v3 run is drawn by v4's five
    // steps); a run that reported a step they no longer declare is drawn by
    // the steps it reported. Step 2 says the flow's integration, step 4's
    // title follows it, step 5 is the run's email.
    const decided = heldDecision(run, listed);
    // A saved review's count on the step that waited (Round 21's F2).
    const review = reviewTally(newestApproval(run.id, listed));
    const tracker = trackerRows(
      steps,
      flow?.pipeline,
      flow?.groups,
      run,
      undefined,
      flow?.pipeline,
      { flow: flow?.tracker, email: detail.email, decision: decided, review },
    );
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
        title={RUN_DETAILS}
        subheader={name}
        back={<BackLink href={`/account/runs/${encodeURIComponent(run.id)}`} />}
        primaryAction={<StatusPill status={run.status} />}
      >
        <Group>
          <dl className={`grid grid-cols-2 ${SPACING.inner.gap} sm:max-w-sm`}>
            <Tile
              label="Duration"
              value={runDuration(run.startedAt, run.endedAt)}
              testId="run-tile-Duration"
            />
            <Tile
              label="Steps done"
              value={stepsDone(tracker)}
              testId="run-tile-Steps done"
            />
          </dl>
        </Group>

        <Group title="Steps" titleId="run-steps-title">
          <ol
            data-testid="run-steps"
            className={`flex flex-col ${SPACING.group.gap}`}
          >
            {tracker.map((row) => (
              <TrackerItem key={row.key} row={row} />
            ))}
          </ol>
        </Group>

        <Group>
          <dl className={`grid ${SPACING.inner.gap} sm:grid-cols-2`}>
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-[var(--muted)]">{fact.label}</dt>
                <dd
                  data-testid={`run-fact-${fact.label}`}
                  className="text-sm break-all text-[var(--text)] select-all"
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </Group>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={name}
      subheader={flow?.name ?? run.templateId}
      back={<BackLink href="/account/runs" />}
      primaryAction={
        <>
          {headed && run.score !== undefined ? (
            <RunScore
              score={run.score}
              chip={verdictChip(run.verdict, flow?.verdictNames)}
            />
          ) : null}
          <StatusPill status={run.status} />
        </>
      }
    >
      {/* The body, as the platform sent it: the run's files, its result
          line and what is to decide, then what it read (ADR-0048). */}
      <Group>
        <BlockList
          blocks={detail.blocks}
          testId="run-blocks"
          context={{
            subscriptionId: run.subscriptionId,
            forms: { approval: decisionForm, review: decisionForm },
          }}
        />
      </Group>

      <Group>
        {/* Every run's, whatever its flow (build 28, item 9): the steps and
            the facts on a page of their own. */}
        {/* The package's three first, then Run details, directly over
            Cancel run and View flow (build 28's review, finding 2). */}
        {detail.packageAvailable === true ? (
          <div
            className={`${SPACING.group.bottom} flex flex-wrap items-center ${SPACING.inner.gap}`}
          >
            <PackageActions workspaceId={workspaceId} runId={run.id} view />
          </div>
        ) : null}
        <PageRow href={runDetailsPath(run.id)} testId="run-details-row">
          <span className="font-medium text-[var(--text)]">{RUN_DETAILS}</span>
        </PageRow>
        <div
          className={`${SPACING.group.top} flex flex-wrap items-center ${SPACING.inner.gap}`}
        >
          {/* Only the two states the platform cancels; any other answers 404. */}
          {going ? (
            <CancelRunButton runId={run.id} workspaceId={run.workspaceId} />
          ) : null}
          <Button
            href={flowPath(run.subscriptionId)}
            variant="secondary"
            size="sm"
            prefetch={false}
            className={`inline-flex items-center ${SPACING.inner.gap}`}
          >
            <FlowArrowIcon size={20} aria-hidden />
            View flow
          </Button>
        </div>
      </Group>
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
 * `retry-after` (`askPackageOnceMore`); then the refusal is the caller's.
 */
function createPackageFile(
  workspaceId: string,
  runId: string,
  format: PackageFormat,
): Promise<RunPackageFile> {
  const zone = browserTimeZone();
  const body: CreateRunPackageFileRequest = {
    format,
    ...(zone ? { timeZone: zone } : {}),
  };
  return askPackageOnceMore(
    () =>
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
      ),
    (error) => (error instanceof PlatformApiError ? error : null),
  );
}

/**
 * The run package's buttons (Build 24, P12; the owner's build 23 words): View
 * package — on the run page — and Download PDF and Download Excel, on both,
 * then Share, the PDF itself (`FileActions`; the owner's F4 and Q7): on the
 * package page the bytes its frame shows (`PackageFile`), on the run page
 * read when Share is first pressed, never before. A
 * download goes to the file's signed link, which saves it (an attachment; no
 * page is left and nothing crosses origins); a refusal is said under the row,
 * and so is a link that is not https, which is never followed
 * (`followSignedLink`; Build 25, the review's R5c 2).
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
  const page = useContext(PackageFileContext);
  // The package page's bytes, unless its read failed.
  const held = page && !page.failed ? page : null;
  const filename = `${runLabel(runId)}.pdf`;
  const download = (format: PackageFormat) => async () => {
    try {
      const file = await createPackageFile(workspaceId, runId, format);
      return followSignedLink(file.downloadUrl) ? null : DOWNLOAD_FAILED;
    } catch {
      return DOWNLOAD_FAILED;
    }
  };
  return (
    <FileActions
      testId="package-actions"
      before={
        view ? (
          <Button
            href={`/account/runs/${encodeURIComponent(runId)}/package`}
            variant="secondary"
            size="sm"
            prefetch={false}
            className={`inline-flex items-center ${SPACING.inner.gap}`}
          >
            <FileTextIcon size={20} aria-hidden />
            {VIEW_PACKAGE}
          </Button>
        ) : null
      }
      downloads={[
        { label: DOWNLOAD_PDF, run: download("pdf") },
        { label: DOWNLOAD_EXCEL, run: download("xlsx") },
      ]}
      // Share: the package's PDF itself — the package page's own bytes,
      // else read through this site's own route at the press; never the
      // signed link.
      share={
        held
          ? { filename, contentType: "application/pdf", held: held.held }
          : {
              filename,
              contentType: "application/pdf",
              read: () =>
                siteFileNamed(
                  shareHref({
                    runId,
                    format: "pdf",
                    timeZone: browserTimeZone(),
                  }),
                ),
            }
      }
    />
  );
}

const noSubscription = () => () => {};

type PackageFileRead = ReturnType<typeof usePageFile> & { href: string | null };

/** The package page's PDF, read once (`PackageFile`); null off that page. */
const PackageFileContext = createContext<PackageFileRead | null>(null);

/**
 * The package page's PDF, read once in the browser (`usePageFile`) from the
 * site's own route, for its frame and its Share alike. The read waits for
 * the browser's zone — the server has none of the person's — so the PDF
 * prints their times, and a Download PDF after it is the same file.
 */
export function PackageFile({
  runId,
  children,
}: {
  runId: string;
  children: ReactNode;
}) {
  const zone = useSyncExternalStore(
    noSubscription,
    browserTimeZone,
    () => null,
  );
  const href = zone === null ? null : packageFileHref(runId, zone || null);
  const read = usePageFile(href);
  return (
    <PackageFileContext value={{ ...read, href }}>
      {children}
    </PackageFileContext>
  );
}

/**
 * The package page's PDF (Build 24, P12; the owner's build 23 words: the page
 * shows the package), in a frame the page's height: the bytes `PackageFile`
 * read, or — when that read failed — the site's own route, which says why.
 */
export function PackageFrame() {
  const page = useContext(PackageFileContext);
  const frame =
    "block h-[calc(100dvh-16rem)] min-h-[28rem] w-full rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]";
  const shown = page?.url ?? (page?.failed ? page.href : null);
  return shown ? (
    <iframe title="Run package" src={shown} className={frame} />
  ) : (
    <div aria-hidden className={frame} />
  );
}
