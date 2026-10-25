import { notFound } from "next/navigation";
import {
  emptyWhenUnavailable,
  listApprovals,
  listArchivedSubscriptions,
  listAutomations,
  listSubscriptions,
  readRun,
  type Approval,
  type RunDetail,
  type Subscription,
} from "@/lib/automations";
import { settingLine, stepTitle } from "@/lib/flow-steps";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
} from "@/lib/platform-server";
import { roleInWorkspace, type WorkspaceRole } from "@/lib/tenancy";
import type { RunFlow } from "./RunLive";

/**
 * What a run's page and its details page read on the server (Build 21, spec
 * A7; build 28's item 9 split them): the run, by its FULL id, every step from
 * the start and each document it read — drawn once, then kept live by
 * `RunLive`.
 *
 * The screen renders `steps` — what the automation reported against the steps
 * its manifest declares — and not `events`, which is the platform's own record
 * of state transitions. The run names no flow (`Run.templateId`'s own words: a
 * screen joins the catalog), so its name, steps' titles and groups come from
 * there, and the word for one of its runs (`items.runWords`, the version the
 * flow runs, else the catalog's) heads what it read; its file's word is its
 * version's file fields (`runFileRows`). A held run's approvals are
 * read too: a waiting document whose approval was refused or ran out says "Not
 * approved" (S21), and while its newest waits, the run's page offers Approve
 * and Deny under its result line to a role it names (Build 24, P6; the role read as Approvals reads it, from
 * the workspace list the layout read already). The role goes with every run,
 * held or not: a run that turns held while its page is open has its approvals
 * read again in the browser (`RunLive`), and the page offers the pair from there.
 *
 * And its flow, as it is now (Build 22, the session's S23): a setting step's
 * line — the integration the flow has chosen — and a title by connection
 * ("QuickBooks updated") follow the flow's settings, since a run does not
 * record its own choice (backend §12.1 #290). The live list first, the
 * archived one only when the run's flow is not in it (the app's M6); a flow
 * that cannot be read costs those two their words, never the page.
 */
export type RunPageData = {
  detail: RunDetail;
  flow: RunFlow;
  approvals: Approval[];
  role: WorkspaceRole | undefined;
};

/** The run's flow as the platform lists it now, or `undefined` when it cannot be read or is gone. */
async function readFlow(
  workspaceId: string,
  subscriptionId: string,
): Promise<Subscription | undefined> {
  const own = (rows: readonly Subscription[]) =>
    rows.find((row) => row.id === subscriptionId);
  try {
    const live = own((await listSubscriptions(workspaceId)).subscriptions);
    return live ?? own(await listArchivedSubscriptions(workspaceId));
  } catch (error) {
    if (
      error instanceof PlatformServerError ||
      error instanceof PlatformNotConfiguredError
    )
      return undefined;
    throw error;
  }
}

export async function readRunPage(
  workspaceId: string,
  runId: string,
): Promise<RunPageData> {
  let detail;
  try {
    detail = await readRun(workspaceId, runId);
  } catch (error) {
    // A run in another workspace answers 404, same as one that does not exist.
    // Rendering the same page for both is what keeps that true here.
    if (error instanceof PlatformServerError && error.status === 404)
      notFound();
    throw error;
  }

  const held = detail.run.status === "held";
  const [catalog, approvals, subscription, role] = await Promise.all([
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    held
      ? emptyWhenUnavailable(() => listApprovals(workspaceId), {
          approvals: [],
        })
      : { approvals: [] },
    readFlow(workspaceId, detail.run.subscriptionId),
    roleInWorkspace(workspaceId),
  ]);
  const jobApprovals = approvals.approvals.filter(
    (approval) => approval.runId === detail.run.id,
  );
  const entry = catalog.automations.find(
    (candidate) => candidate.templateId === detail.run.templateId,
  );
  const setup = subscription?.setup ?? entry?.setup ?? [];
  const providerName = (providerId: string) =>
    entry?.requiredConnections.find(
      (connection) => connection.providerId === providerId,
    )?.displayName ?? providerId;
  const runWord = (subscription?.items ?? entry?.items)?.runWords.singular;
  // The flow's words for the run's files (build 28, item 7: "View resume"):
  // its version's file fields, in order.
  const fileFields = subscription?.runInput
    ?.filter((field) => field.control === "artifact")
    .map((field) => ({ control: field.control, title: field.title }));
  const flow: RunFlow = entry
    ? {
        name: entry.name,
        ...(entry.documentWords ? { documentWords: entry.documentWords } : {}),
        ...(runWord ? { runWord } : {}),
        ...(fileFields ? { fileFields } : {}),
        pipeline: entry.pipeline.map((step) => ({
          id: step.id,
          title: step.title,
          ...(step.group ? { group: step.group } : {}),
        })),
        ...(entry.groups
          ? {
              groups: entry.groups.map((group) => ({
                id: group.id,
                title: group.title,
                ...(group.platform !== undefined
                  ? { platform: group.platform }
                  : {}),
              })),
            }
          : {}),
        ...(subscription && entry.groups
          ? {
              tracker: {
                titles: Object.fromEntries(
                  entry.groups.map((group) => [
                    group.id,
                    stepTitle(group, setup, subscription.config),
                  ]),
                ),
                settings: Object.fromEntries(
                  entry.groups.flatMap((group) => {
                    const line = settingLine(
                      group.id,
                      setup,
                      subscription.config,
                      providerName,
                    );
                    return line === null ? [] : [[group.id, line]];
                  }),
                ),
              },
            }
          : {}),
      }
    : null;

  return { detail, flow, approvals: jobApprovals, role };
}
