import {
  newIdempotencyKey,
  platformServerJson,
  PlatformNotConfiguredError,
  PlatformServerError,
  workspacePath as scope,
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
export type AutomationRunInputField =
  components["schemas"]["AutomationRunInputField"];
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
  operations["createRun"]["responses"][201]["content"]["application/json"];
export type DecideApprovalRequest =
  operations["decideApproval"]["requestBody"]["content"]["application/json"];
export type DecideApprovalResponse =
  operations["decideApproval"]["responses"][200]["content"]["application/json"];
export type CancelRunResponse =
  operations["cancelRun"]["responses"][200]["content"]["application/json"];
export type RunStats = components["schemas"]["RunStats"];
export type WebhookEndpoint = components["schemas"]["WebhookEndpoint"];
export type IssuedWebhookEndpoint =
  components["schemas"]["IssuedWebhookEndpoint"];
export type UploadTicket = components["schemas"]["UploadTicket"];
export type UploadedFile = components["schemas"]["UploadedFile"];
export type OpenUploadRequest =
  operations["openUpload"]["requestBody"]["content"]["application/json"];
export type CompleteUploadResponse =
  operations["completeUpload"]["responses"][200]["content"]["application/json"];
export type RunStatusCounts = components["schemas"]["RunStatusCounts"];

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

/**
 * The archived flows, asked for by name (backend §12.1 #203): the list above
 * never holds them. A platform from before the SEVENTEENTH promotion ignores the
 * filter and answers the live list, so only rows that ARE archived are kept — a
 * live flow is never shown as archived.
 */
export async function listArchivedSubscriptions(
  workspaceId: string,
): Promise<Subscription[]> {
  const response = await platformServerJson<ListSubscriptionsResponse>(
    `${scope(workspaceId)}/subscriptions?status=archived`,
  );
  return response.subscriptions.filter(
    (subscription) => subscription.status === "archived",
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
 * The platform's own tally of this workspace's runs (`readRunStats`) — every
 * status counted, so a screen sums what it wants rather than counting a page of
 * runs. `since` bounds the window; omitted, it is every run the workspace has.
 */
export function readRunStats(
  workspaceId: string,
  since?: string,
): Promise<RunStats> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return platformServerJson<RunStats>(
    `${scope(workspaceId)}/run-stats${query}`,
  );
}

/* --- mutations -------------------------------------------------------------
 *
 * Every write builds its path here, where each id is encoded (register F9); the
 * server actions decide what to send and what a refusal means, and nothing else.
 */

export function createSubscription(
  workspaceId: string,
  body: CreateSubscriptionRequest,
): Promise<CreateSubscriptionResponse> {
  return platformServerJson<CreateSubscriptionResponse>(
    `${scope(workspaceId)}/subscriptions`,
    {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey: newIdempotencyKey("subscribe"),
    },
  );
}

export function updateSubscription(
  workspaceId: string,
  subscriptionId: string,
  body: UpdateSubscriptionRequest,
  intent: "subscription-config" | "status" | "archive" | "version",
): Promise<UpdateSubscriptionResponse> {
  return platformServerJson<UpdateSubscriptionResponse>(
    `${scope(workspaceId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      idempotencyKey: newIdempotencyKey(intent),
    },
  );
}

/**
 * A subscription's webhook address, without its secret (backend §12.1 #91);
 * `null` when none has been issued. Owner or admin only.
 */
export async function readWebhookEndpoint(
  workspaceId: string,
  subscriptionId: string,
): Promise<WebhookEndpoint | null> {
  try {
    return await platformServerJson<WebhookEndpoint>(
      `${scope(workspaceId)}/subscriptions/${encodeURIComponent(subscriptionId)}/webhook`,
    );
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404)
      return null;
    throw error;
  }
}

/**
 * Issues the address, or gives it a new secret — shown in this answer and
 * never again. Not replayable, so it carries no idempotency key: a retry
 * rotates again, and the secret last shown is the one that works.
 */
export function issueWebhookEndpoint(
  workspaceId: string,
  subscriptionId: string,
): Promise<IssuedWebhookEndpoint> {
  return platformServerJson<IssuedWebhookEndpoint>(
    `${scope(workspaceId)}/subscriptions/${encodeURIComponent(subscriptionId)}/webhook`,
    { method: "POST" },
  );
}

/** Somewhere to put a file a run will read (FR-14): a URL to PUT it to. */
export function openUpload(
  workspaceId: string,
  body: OpenUploadRequest,
): Promise<UploadTicket> {
  return platformServerJson<UploadTicket>(`${scope(workspaceId)}/uploads`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** The store's measurement of what arrived, as a file a run can be given. */
export async function completeUpload(
  workspaceId: string,
  uploadSessionId: string,
): Promise<UploadedFile> {
  const response = await platformServerJson<CompleteUploadResponse>(
    `${scope(workspaceId)}/uploads/${encodeURIComponent(uploadSessionId)}/complete`,
    { method: "POST", body: "{}" },
  );
  return response.artifact;
}

/** The key is the caller's: a resubmitted run form must reuse its own. */
export function createRun(
  workspaceId: string,
  body: CreateRunRequest,
  idempotencyKey: string,
): Promise<CreateRunResponse> {
  return platformServerJson<CreateRunResponse>(`${scope(workspaceId)}/runs`, {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey,
  });
}

/** Only a `pending` or `running` run can be cancelled; any other answers 404. */
export function cancelRun(
  workspaceId: string,
  runId: string,
): Promise<CancelRunResponse> {
  return platformServerJson<CancelRunResponse>(
    `${scope(workspaceId)}/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST", idempotencyKey: newIdempotencyKey("cancel") },
  );
}

export function decideApproval(
  workspaceId: string,
  approvalId: string,
  body: DecideApprovalRequest,
): Promise<DecideApprovalResponse> {
  return platformServerJson<DecideApprovalResponse>(
    `${scope(workspaceId)}/approvals/${encodeURIComponent(approvalId)}/decision`,
    {
      method: "POST",
      // Only the decision. The actor and their role come from the session —
      // sending actorRole is refused as an unsupported field.
      body: JSON.stringify(body),
      idempotencyKey: newIdempotencyKey("decision"),
    },
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

/** A day, as Archived flows says it ("Sep 30, 2026"); fixed as `formatWhen` is. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
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
