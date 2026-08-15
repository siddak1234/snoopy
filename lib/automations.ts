import {
  platformServerJson,
  PlatformNotConfiguredError,
} from "@/lib/platform-server";
import type {
  components,
  operations,
} from "./generated/platform-contracts/automations";

/**
 * The automation surface, as the website consumes it.
 *
 * Response models are generated from `docs/openapi/automations.yaml`. The
 * contract test remains a UI-consumption check: it proves that each field the
 * page reads is part of the published response rather than merely a type alias.
 *
 * Every path is workspace-scoped because the workspace is the thing being
 * authorized: the Edge refuses one the session does not name, answering 404 so a
 * non-member cannot learn it exists.
 */

export type SubscriptionStatus = components["schemas"]["SubscriptionStatus"];
export type RunStatus = components["schemas"]["RunStatus"];
export type RunOrigin = components["schemas"]["RunOrigin"];
export type ApprovalStatus = components["schemas"]["ApprovalStatus"];
export type AutomationCatalogEntry =
  components["schemas"]["AutomationCatalogEntry"];
export type AutomationSetupField =
  components["schemas"]["AutomationSetupField"];
export type AutomationCatalog =
  components["schemas"]["AutomationCatalogResponse"];
export type Subscription = components["schemas"]["Subscription"];
export type Run = components["schemas"]["Run"];
export type RunStep = components["schemas"]["RunStep"];
export type RunEvent = components["schemas"]["RunEvent"];
export type RunDetail = components["schemas"]["RunDetail"];
export type Approval = components["schemas"]["Approval"];
export type ListSubscriptionsResponse =
  operations["listSubscriptions"]["responses"][200]["content"]["application/json"];
export type ListRunsResponse =
  operations["listRuns"]["responses"][200]["content"]["application/json"];
export type ListApprovalsResponse =
  operations["listApprovals"]["responses"][200]["content"]["application/json"];
export type CreateSubscriptionRequest =
  operations["createSubscription"]["requestBody"]["content"]["application/json"];
export type CreateSubscriptionResponse =
  operations["createSubscription"]["responses"][200]["content"]["application/json"];
export type UpdateSubscriptionRequest =
  operations["updateSubscription"]["requestBody"]["content"]["application/json"];
export type UpdateSubscriptionResponse =
  operations["updateSubscription"]["responses"][200]["content"]["application/json"];
export type CreateRunRequest =
  operations["createRun"]["requestBody"]["content"]["application/json"];
export type CreateRunResponse =
  | operations["createRun"]["responses"][200]["content"]["application/json"]
  | operations["createRun"]["responses"][201]["content"]["application/json"];
export type DecideApprovalRequest =
  operations["decideApproval"]["requestBody"]["content"]["application/json"];
export type DecideApprovalResponse =
  operations["decideApproval"]["responses"][200]["content"]["application/json"];

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
): Promise<ListSubscriptionsResponse> {
  return platformServerJson<ListSubscriptionsResponse>(
    `${scope(workspaceId)}/subscriptions`,
  );
}

export function listRuns(
  workspaceId: string,
  subscriptionId?: string,
): Promise<ListRunsResponse> {
  const query = subscriptionId
    ? `?subscriptionId=${encodeURIComponent(subscriptionId)}`
    : "";
  return platformServerJson<ListRunsResponse>(
    `${scope(workspaceId)}/runs${query}`,
  );
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
): Promise<ListApprovalsResponse> {
  const query = status ? `?status=${status}` : "";
  return platformServerJson<ListApprovalsResponse>(
    `${scope(workspaceId)}/approvals${query}`,
  );
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
