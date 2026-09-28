/**
 * Loopback-only public Edge fixture for browser contract tests.
 *
 * This is deliberately not an application route or an Access substitute. It
 * speaks just enough of the published public API for the website's production
 * server path to be exercised without a database, identity provider, or cloud
 * account. Unknown routes fail closed with 501.
 */
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import type { components as PlatformSchemas } from "../../lib/generated/platform-contracts/platform";
import type {
  components as AutomationSchemas,
  operations as AutomationOperations,
} from "../../lib/generated/platform-contracts/automations";
import type {
  components as ConnectionSchemas,
  operations as ConnectionOperations,
} from "../../lib/generated/platform-contracts/connections";

const port = Number(process.env.FIXTURE_EDGE_PORT ?? "3443");
const certificate = process.env.FIXTURE_EDGE_CERT;
const privateKey = process.env.FIXTURE_EDGE_KEY;
if (!certificate || !privateKey) {
  throw new Error("FIXTURE_EDGE_CERT and FIXTURE_EDGE_KEY are required");
}

const fixtureCookie = "e2e-public-edge-session";
const now = "2026-08-12T12:00:00.000Z";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const requesterUserId = "66666666-6666-4666-8666-666666666666";
const memberUserId = "77777777-7777-4777-8777-777777777777";
const projectId = "33333333-3333-4333-8333-333333333333";
const joinRequestId = "44444444-4444-4444-8444-444444444444";
const domainId = "55555555-5555-4555-8555-555555555555";

type Json = Record<string, unknown>;
type Platform = PlatformSchemas["schemas"];
type Automations = AutomationSchemas["schemas"];
type Connections = ConnectionSchemas["schemas"];

const workspace = {
  id: workspaceId,
  name: "Fixture Organization",
  type: "organization",
  role: "owner",
} satisfies Platform["WorkspaceSummary"];

const personalWorkspaceId = "88888888-8888-4888-8888-888888888888";

const personalWorkspace = {
  id: personalWorkspaceId,
  name: "Fixture Personal",
  type: "personal",
  role: "owner",
} satisfies Platform["WorkspaceSummary"];

// A plain member of the organization: sees the workspace, may not see its
// billing. The role is what the server's owner-or-admin gate reads.
const memberWorkspace = {
  ...workspace,
  role: "member",
} satisfies Platform["WorkspaceSummary"];

// The switcher test moves this and moves it back; the organization tests rely
// on the organization being active, so state must be restored in-test.
let activeWorkspaceId: string = workspaceId;

const session = {
  authenticated: true,
  user: {
    userId,
    email: "owner@example.test",
    displayName: "Fixture Owner",
    activeWorkspaceId: workspaceId,
  },
  workspaces: [workspace],
} satisfies Platform["SessionResponse"];

const requesterSession = {
  authenticated: true,
  user: {
    userId: requesterUserId,
    email: "requester@example.test",
    displayName: "Fixture Requester",
  },
  workspaces: [],
} satisfies Platform["SessionResponse"];

const project = {
  id: projectId,
  workspaceId,
  name: "Fixture Project",
  type: "general",
  status: "active",
  viewerRole: "owner",
  createdAt: now,
} satisfies Platform["ProjectSummary"];

const domain = {
  id: domainId,
  workspaceId,
  domain: "example.test",
  registrableDomain: "example.test",
  status: "verified",
  joinPolicy: "approval",
  discoveryEnabled: true,
  verificationRecordName: "_autom8x.example.test",
  verifiedAt: now,
  createdAt: now,
} satisfies Platform["OrganizationDomain"];

let joinRequest: Platform["OrganizationJoinRequest"] = {
  id: joinRequestId,
  workspaceId,
  userId: requesterUserId,
  status: "pending",
  createdAt: now,
} satisfies Platform["OrganizationJoinRequest"];

const keyProvider = {
  providerId: "fixture-key",
  displayName: "Fixture key provider",
  description: "A loopback API-key provider for contract tests.",
  icon: "key",
  scopes: [],
  authType: "api-key",
  credentialFields: [
    { name: "apiKey", label: "API key", secret: true, help: "Fixture value." },
  ],
} satisfies Connections["ConnectionProvider"];

const connection = {
  id: "77777777-7777-4777-8777-777777777777",
  providerId: keyProvider.providerId,
  workspaceId,
  externalAccount: {
    id: "fixture-account",
    displayName: "Fixture account",
  },
  status: "connected",
  requiredScopes: [],
  grantedScopes: [],
  usedByCount: 0,
} satisfies Connections["Connection"];

const automation = (templateId: string, name: string) =>
  ({
    templateId,
    version: 1,
    name,
    description: "Minimal public contract fixture.",
    category: "Operations",
    icon: "gear",
    monthlyPriceUsd: 0,
    subscribed: false,
    available: true,
    setup: [],
    pipeline: [
      {
        id: "trigger",
        kicker: "TRIGGER",
        title: "Fixture trigger",
        description: "Starts the fixture pipeline.",
      },
    ],
  }) satisfies Automations["AutomationCatalogEntry"];

// An automation with two fixed runs, mirroring the shipped invoice-check: one
// failed with the automation's own reason, one succeeded with its summary.
// It is subscribed and live, and its pinned version declares run input, so its
// card offers Run (backend ADR-0030) and Activity lists both runs.
const manualAutomation = {
  ...automation("fixture-manual-input", "Manual input automation"),
  subscribed: true,
  // One setting, so the Set up dialog is reachable in this harness (register
  // F49) and a refused save can be observed keeping what was typed.
  setup: [
    {
      section: "rules",
      key: "holdAboveAmount",
      title: "Spending limit",
      description: "Runs above this amount wait for approval.",
      control: "money",
      defaultValue: 500,
      required: true,
    },
  ],
} satisfies Automations["AutomationCatalogEntry"];

// Live, and its pinned version declares no run input: the card offers Pause and
// Archive and no Run. Archiving it (backend §12.1 #169) is one-way, so the
// fixture forgets the subscription and the card offers Add again — state that,
// like billing's, lives for one fixture process.
const archivableAutomation = automation(
  "fixture-archivable",
  "Archivable automation",
);
let archivableArchived = false;

function fixtureCatalog(): Automations["AutomationCatalogResponse"] {
  return {
    automations: [
      automation("fixture-plan-limit", "Plan-limit automation"),
      automation("fixture-entitlements", "Entitlements automation"),
      manualAutomation,
      { ...archivableAutomation, subscribed: !archivableArchived },
    ],
    categories: ["All", "Operations"],
  };
}

const manualSubscriptionId = "99999999-9999-4999-8999-999999999999";
const manualSubscription = {
  id: manualSubscriptionId,
  workspaceId,
  templateId: "fixture-manual-input",
  templateVersion: 1,
  status: "live",
  config: {},
  unmetConnections: [],
  // The shipped invoice-check v4's declaration (backend ADR-0030): three typed
  // fields its container requires, and a file it reads when given one — which no
  // web form supplies, so the website does not render it.
  runInput: [
    {
      key: "vendor",
      title: "Vendor",
      description: "Who sent the invoice.",
      control: "text",
      required: true,
    },
    {
      key: "amount",
      title: "Amount",
      description: "The invoice total.",
      control: "money",
      required: true,
    },
    {
      key: "reference",
      title: "Invoice reference",
      description: "The invoice number, as printed on it.",
      control: "text",
      required: true,
    },
    {
      key: "artifactId",
      title: "Invoice file",
      description: "A file already uploaded for this run.",
      control: "artifact",
      required: false,
    },
  ],
  // Required since the contract gained attribution (backend 18.6.1/18.6.2):
  // workspace-wide, so no project; created by the fixture owner.
  projectId: null,
  createdByUserId: userId,
  createdAt: now,
  updatedAt: now,
} satisfies Automations["Subscription"];

const archivableSubscriptionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const archivableSubscription = {
  ...manualSubscription,
  id: archivableSubscriptionId,
  templateId: archivableAutomation.templateId,
  runInput: undefined,
} satisfies Automations["Subscription"];

// Run ids encode the outcome so the reads are deterministic without any
// mutable server state: the failed run carries the automation's own reason,
// the succeeded one its summary. Both started from their trigger, as every
// run does now that nothing offers a manual start.
const okRunId = "fixture-run-ok";
const failedRunId = "fixture-run-failed";
// The run a person starts from the Run form; the fixture creates it only when
// the input is exactly what the declaration asks for, typed as it says.
const startedRunId = "fixture-run-started";
const runInputFailure = "input must carry vendor, amount, and reference";

// One deterministic run by id: the failed one carries the automation's own
// reason, the succeeded one its summary. Listed by Activity and read by its
// page, so both handlers describe the same run.
function fixtureRun(runId: string): Automations["Run"] {
  const failed = runId === failedRunId;
  return {
    id: runId,
    workspaceId,
    subscriptionId: manualSubscriptionId,
    templateId: "fixture-manual-input",
    templateVersion: 1,
    status: failed ? "failed" : "succeeded",
    origin: runId === startedRunId ? "manual" : "trigger",
    rootRunId: runId,
    requestId: "fixture-request",
    ...(failed
      ? { failureReason: runInputFailure }
      : { resultSummary: "Recorded the invoice and emailed the summary." }),
    startedAt: now,
    endedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

let connectionAttemptKey: string | null = null;
let fixtureConnectionCreated = false;
let exportCount = 0;

// Billing (ADR-0025): the free floor never appears in the plan list, and a
// workspace that has never paid reports the free plan with no status. A
// checkout makes the bought plan `active` — the fixture's stand-in for the
// provider webhook that does it in production. Nothing in the published API
// restores it (like the connection and export state above, it lives for one
// fixture process), so the billing tests order their own steps. Two plans, so
// that a live subscription offering no second checkout is observable.
// Team carries the provider's price (backend ADR-0031) and both capabilities the
// production plans grant; Pro has no price — the provider could not state one
// flat figure — and a capability the website has no words for, which it must
// not print as a raw key.
const teamPlan = {
  planId: "fixture-team",
  displayName: "Team",
  capabilities: { "automation.subscribe": 10, "workspace.rate": 120 },
  price: { amount: 500, currency: "usd", interval: "month" },
} satisfies Platform["PurchasablePlan"];
const proPlan = {
  planId: "fixture-pro",
  displayName: "Pro",
  capabilities: { "automation.subscribe": 50, "fixture.unlabelled": 7 },
} satisfies Platform["PurchasablePlan"];
let subscribedPlan: Platform["PurchasablePlan"] | null = null;
const hostedExpiry = "2026-08-12T12:30:00.000Z";

function problem(status: number, title: string, details?: Json): Json {
  return {
    type: "about:blank",
    title,
    status,
    detail: title,
    instance: "/fixture",
    code: `fixture_${status}`,
    requestId: "fixture-request",
    ...(details ? { details } : {}),
  } satisfies Platform["ApiProblem"];
}

// A requester whose account deletion runs and whose answer is then lost on the
// way back — the case only a real hop can show. Until its deletion runs it IS
// the requester; afterwards its session went with the account, so every request
// meets the unauthenticated 401, as the Edge's would.
const departingSession = `${fixtureCookie}=departing`;
let departed = false;

function fixtureCookieEntry(cookie: string | undefined) {
  return cookie
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${fixtureCookie}=`));
}

function fixtureSessionValue(
  cookie: string | undefined,
): "owner" | "requester" | "member" | "throttled" | "failing" | null {
  const value = fixtureCookieEntry(cookie);
  if (value === `${fixtureCookie}=owner`) return "owner";
  // The owner, whose billing read alone fails — the page-level boundary's case.
  if (value === `${fixtureCookie}=page-failing`) return "owner";
  if (value === `${fixtureCookie}=throttled`) return "throttled";
  if (value === `${fixtureCookie}=failing`) return "failing";
  if (value === `${fixtureCookie}=requester`) return "requester";
  if (value === `${fixtureCookie}=member`) return "member";
  if (value === departingSession) return departed ? null : "requester";
  return null;
}

function respond(
  response: import("node:http").ServerResponse,
  status: number,
  body: Json,
) {
  response.writeHead(status, {
    "content-type":
      status >= 400 ? "application/problem+json" : "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function isWorkspacePath(pathname: string, suffix: string): boolean {
  return pathname === `/v1/workspaces/${workspaceId}${suffix}`;
}

async function requestJson(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Json) : {};
}

const server = createServer(
  { cert: readFileSync(certificate), key: readFileSync(privateKey) },
  async (request, response) => {
    const url = new URL(request.url ?? "/", `https://127.0.0.1:${port}`);
    if (url.pathname === "/health/live") {
      respond(response, 200, {
        status: "ok",
        service: "fixture-edge",
        version: "1",
      });
      return;
    }
    // Public, as the Edge serves it: no session is needed to list the ways in,
    // and the website reads it on the server with no cookie (§12.1 #160).
    if (request.method === "GET" && url.pathname === "/v1/auth/providers") {
      const providers = {
        providers: [{ id: "google", label: "Google" }],
        passwordLoginEnabled: false,
        magicLinkLoginEnabled: false,
      } satisfies Platform["LoginProvidersResponse"];
      return respond(response, 200, providers);
    }
    const fixtureSession = fixtureSessionValue(request.headers.cookie);
    if (!fixtureSession) {
      respond(response, 401, problem(401, "Authentication is required"));
      return;
    }
    // A signed-in person the platform refuses (429) or cannot answer (503) —
    // backend §12.1 #160. Neither is "no session", and the website must not
    // read either as a sign-out. The refusal meets the session read itself;
    // the failure lets the session through and meets the reads after it.
    if (fixtureSession === "throttled") {
      response.setHeader("retry-after", "30");
      return respond(response, 429, problem(429, "Too Many Requests"));
    }
    if (fixtureSession === "failing" && url.pathname !== "/v1/session") {
      return respond(response, 503, problem(503, "Service Unavailable"));
    }

    const { pathname } = url;
    const method = request.method ?? "GET";
    // Mirror of the Edge's enforceSameOriginForCookieRequest: a cookie-carrying
    // mutation must name the public web origin. Every server-action mutation in
    // the suite regresses to this 403 if the web stops forwarding Origin.
    if (
      request.headers.cookie &&
      method !== "GET" &&
      method !== "HEAD" &&
      request.headers.origin !== "http://127.0.0.1:3001"
    ) {
      return respond(
        response,
        403,
        problem(403, "Request origin is not allowed"),
      );
    }
    if (method === "POST" && pathname === "/v1/auth/logout") {
      // Clearing the cookie travels back through the /api/platform rewrite,
      // so the browser's next session read is genuinely signed out.
      response.writeHead(204, {
        "set-cookie": `${fixtureCookie}=; Path=/; Max-Age=0`,
        "cache-control": "no-store",
      });
      return response.end();
    }
    if (method === "GET" && pathname === "/v1/session") {
      const ownerSession = {
        ...session,
        user: { ...session.user, activeWorkspaceId },
        workspaces: [workspace, personalWorkspace],
      } satisfies Platform["SessionResponse"];
      const memberSession = {
        authenticated: true,
        user: {
          userId: memberUserId,
          email: "member@example.test",
          displayName: "Fixture Member",
          activeWorkspaceId: workspaceId,
        },
        workspaces: [memberWorkspace],
      } satisfies Platform["SessionResponse"];
      return respond(
        response,
        200,
        fixtureSession === "owner"
          ? ownerSession
          : fixtureSession === "member"
            ? memberSession
            : requesterSession,
      );
    }
    if (method === "PATCH" && pathname === "/v1/session/active-workspace") {
      const body = (await requestJson(request)) as { workspaceId?: string };
      if (
        body.workspaceId !== workspaceId &&
        body.workspaceId !== personalWorkspaceId
      ) {
        return respond(response, 404, {
          type: "about:blank",
          title: "Not Found",
          status: 404,
        });
      }
      activeWorkspaceId = body.workspaceId;
      return respond(response, 200, {
        activeWorkspaceId,
      } satisfies Platform["ActiveWorkspaceResponse"]);
    }
    if (method === "GET" && pathname === "/v1/auth/identities")
      return respond(response, 200, { identities: [] });
    if (method === "GET" && pathname === "/v1/workspaces") {
      const workspaces =
        fixtureSession === "owner"
          ? [workspace, personalWorkspace]
          : fixtureSession === "member"
            ? [memberWorkspace]
            : [];
      return respond(response, 200, {
        workspaces,
        ...(fixtureSession === "requester" ? {} : { activeWorkspaceId }),
      } satisfies Platform["WorkspaceListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/projects")) {
      return respond(response, 200, {
        projects: [project],
      } satisfies Platform["ProjectListResponse"]);
    }
    if (
      method === "GET" &&
      pathname === `/v1/workspaces/${personalWorkspaceId}/projects`
    ) {
      return respond(response, 200, {
        projects: [],
      } satisfies Platform["ProjectListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/members")) {
      return respond(response, 200, {
        members: [
          {
            workspaceId,
            userId,
            role: "owner",
            displayName: "Fixture Owner",
            email: "owner@example.test",
            createdAt: now,
          },
        ],
      } satisfies Platform["WorkspaceMemberListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/domains")) {
      return respond(response, 200, {
        domains: [domain],
      } satisfies Platform["OrganizationDomainListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/join-requests")) {
      return respond(response, 200, {
        requests: [joinRequest],
      } satisfies Platform["OrganizationJoinRequestListResponse"]);
    }
    if (
      method === "PATCH" &&
      pathname ===
        `/v1/workspaces/${workspaceId}/join-requests/${joinRequestId}`
    ) {
      joinRequest = {
        ...joinRequest,
        status: "approved",
        decidedAt: now,
        decidedByUserId: userId,
      };
      return respond(response, 200, {
        request: joinRequest,
      } satisfies Platform["OrganizationJoinRequestMutationResponse"]);
    }
    if (method === "GET" && pathname === "/v1/organization-discovery") {
      return respond(response, 200, {
        organizations: [
          {
            workspaceId,
            name: workspace.name,
            domain: domain.domain,
            joinPolicy: "approval",
            membershipState: "none",
          },
        ],
      } satisfies Platform["OrganizationDiscoveryResponse"]);
    }
    if (
      method === "POST" &&
      pathname === `/v1/organizations/${workspaceId}/join`
    ) {
      return respond(response, 200, {
        outcome: "requested",
        workspaceId,
        request: joinRequest,
      } satisfies Platform["OrganizationJoinResponse"]);
    }
    if (method === "GET" && pathname === "/v1/connections/providers") {
      return respond(response, 200, {
        providers: [keyProvider],
      } satisfies ConnectionOperations["listConnectionProviders"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/connections")) {
      return respond(response, 200, {
        connections: fixtureConnectionCreated ? [connection] : [],
      } satisfies ConnectionOperations["listConnections"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "POST" && isWorkspacePath(pathname, "/connections/key")) {
      const rawIdempotencyKey = request.headers["idempotency-key"];
      const idempotencyKey = Array.isArray(rawIdempotencyKey)
        ? rawIdempotencyKey[0]
        : rawIdempotencyKey;
      if (!idempotencyKey) {
        return respond(
          response,
          400,
          problem(400, "An Idempotency-Key header is required"),
        );
      }
      if (!connectionAttemptKey) {
        connectionAttemptKey = idempotencyKey;
        return respond(
          response,
          409,
          problem(409, "Connection verification is still in progress"),
        );
      }
      if (idempotencyKey !== connectionAttemptKey) {
        return respond(
          response,
          409,
          problem(409, "Retry must use the original idempotency key"),
        );
      }
      fixtureConnectionCreated = true;
      return respond(response, 201, {
        connection,
      } satisfies ConnectionOperations["connectProviderWithKey"]["responses"][201]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/automations")) {
      return respond(response, 200, fixtureCatalog());
    }
    if (method === "GET" && isWorkspacePath(pathname, "/subscriptions")) {
      return respond(response, 200, {
        subscriptions: archivableArchived
          ? [manualSubscription]
          : [manualSubscription, archivableSubscription],
      } satisfies AutomationOperations["listSubscriptions"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "PATCH" &&
      isWorkspacePath(pathname, `/subscriptions/${manualSubscriptionId}`)
    ) {
      // Only a set-up save, holding the one declared setting to its control's
      // type, as the catalog does; the saved value is not kept.
      const body = (await requestJson(request)) as { config?: Json };
      const config = body.config;
      if (
        !request.headers["idempotency-key"] ||
        !config ||
        Object.keys(config).join() !== "holdAboveAmount" ||
        typeof config.holdAboveAmount !== "number"
      ) {
        return respond(
          response,
          422,
          problem(422, "The request could not be processed"),
        );
      }
      return respond(response, 200, {
        subscription: { ...manualSubscription, config },
      } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "PATCH" &&
      isWorkspacePath(pathname, `/subscriptions/${archivableSubscriptionId}`)
    ) {
      // Only the archive this suite drives (§12.1 #169): anything else is an
      // undeclared use of this route and fails closed.
      const body = (await requestJson(request)) as { status?: string };
      if (body.status !== "archived" || !request.headers["idempotency-key"]) {
        return respond(
          response,
          422,
          problem(422, "Undeclared fixture subscription update"),
        );
      }
      archivableArchived = true;
      return respond(response, 200, {
        subscription: { ...archivableSubscription, status: "archived" },
      } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "POST" && isWorkspacePath(pathname, "/subscriptions")) {
      const body = (await requestJson(request)) as { templateId?: string };
      const reason =
        body.templateId === "fixture-plan-limit"
          ? "over_plan_limit"
          : "entitlements_not_configured";
      return respond(
        response,
        403,
        problem(403, "Subscription cannot be created", { reason }),
      );
    }
    if (method === "POST" && isWorkspacePath(pathname, "/runs")) {
      // createRun as ADR-0030 holds it: the input must be exactly the pinned
      // declaration, typed as it says — a number for money, not a string — or
      // the platform answers 422 and nothing runs. The file field is optional
      // and the website supplies none.
      const body = (await requestJson(request)) as {
        subscriptionId?: string;
        input?: Json;
      };
      const input = body.input ?? {};
      const exact =
        body.subscriptionId === manualSubscriptionId &&
        Object.keys(input).sort().join() === "amount,reference,vendor" &&
        typeof input.vendor === "string" &&
        typeof input.amount === "number" &&
        typeof input.reference === "string";
      if (!request.headers["idempotency-key"] || !exact) {
        return respond(
          response,
          422,
          problem(422, "The request could not be processed"),
        );
      }
      return respond(response, 201, {
        run: { ...fixtureRun(startedRunId), status: "pending" },
      } satisfies AutomationOperations["createRun"]["responses"][201]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/runs")) {
      // Both deterministic runs, so Activity renders rows and the run pages are
      // reached by a person rather than typed.
      return respond(response, 200, {
        runs: [fixtureRun(failedRunId), fixtureRun(okRunId)],
      } satisfies AutomationOperations["listRuns"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "GET" &&
      pathname.startsWith(`/v1/workspaces/${workspaceId}/runs/`)
    ) {
      const runId = decodeURIComponent(
        pathname.slice(`/v1/workspaces/${workspaceId}/runs/`.length),
      );
      const run = fixtureRun(runId);
      const failed = run.status === "failed";
      const steps = [
        {
          id: "fixture-step-1",
          runId,
          workspaceId,
          stepId: "validate-input",
          outcome: failed ? "failed" : "ok",
          summary: failed ? runInputFailure : "Input validated.",
          occurredAt: now,
        },
      ] satisfies Automations["RunStep"][];
      return respond(response, 200, {
        run,
        steps,
        events: [],
      } satisfies AutomationOperations["readRun"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/approvals")) {
      return respond(response, 200, {
        approvals: [],
      } satisfies AutomationOperations["listApprovals"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && pathname === "/v1/plans") {
      // Any signed-in person may read the plan list; the free floor is never
      // on it (a plan with no provider price is omitted).
      const body = {
        plans: [teamPlan, proPlan],
      } satisfies Platform["PlanListResponse"];
      return respond(response, 200, body);
    }
    if (
      pathname === `/v1/workspaces/${workspaceId}/billing` ||
      pathname.startsWith(`/v1/workspaces/${workspaceId}/billing/`)
    ) {
      // Owner or admin for the workspace's billing, its checkout and its
      // portal, as the Edge enforces (billing-routes.ts): a member is refused.
      if (fixtureSession !== "owner") {
        return respond(
          response,
          403,
          problem(403, "Billing requires an admin", { requiredRole: "admin" }),
        );
      }
    }
    if (method === "GET" && isWorkspacePath(pathname, "/billing")) {
      if (
        fixtureCookieEntry(request.headers.cookie) ===
        `${fixtureCookie}=page-failing`
      ) {
        return respond(response, 500, problem(500, "Internal Server Error"));
      }
      const body = subscribedPlan
        ? ({
            workspaceId,
            planId: subscribedPlan.planId,
            displayName: subscribedPlan.displayName,
            status: "active",
            currentPeriodEnd: "2026-09-12T12:00:00.000Z",
            cancelAtPeriodEnd: false,
          } satisfies Platform["WorkspaceBillingResponse"])
        : ({
            workspaceId,
            planId: "fixture-free",
            displayName: "Free",
          } satisfies Platform["WorkspaceBillingResponse"]);
      return respond(response, 200, body);
    }
    if (method === "POST" && isWorkspacePath(pathname, "/billing/checkout")) {
      const body = (await requestJson(request)) as { planId?: string };
      const plan = [teamPlan, proPlan].find(
        (candidate) => candidate.planId === body.planId,
      );
      // The Edge answers 404 for a plan that is not purchasable.
      if (!plan) {
        return respond(
          response,
          404,
          problem(404, "The plan is not purchasable"),
        );
      }
      subscribedPlan = plan;
      return respond(response, 201, {
        url: "https://billing.invalid/checkout/fixture-session",
        expiresAt: hostedExpiry,
      } satisfies Platform["HostedBillingSession"]);
    }
    if (method === "POST" && isWorkspacePath(pathname, "/billing/portal")) {
      await requestJson(request);
      // No billing account yet answers 409: the client sends the person to
      // checkout rather than showing a conflict.
      if (!subscribedPlan) {
        return respond(
          response,
          409,
          problem(409, "The workspace has no billing account yet"),
        );
      }
      return respond(response, 201, {
        url: "https://billing.invalid/portal/fixture-session",
        expiresAt: hostedExpiry,
      } satisfies Platform["HostedBillingSession"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/export")) {
      exportCount += 1;
      const complete = exportCount % 2 === 1;
      const body = {
        workspaceId,
        exportedAt: now,
        complete,
        services: [
          {
            service: "access",
            ok: true,
            data: {
              workspace: null,
              members: [],
              projects: [],
              teams: [],
              domains: [],
              truncated: !complete,
            },
          },
        ],
      } satisfies Platform["WorkspaceExportResponse"];
      return respond(response, 200, body);
    }
    if (method === "DELETE" && pathname === "/v1/account") {
      // The departing session: the deletion runs, then the answer is lost —
      // the connection drops before a status line is written. Nothing in the
      // browser can fake this; it is the website's own rewrite that meets it.
      if (fixtureCookieEntry(request.headers.cookie) === departingSession) {
        departed = true;
        response.socket?.destroy();
        return;
      }
      // ADR-0028: per workspace, not all-or-nothing. The owner's organization
      // refuses (a service could not remove it) and the answer is the Edge's
      // RAW 409 body — `application/json`, no `title` — exactly as apps/api
      // relays it and, since backend §12.1 #164, as the contract publishes it
      // (`AccountDeletionResult`), so the client's status-only branch meets the
      // real shape. The org-less requester deletes cleanly.
      if (fixtureSession === "owner") {
        response.writeHead(409, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        return response.end(
          JSON.stringify({
            deleted: false,
            workspaces: [
              {
                workspaceId: personalWorkspaceId,
                type: "personal",
                complete: true,
                services: [],
              },
              {
                workspaceId,
                type: "organization",
                complete: false,
                services: [
                  { service: "entitlements", ok: false, reason: "unreachable" },
                  {
                    service: "connections",
                    ok: false,
                    reason: "not_attempted",
                  },
                ],
              },
            ],
            reason: "a service could not remove this workspace",
          } satisfies Platform["AccountDeletionResult"]),
        );
      }
      return respond(response, 200, {});
    }
    respond(
      response,
      501,
      problem(501, `Undeclared fixture route: ${method} ${pathname}`),
    );
  },
);

server.listen(port, "127.0.0.1", () =>
  console.log(`fixture edge listening on ${port}`),
);
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
