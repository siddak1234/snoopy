import {
  platformServerJson,
  PlatformNotConfiguredError,
} from "@/lib/platform-server";

/**
 * The automation surface, as the website consumes it.
 *
 * Types mirror `snoopy-backend/docs/openapi/automations.yaml` and are checked
 * against it by `test/automation-contract.test.mjs`, so a backend field that
 * changes name fails here rather than rendering as blank.
 *
 * Every path is workspace-scoped because the workspace is the thing being
 * authorized: the Edge refuses one the session does not name, answering 404 so a
 * non-member cannot learn it exists.
 */

export type SubscriptionStatus = "draft" | "live" | "paused";

export type RunStatus =
  "pending" | "running" | "held" | "succeeded" | "failed" | "cancelled";

export type RunOrigin =
  "trigger" | "manual" | "approval-continuation" | "retry-continuation";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type AutomationCatalogEntry = {
  templateId: string;
  version: number;
  name: string;
  description: string;
  category: string;
  /** An icon name the client resolves. Never an asset URL. */
  icon: string;
  monthlyPriceUsd: number;
  subscribed: boolean;
  /** Evidence from a reachability probe, never an assumption. */
  available: boolean;
};

export type AutomationCatalog = {
  automations: AutomationCatalogEntry[];
  /** The filter vocabulary, already including "All". Rendered, never invented. */
  categories: string[];
};

export type Subscription = {
  id: string;
  workspaceId: string;
  templateId: string;
  templateVersion: number;
  name?: string;
  status: SubscriptionStatus;
  config: Record<string, unknown>;
  /** Provider ids still to connect. Non-empty blocks going live. */
  unmetConnections: string[];
  createdAt: string;
  updatedAt: string;
};

export type Run = {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  /** No display name here — join the catalog for one. */
  templateId: string;
  templateVersion: number;
  status: RunStatus;
  origin: RunOrigin;
  continuesRunId?: string;
  /** Groups a continuation chain, so approve-then-finish reads as one thing. */
  rootRunId: string;
  requestId: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RunStep = {
  id: string;
  runId: string;
  stepId: string;
  outcome: "ok" | "held" | "failed";
  /** One line for the timeline. Never the payload itself. */
  summary: string;
  heldReason?: string;
  occurredAt: string;
};

export type RunEvent = {
  id: string;
  runId: string;
  type: string;
  stepId?: string;
  occurredAt: string;
};

export type RunDetail = { run: Run; steps: RunStep[]; events: RunEvent[] };

export type Approval = {
  id: string;
  runId: string;
  workspaceId: string;
  subscriptionId: string;
  stepId: string;
  status: ApprovalStatus;
  /** The "why" line shown to the approver. */
  reason: string;
  eligibleRoles: string[];
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  continuationRunId?: string;
};

function scope(workspaceId: string): string {
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function listAutomations(
  workspaceId: string,
): Promise<AutomationCatalog> {
  return platformServerJson<AutomationCatalog>(
    `${scope(workspaceId)}/automations`,
  );
}

export function listSubscriptions(
  workspaceId: string,
): Promise<{ subscriptions: Subscription[] }> {
  return platformServerJson(`${scope(workspaceId)}/subscriptions`);
}

export function listRuns(
  workspaceId: string,
  subscriptionId?: string,
): Promise<{ runs: Run[] }> {
  const query = subscriptionId
    ? `?subscriptionId=${encodeURIComponent(subscriptionId)}`
    : "";
  return platformServerJson(`${scope(workspaceId)}/runs${query}`);
}

export function readRun(
  workspaceId: string,
  runId: string,
): Promise<RunDetail> {
  return platformServerJson(
    `${scope(workspaceId)}/runs/${encodeURIComponent(runId)}`,
  );
}

export function listApprovals(
  workspaceId: string,
  status?: ApprovalStatus,
): Promise<{ approvals: Approval[] }> {
  const query = status ? `?status=${status}` : "";
  return platformServerJson(`${scope(workspaceId)}/approvals${query}`);
}

/**
 * Reads that render an empty screen rather than an error page.
 *
 * A workspace with nothing yet, and a site with no backend configured, are both
 * legitimately empty. A failure that is neither is rethrown — a broken platform
 * must not look like an empty catalog.
 */
export async function emptyWhenUnavailable<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) return fallback;
    throw error;
  }
}

/**
 * A timestamp as a person reads it.
 *
 * Fixed locale and UTC on purpose: these screens are server-rendered, and a
 * locale-dependent string differs between the server and the browser, which
 * React reports as a hydration mismatch.
 */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}
