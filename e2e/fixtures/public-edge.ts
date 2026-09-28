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
const adminUserId = "12121212-1212-4121-8121-121212121212";
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

// An admin of the organization: everything its owner may do there except what
// ownership alone allows.
const adminWorkspace = {
  ...workspace,
  role: "admin",
} satisfies Platform["WorkspaceSummary"];

// The organization's people, as its member list reads them.
const organizationMembers = [
  {
    workspaceId,
    userId,
    role: "owner",
    displayName: "Fixture Owner",
    email: "owner@example.test",
    createdAt: now,
  },
  {
    workspaceId,
    userId: adminUserId,
    role: "admin",
    displayName: "Fixture Admin",
    email: "admin@example.test",
    createdAt: now,
  },
  {
    workspaceId,
    userId: memberUserId,
    role: "member",
    displayName: "Fixture Member",
    email: "member@example.test",
    createdAt: now,
  },
] satisfies Platform["WorkspaceMember"][];

// One team, managed by the plain member — the case that needs teams to have a
// page of their own (backend ADR-0010).
const operationsTeamId = "abababab-abab-4bab-8bab-abababababab";

/**
 * Everything a test can change, in one place, reset by `POST /__fixture/reset`
 * before each test (register F30, F48) — so no test depends on the order the
 * suite runs in, and one can run twice against one fixture process. The route is
 * the fixture's own: it is not part of the published API and the website never
 * calls it.
 */
function initialState() {
  return {
    activeWorkspaceId: workspaceId as string,
    joinRequestStatus: "pending" as "pending" | "approved",
    archivableArchived: false,
    manualStatus: "live" as "live" | "paused",
    connectionAttemptKey: null as string | null,
    fixtureConnectionCreated: false,
    exportCount: 0,
    // Per workspace, so a personal workspace has billing of its own (F31).
    subscribedPlan: new Map<string, Platform["PurchasablePlan"]>(),
    departed: false,
    runningCancelled: false,
    // Scopes the project automation was added to: a project id, or null for
    // the whole workspace.
    projectAutomationScopes: [] as (string | null)[],
    // The OAuth connection's id — changed when another admin is said to have
    // replaced it — and whether its grant still works.
    oauthConnectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    oauthStatus: "connected" as "connected" | "reauthorization-required",
    // The run tally the dashboard reads, when the platform cannot answer it.
    runStatsFailing: false,
    teams: [
      {
        id: operationsTeamId,
        workspaceId,
        name: "Operations",
        description: "Runs the invoice automations.",
        status: "active",
        createdAt: now,
      },
    ] as Platform["TeamSummary"][],
    teamMemberships: [
      {
        teamId: operationsTeamId,
        workspaceId,
        userId: memberUserId,
        role: "manager",
        createdAt: now,
      },
    ] as Platform["TeamMembershipSummary"][],
    projectTeamGrants: [] as Platform["ProjectTeamGrantSummary"][],
    // Whether the organization lists its fixture project, and the projects a
    // test created — so an organization can be new, with none (register F57).
    fixtureProjectListed: true,
    createdProjects: [] as Platform["ProjectSummary"][],
    // FR-14: upload sessions the website opened, and the bytes each received.
    uploads: new Map<
      string,
      {
        filename: string;
        contentType: string;
        sizeBytes: number;
        received?: number;
      }
    >(),
    // Files completed, by id; a run may be given one once.
    files: new Map<
      string,
      { filename: string; sizeBytes: number; runId?: string }
    >(),
    // Backend §12.1 #126: the version the webhook automation's subscription
    // pins, and whether an approval still waits on it.
    webhookVersion: 1,
    approvalPendingOnMove: false,
    // Backend §12.1 #91: the address once issued, and how many secrets so far.
    webhookSecrets: 0,
    // Backend §12.1 #39: the complete export, read as running once then ready.
    exportJobReads: 0,
    exportJobStarted: false,
    exportExpired: false,
    // Register F60 and F62's run-time path: a session the fixture ends on a
    // schedule — once the layout has read it, or once the proxy has.
    sessionEnded: false,
    proxyReads: 0,
    // The surfaces the Round 14 change audit probed and no test asserted
    // (register § Round 15), each a state one test puts the platform in.
    runsRead: "listed" as "listed" | "failing" | "empty",
    workspaceListReads: 0,
    replaceAnswersReused: false,
    oauthDisconnected: false,
    approvals: [] as Automations["Approval"][],
    billingNotConfigured: false,
    discoveryFailing: false,
    notReady: false,
    draftNeedsConnection: false,
    memberOwnsProject: false,
  };
}
let state = initialState();

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

function joinRequest(): Platform["OrganizationJoinRequest"] {
  return state.joinRequestStatus === "approved"
    ? {
        id: joinRequestId,
        workspaceId,
        userId: requesterUserId,
        status: "approved",
        createdAt: now,
        decidedAt: now,
        decidedByUserId: userId,
      }
    : {
        id: joinRequestId,
        workspaceId,
        userId: requesterUserId,
        status: "pending",
        createdAt: now,
      };
}

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

// An OAuth provider the workspace is already connected to: the account a
// Reconnect keeps and Replace account swaps (backend ADR-0019 §4, ADR-0026).
const oauthProvider = {
  providerId: "fixture-oauth",
  displayName: "Fixture OAuth provider",
  description: "A loopback OAuth provider for contract tests.",
  icon: "link",
  scopes: ["fixture.read"],
  authType: "oauth2",
} satisfies Connections["ConnectionProvider"];

function oauthConnectionState(): Connections["ConnectionState"] {
  return {
    id: state.oauthConnectionId,
    providerId: oauthProvider.providerId,
    workspaceId,
    externalAccount: {
      id: "fixture-oauth-account",
      displayName: "Fixture OAuth account",
    },
    status: state.oauthStatus,
    requiredScopes: ["fixture.read"],
    grantedScopes: ["fixture.read"],
    authorizedByUserId: userId,
    ...(state.oauthStatus === "reauthorization-required"
      ? { errorCode: "invalid_grant" }
      : {}),
  };
}

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
    // A notifications switch: the manifest allows `notifies` only on a toggle
    // in the `notifications` section, and the website says what it switches
    // in words (register F22).
    {
      section: "notifications",
      key: "notifyOnFailure",
      title: "Failure notices",
      description: "Tell the workspace when this automation fails.",
      control: "toggle",
      defaultValue: true,
      required: false,
      notifies: "run-failed",
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

// Accepts an Add to the whole workspace or to the fixture project — the path a
// project-scoped subscription is created on (backend 18.6.2).
const projectAutomation = automation("fixture-projects", "Project automation");

// Started by a vendor's webhook, and the catalog's newest is v2 while the
// subscription still pins v1: the card offers Move (backend §12.1 #126) and,
// to an owner or admin, the webhook address (§12.1 #91).
const webhookAutomation = {
  ...automation("fixture-webhook", "Webhook automation"),
  version: 2,
  subscribed: true,
} satisfies Automations["AutomationCatalogEntry"];

const webhookSubscriptionId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
const webhookEndpointId = "efefefef-efef-4fef-8fef-efefefefefef";
const exportJobId = "f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0";

function webhookSubscription(): Automations["Subscription"] {
  return {
    ...manualSubscription,
    id: webhookSubscriptionId,
    templateId: webhookAutomation.templateId,
    templateVersion: state.webhookVersion,
    triggerKind: "webhook",
    runInput: undefined,
  };
}

function fixtureCatalog(): Automations["AutomationCatalogResponse"] {
  return {
    automations: [
      automation("fixture-plan-limit", "Plan-limit automation"),
      automation("fixture-entitlements", "Entitlements automation"),
      manualAutomation,
      webhookAutomation,
      { ...archivableAutomation, subscribed: !state.archivableArchived },
      {
        ...projectAutomation,
        subscribed: state.projectAutomationScopes.length > 0,
      },
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
  triggerKind: "manual",
  // The shipped invoice-check v4's declaration (backend ADR-0030): three typed
  // fields its container requires, and a file it reads when given one — which
  // the website uploads when a person chooses one (backend FR-14).
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

// The plan-limit automation, already added to the fixture project and still a
// draft: its card lists this row under the project and offers Add for the
// whole workspace only (register F21).
const projectDraftSubscription = {
  ...manualSubscription,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  templateId: "fixture-plan-limit",
  status: "draft",
  runInput: undefined,
  projectId,
} satisfies Automations["Subscription"];

function projectAutomationSubscription(
  scope: string | null,
): Automations["Subscription"] {
  return {
    ...manualSubscription,
    id: scope
      ? "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      : "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    templateId: projectAutomation.templateId,
    status: "draft",
    runInput: undefined,
    projectId: scope,
  };
}

// Run ids encode the outcome so the reads are deterministic without any
// mutable server state: the failed run carries the automation's own reason,
// the succeeded one its summary. Both started from their trigger, as every
// run does now that nothing offers a manual start.
const okRunId = "fixture-run-ok";
const failedRunId = "fixture-run-failed";
// The run a person starts from the Run form; the fixture creates it only when
// the input is exactly what the declaration asks for, typed as it says.
const startedRunId = "fixture-run-started";
// A run still in progress: the one Cancel is offered for, and cancelled for
// the rest of the test once it is (backend `cancelRun`).
const runningRunId = "fixture-run-running";
const runInputFailure = "input must carry vendor, amount, and reference";

// One deterministic run by id: the failed one carries the automation's own
// reason, the succeeded one its summary. Listed by Activity and read by its
// page, so both handlers describe the same run.
function fixtureRun(runId: string): Automations["Run"] {
  const failed = runId === failedRunId;
  if (runId === runningRunId) {
    return {
      id: runId,
      workspaceId,
      subscriptionId: manualSubscriptionId,
      templateId: "fixture-manual-input",
      templateVersion: 1,
      status: state.runningCancelled ? "cancelled" : "running",
      origin: "trigger",
      rootRunId: runId,
      requestId: "fixture-request",
      startedAt: now,
      ...(state.runningCancelled ? { endedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    };
  }
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

const listedRunIds = [runningRunId, failedRunId, okRunId];

// A run held for a person's decision: the running run, at a step only an owner
// or admin may decide, as `invoice-check` holds a payment over its limit.
function waitingApproval(): Automations["Approval"] {
  return {
    id: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0",
    runId: runningRunId,
    workspaceId,
    subscriptionId: manualSubscriptionId,
    stepId: "confirm-payment",
    status: "pending",
    reason: "A payment over the spending limit needs a person to approve it.",
    eligibleRoles: ["owner", "admin"],
    createdAt: now,
    expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  };
}

/** The platform's tally of the listed runs, as `readRunStats` answers it. */
function fixtureRunStats(since: string | null): Automations["RunStats"] {
  const counts = {
    total: 0,
    pending: 0,
    running: 0,
    held: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const runId of listedRunIds) {
    const { status } = fixtureRun(runId);
    counts.total += 1;
    if (status in counts) counts[status as keyof typeof counts] += 1;
  }
  return {
    ...(since ? { since } : {}),
    workspace: counts,
    subscriptions: [{ subscriptionId: manualSubscriptionId, ...counts }],
  };
}

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

function fixtureCookieEntry(cookie: string | undefined) {
  return cookie
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${fixtureCookie}=`));
}

function fixtureSessionValue(
  cookie: string | undefined,
): "owner" | "admin" | "requester" | "member" | "throttled" | "failing" | null {
  const value = fixtureCookieEntry(cookie);
  if (value === `${fixtureCookie}=owner`) return "owner";
  // The owner, whose billing read alone fails — the page-level boundary's case.
  if (value === `${fixtureCookie}=page-failing`) return "owner";
  if (value === `${fixtureCookie}=throttled`) return "throttled";
  if (value === `${fixtureCookie}=failing`) return "failing";
  if (value === `${fixtureCookie}=requester`) return "requester";
  if (value === `${fixtureCookie}=member`) return "member";
  if (value === `${fixtureCookie}=admin`) return "admin";
  if (value === departingSession) return state.departed ? null : "requester";
  // Register F60: the owner, until a page's own read ends the session.
  if (value === `${fixtureCookie}=ending`)
    return state.sessionEnded ? null : "owner";
  // F62's run-time path: the owner for the proxy's session read, and no one
  // for the render that follows it.
  if (value === `${fixtureCookie}=proxy-only`)
    return state.proxyReads > 0 ? null : "owner";
  return null;
}

function projectRoleOf(
  fixtureSession: ReturnType<typeof fixtureSessionValue>,
): Platform["ProjectSummary"]["viewerRole"] | null {
  if (fixtureSession === "owner") return "owner";
  if (fixtureSession === "admin") return "admin";
  // A project's owner who is a plain member of the organization, when a test
  // says so — the one who may grant only a team they are on (§12.1 #176).
  if (fixtureSession === "member")
    return state.memberOwnsProject ? "owner" : "member";
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
    // The fixture's own control, never the published API: each test starts from
    // the same state (register F30, F48).
    if (request.method === "POST" && url.pathname === "/__fixture/reset") {
      state = initialState();
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    // What another admin, or the provider, does between a page's read and a
    // person's click: the OAuth connection replaced (so the page names a stale
    // id), or its grant revoked (so it needs reauthorization).
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/oauth-connection-replaced"
    ) {
      state.oauthConnectionId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/run-stats-failing"
    ) {
      state.runStatsFailing = true;
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    // One state each, for the surfaces the Round 14 change audit probed and no
    // test asserted (register § Round 15).
    const controls: Record<string, () => void> = {
      "/__fixture/runs-failing": () => {
        state.runsRead = "failing";
      },
      "/__fixture/runs-empty": () => {
        state.runsRead = "empty";
      },
      "/__fixture/replace-answers-reused": () => {
        state.replaceAnswersReused = true;
      },
      "/__fixture/approval-waiting": () => {
        state.approvals = [waitingApproval()];
      },
      "/__fixture/billing-not-configured": () => {
        state.billingNotConfigured = true;
      },
      "/__fixture/discovery-failing": () => {
        state.discoveryFailing = true;
      },
      "/__fixture/not-ready": () => {
        state.notReady = true;
      },
      "/__fixture/draft-needs-connection": () => {
        state.draftNeedsConnection = true;
      },
      "/__fixture/member-owns-project": () => {
        state.memberOwnsProject = true;
      },
      "/__fixture/member-plain-on-team": () => {
        state.teamMemberships = state.teamMemberships.map((entry) =>
          entry.userId === memberUserId ? { ...entry, role: "member" } : entry,
        );
      },
    };
    const control =
      request.method === "POST" ? controls[url.pathname] : undefined;
    if (control) {
      control();
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    // Register F27: how many times the workspace list was read.
    if (request.method === "GET" && url.pathname === "/__fixture/counts") {
      return respond(response, 200, {
        workspaceListReads: state.workspaceListReads,
      });
    }
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/org-without-projects"
    ) {
      state.fixtureProjectListed = false;
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/org-without-teams"
    ) {
      state.teams = [];
      state.teamMemberships = [];
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/oauth-connection-broken"
    ) {
      state.oauthStatus = "reauthorization-required";
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    // FR-14: the fixture plays the object store too. The browser PUTs a file
    // here straight from the website's origin — cross-origin, so the preflight
    // is answered for exactly the origin that asked, as the real store answers
    // its configured one. The signed size is the size.
    const storeObject = /^\/__fixture\/objects\/([^/]+)$/u.exec(url.pathname);
    if (storeObject) {
      const origin = request.headers.origin;
      const cors: Record<string, string> = origin
        ? { "access-control-allow-origin": origin, vary: "origin" }
        : {};
      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          ...cors,
          "access-control-allow-methods": "PUT, GET",
          "access-control-allow-headers": "content-type",
        });
        return response.end();
      }
      const upload = state.uploads.get(storeObject[1] ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const size = Buffer.concat(chunks).byteLength;
      if (request.method !== "PUT" || !upload || size !== upload.sizeBytes) {
        response.writeHead(403, cors);
        return response.end();
      }
      upload.received = size;
      response.writeHead(200, { ...cors, "content-type": "application/json" });
      return response.end("{}");
    }
    // FR-14: every completed file and the run it was given to, read by a test
    // at the fixture, because the run's page does not show its input.
    if (request.method === "GET" && url.pathname === "/__fixture/files") {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      return response.end(JSON.stringify([...state.files.values()]));
    }
    // Backend §12.1 #39: the staged file a complete export's link names.
    if (request.method === "GET" && url.pathname === "/__fixture/export-file") {
      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-disposition": 'attachment; filename="workspace-export.json"',
      });
      return response.end(
        JSON.stringify({ format: "autom8x.workspace-export.v1" }),
      );
    }
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/approval-pending-on-move"
    ) {
      state.approvalPendingOnMove = true;
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    if (
      request.method === "POST" &&
      url.pathname === "/__fixture/export-expired"
    ) {
      state.exportExpired = true;
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    // A `Cookie` header carries name=value pairs and nothing else. The website
    // once sent `Set-Cookie` attributes from its server actions (register F51);
    // any request that does is refused here, so every action in the suite
    // fails if it comes back.
    if (
      /(?:^|;)\s*(?:path|expires|max-age|domain|secure|httponly|samesite|partitioned|priority)(?:=|;|$)/iu.test(
        request.headers.cookie ?? "",
      )
    ) {
      return respond(
        response,
        400,
        problem(400, "The Cookie header carries cookie attributes"),
      );
    }
    if (url.pathname === "/health/live") {
      respond(response, 200, {
        status: "ok",
        service: "fixture-edge",
        version: "1",
      });
      return;
    }
    // The Edge's readiness, which the website's `/api/ready` reports.
    if (url.pathname === "/health/ready") {
      return state.notReady
        ? respond(response, 503, { status: "not-ready" })
        : respond(response, 200, { status: "ready" });
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
    const presented = fixtureCookieEntry(request.headers.cookie);
    if (
      presented === `${fixtureCookie}=proxy-only` &&
      url.pathname === "/v1/session"
    ) {
      state.proxyReads += 1;
    }
    if (!fixtureSession) {
      respond(response, 401, problem(401, "Authentication is required"));
      return;
    }
    // Register F60: the layout reads the session and the workspace list; the
    // first read that is the page's own finds the session gone.
    if (
      presented === `${fixtureCookie}=ending` &&
      url.pathname !== "/v1/session" &&
      url.pathname !== "/v1/workspaces"
    ) {
      state.sessionEnded = true;
      return respond(response, 401, problem(401, "Authentication is required"));
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
        user: { ...session.user, activeWorkspaceId: state.activeWorkspaceId },
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
      const adminSession = {
        authenticated: true,
        user: {
          userId: adminUserId,
          email: "admin@example.test",
          displayName: "Fixture Admin",
          activeWorkspaceId: workspaceId,
        },
        workspaces: [adminWorkspace],
      } satisfies Platform["SessionResponse"];
      return respond(
        response,
        200,
        fixtureSession === "owner"
          ? ownerSession
          : fixtureSession === "member"
            ? memberSession
            : fixtureSession === "admin"
              ? adminSession
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
      state.activeWorkspaceId = body.workspaceId;
      return respond(response, 200, {
        activeWorkspaceId: state.activeWorkspaceId,
      } satisfies Platform["ActiveWorkspaceResponse"]);
    }
    if (method === "GET" && pathname === "/v1/auth/identities")
      return respond(response, 200, { identities: [] });
    if (method === "GET" && pathname === "/v1/workspaces") {
      state.workspaceListReads += 1;
      const workspaces =
        fixtureSession === "owner"
          ? [workspace, personalWorkspace]
          : fixtureSession === "member"
            ? [memberWorkspace]
            : fixtureSession === "admin"
              ? [adminWorkspace]
              : [];
      return respond(response, 200, {
        workspaces,
        ...(fixtureSession === "requester"
          ? {}
          : { activeWorkspaceId: state.activeWorkspaceId }),
      } satisfies Platform["WorkspaceListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/projects")) {
      // The role each person holds on the fixture project: its owner, an
      // organization admin (effective admin), or a plain member on it.
      const viewerRole = projectRoleOf(fixtureSession);
      return respond(response, 200, {
        projects: [
          ...(viewerRole && state.fixtureProjectListed
            ? [{ ...project, viewerRole }]
            : []),
          ...state.createdProjects,
        ],
      } satisfies Platform["ProjectListResponse"]);
    }
    // Creating a project in the organization: its creator owns it, as Access
    // records the owner membership in the same transaction.
    if (method === "POST" && isWorkspacePath(pathname, "/projects")) {
      const body = (await requestJson(request)) as {
        name?: string;
        type?: string;
      };
      if (!body.name || !body.type) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      const created = {
        // Eight hex digits in the first group, however many are created.
        id: `${String(state.createdProjects.length).padStart(8, "5")}-5555-4555-8555-555555555555`,
        workspaceId,
        name: body.name,
        type: body.type,
        status: "active",
        viewerRole: "owner",
        createdAt: now,
      } satisfies Platform["ProjectSummary"];
      state.createdProjects.push(created);
      return respond(response, 200, {
        project: created,
      } satisfies Platform["ProjectMutationResponse"]);
    }
    if (
      method === "GET" &&
      isWorkspacePath(pathname, `/projects/${projectId}/memberships`)
    ) {
      // The project page lists who is on the project (register F37: axe had
      // never scanned it, because this read was undeclared here).
      return respond(response, 200, {
        memberships: [
          {
            projectId,
            workspaceId,
            userId,
            role: "owner",
            displayName: "Fixture Owner",
            email: "owner@example.test",
            createdAt: now,
          },
        ],
      } satisfies Platform["ProjectMembershipListResponse"]);
    }
    // The owner's personal workspace holds nothing but its own billing (below):
    // every list the account pages read for it is empty, as the Edge answers a
    // workspace with nothing in it, and the catalog is the same catalog with
    // nothing subscribed. A test that switches to it reads real pages, not 501s.
    if (
      method === "GET" &&
      pathname.startsWith(`/v1/workspaces/${personalWorkspaceId}/`)
    ) {
      const read = pathname.slice(
        `/v1/workspaces/${personalWorkspaceId}`.length,
      );
      const noRuns = {
        total: 0,
        pending: 0,
        running: 0,
        held: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
      };
      const empty: Record<string, Json> = {
        "/projects": { projects: [] } satisfies Platform["ProjectListResponse"],
        "/subscriptions": {
          subscriptions: [],
        } satisfies AutomationOperations["listSubscriptions"]["responses"][200]["content"]["application/json"],
        "/runs": {
          runs: [],
        } satisfies AutomationOperations["listRuns"]["responses"][200]["content"]["application/json"],
        "/run-stats": {
          workspace: noRuns,
          subscriptions: [],
        } satisfies Automations["RunStats"],
        "/approvals": {
          approvals: [],
        } satisfies AutomationOperations["listApprovals"]["responses"][200]["content"]["application/json"],
        "/connections": {
          connections: [],
        } satisfies ConnectionOperations["listConnections"]["responses"][200]["content"]["application/json"],
        "/automations": {
          ...fixtureCatalog(),
          automations: fixtureCatalog().automations.map((entry) => ({
            ...entry,
            subscribed: false,
          })),
        } satisfies Automations["AutomationCatalogResponse"],
      };
      const answer = empty[read];
      if (answer) return respond(response, 200, answer);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/members")) {
      return respond(response, 200, {
        members: organizationMembers,
      } satisfies Platform["WorkspaceMemberListResponse"]);
    }
    // Teams, as backend ADR-0010 and the published descriptions hold them: an
    // owner or admin sees and creates every team; anyone else sees the teams
    // they are on. An owner, an admin or the team's manager reads and changes
    // its members. A project's owner or admin grants it to a team.
    const viewer =
      fixtureSession === "owner"
        ? userId
        : fixtureSession === "admin"
          ? adminUserId
          : fixtureSession === "member"
            ? memberUserId
            : requesterUserId;
    const administering =
      fixtureSession === "owner" || fixtureSession === "admin";
    const onTeam = (teamId: string) =>
      state.teamMemberships.find(
        (entry) => entry.teamId === teamId && entry.userId === viewer,
      );
    if (isWorkspacePath(pathname, "/teams")) {
      if (method === "GET") {
        return respond(response, 200, {
          teams: state.teams.flatMap((team) => {
            const mine = onTeam(team.id);
            if (!administering && !mine) return [];
            return [{ ...team, ...(mine ? { viewerRole: mine.role } : {}) }];
          }),
        } satisfies Platform["TeamListResponse"]);
      }
      if (method === "POST") {
        if (!administering) {
          return respond(response, 403, problem(403, "Forbidden"));
        }
        const body = (await requestJson(request)) as {
          name?: string;
          description?: string;
        };
        if (
          !request.headers["idempotency-key"] ||
          typeof body.name !== "string" ||
          body.name.length < 2 ||
          body.name.length > 120
        ) {
          return respond(response, 400, problem(400, "Bad Request"));
        }
        const team = {
          id: crypto.randomUUID(),
          workspaceId,
          name: body.name,
          ...(body.description ? { description: body.description } : {}),
          status: "active",
          createdAt: now,
        } satisfies Platform["TeamSummary"];
        state.teams.unshift(team);
        return respond(response, 200, {
          team,
        } satisfies Platform["TeamMutationResponse"]);
      }
    }
    const teamMembers = new RegExp(
      `^/v1/workspaces/${workspaceId}/teams/([^/]+)/memberships$`,
      "u",
    ).exec(pathname);
    if (teamMembers) {
      const team = state.teams.find((entry) => entry.id === teamMembers[1]);
      if (!team) return respond(response, 404, problem(404, "Not Found"));
      // An owner, an admin or the team's manager; any other member is 403.
      if (!administering && onTeam(team.id)?.role !== "manager") {
        return respond(response, 403, problem(403, "Forbidden"));
      }
      if (method === "GET") {
        return respond(response, 200, {
          memberships: state.teamMemberships.filter(
            (entry) => entry.teamId === team.id,
          ),
        } satisfies Platform["TeamMembershipListResponse"]);
      }
      if (method === "POST") {
        const body = (await requestJson(request)) as {
          userId?: string;
          role?: string;
        };
        if (
          !request.headers["idempotency-key"] ||
          (body.role !== "manager" && body.role !== "member")
        ) {
          return respond(response, 400, problem(400, "Bad Request"));
        }
        // Only someone already in the workspace can join one of its teams.
        if (
          !organizationMembers.some((entry) => entry.userId === body.userId)
        ) {
          return respond(response, 404, problem(404, "Not Found"));
        }
        const membership = {
          teamId: team.id,
          workspaceId,
          userId: body.userId as string,
          role: body.role,
          createdAt: now,
        } satisfies Platform["TeamMembershipSummary"];
        state.teamMemberships = [
          membership,
          ...state.teamMemberships.filter(
            (entry) =>
              !(entry.teamId === team.id && entry.userId === body.userId),
          ),
        ];
        return respond(response, 200, {
          membership,
        } satisfies Platform["TeamMembershipMutationResponse"]);
      }
    }
    // Backend §12.1 #174: taking someone off a team, by the same authority
    // that adds them; absent is `removed: false`, not 404.
    const teamMember = new RegExp(
      `^/v1/workspaces/${workspaceId}/teams/([^/]+)/memberships/([^/]+)$`,
      "u",
    ).exec(pathname);
    if (teamMember && method === "DELETE") {
      const team = state.teams.find((entry) => entry.id === teamMember[1]);
      if (!team) return respond(response, 404, problem(404, "Not Found"));
      if (!administering && onTeam(team.id)?.role !== "manager") {
        return respond(response, 403, problem(403, "Forbidden"));
      }
      if (!request.headers["idempotency-key"]) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      const before = state.teamMemberships.length;
      state.teamMemberships = state.teamMemberships.filter(
        (entry) =>
          !(entry.teamId === team.id && entry.userId === teamMember[2]),
      );
      return respond(response, 200, {
        removed: state.teamMemberships.length < before,
      } satisfies Platform["RemovalResponse"]);
    }
    const teamGrant = new RegExp(
      `^/v1/workspaces/${workspaceId}/projects/${projectId}/team-grants/([^/]+)$`,
      "u",
    ).exec(pathname);
    if (teamGrant && method === "DELETE") {
      const projectRole = projectRoleOf(fixtureSession);
      if (!projectRole)
        return respond(response, 404, problem(404, "Not Found"));
      if (projectRole !== "owner" && projectRole !== "admin") {
        return respond(response, 403, problem(403, "Forbidden"));
      }
      if (!request.headers["idempotency-key"]) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      const before = state.projectTeamGrants.length;
      state.projectTeamGrants = state.projectTeamGrants.filter(
        (entry) => entry.teamId !== teamGrant[1],
      );
      return respond(response, 200, {
        revoked: state.projectTeamGrants.length < before,
      } satisfies Platform["RevocationResponse"]);
    }
    if (isWorkspacePath(pathname, `/projects/${projectId}/team-grants`)) {
      // Anyone with a role on the project reads its grants; anyone else is 404.
      // Granting is the project's effective owner's or admin's.
      const projectRole = projectRoleOf(fixtureSession);
      if (!projectRole) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      if (method === "GET") {
        return respond(response, 200, {
          grants: state.projectTeamGrants,
        } satisfies Platform["ProjectTeamGrantListResponse"]);
      }
      if (method === "POST") {
        if (projectRole !== "owner" && projectRole !== "admin") {
          return respond(response, 403, problem(403, "Forbidden"));
        }
        const body = (await requestJson(request)) as {
          teamId?: string;
          role?: string;
        };
        if (
          !request.headers["idempotency-key"] ||
          (body.role !== "admin" && body.role !== "member")
        ) {
          return respond(response, 400, problem(400, "Bad Request"));
        }
        // Backend §12.1 #176: only a team the caller can see — every team for
        // an owner or admin, otherwise a team they are on. Unseen is 404.
        if (
          !state.teams.some((entry) => entry.id === body.teamId) ||
          (!administering && !onTeam(body.teamId as string))
        ) {
          return respond(response, 404, problem(404, "Not Found"));
        }
        const grant = {
          projectId,
          teamId: body.teamId as string,
          workspaceId,
          role: body.role,
          createdAt: now,
        } satisfies Platform["ProjectTeamGrantSummary"];
        state.projectTeamGrants = [
          grant,
          ...state.projectTeamGrants.filter(
            (entry) => entry.teamId !== body.teamId,
          ),
        ];
        return respond(response, 200, {
          grant,
        } satisfies Platform["ProjectTeamGrantMutationResponse"]);
      }
    }
    if (method === "GET" && isWorkspacePath(pathname, "/domains")) {
      return respond(response, 200, {
        domains: [domain],
      } satisfies Platform["OrganizationDomainListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/join-requests")) {
      return respond(response, 200, {
        requests: [joinRequest()],
      } satisfies Platform["OrganizationJoinRequestListResponse"]);
    }
    if (
      method === "PATCH" &&
      pathname ===
        `/v1/workspaces/${workspaceId}/join-requests/${joinRequestId}`
    ) {
      state.joinRequestStatus = "approved";
      return respond(response, 200, {
        request: joinRequest(),
      } satisfies Platform["OrganizationJoinRequestMutationResponse"]);
    }
    if (method === "GET" && pathname === "/v1/organization-discovery") {
      if (state.discoveryFailing) {
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
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
        request: joinRequest(),
      } satisfies Platform["OrganizationJoinResponse"]);
    }
    if (method === "GET" && pathname === "/v1/connections/providers") {
      return respond(response, 200, {
        providers: [keyProvider, oauthProvider],
      } satisfies ConnectionOperations["listConnectionProviders"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/connections")) {
      // A disconnected connection is not listed, as the platform lists them.
      return respond(response, 200, {
        connections: [
          ...(state.oauthDisconnected
            ? []
            : [{ ...oauthConnectionState(), usedByCount: 1 }]),
          ...(state.fixtureConnectionCreated ? [connection] : []),
        ],
      } satisfies ConnectionOperations["listConnections"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "DELETE" &&
      isWorkspacePath(pathname, `/connections/${state.oauthConnectionId}`)
    ) {
      if (state.oauthDisconnected) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      state.oauthDisconnected = true;
      return respond(response, 200, {
        connection: { ...oauthConnectionState(), status: "disconnected" },
      } satisfies ConnectionOperations["disconnectConnection"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "POST" &&
      isWorkspacePath(pathname, "/connections/authorize")
    ) {
      const body = (await requestJson(request)) as {
        providerId?: string;
        replaceConnectionId?: string;
      };
      if (body.providerId !== oauthProvider.providerId) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      // The replace intent names the exact live connection; any other id is
      // stale, and the Edge relays the service's refusal as a plain 409.
      if (
        body.replaceConnectionId !== undefined &&
        body.replaceConnectionId !== state.oauthConnectionId
      ) {
        return respond(response, 409, problem(409, "Conflict"));
      }
      // The platform never reuses a grant it was asked to replace; this answer
      // exists so the website's defensive branch is held by a test, and it
      // names another account than the row's, as that branch must say.
      if (
        state.replaceAnswersReused &&
        body.replaceConnectionId !== undefined
      ) {
        return respond(response, 200, {
          outcome: "reused",
          connection: {
            ...oauthConnectionState(),
            externalAccount: {
              id: "fixture-other-account",
              displayName: "Fixture other account",
            },
          },
        } satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"]);
      }
      // Reused only when the grant is connected and nothing is being replaced
      // (backend ADR-0019 §2, §12.1 #175); otherwise consent is asked for.
      const answer =
        body.replaceConnectionId === undefined &&
        state.oauthStatus === "connected"
          ? ({
              outcome: "reused",
              connection: oauthConnectionState(),
            } as const)
          : ({
              outcome: "authorization-required",
              authorizationUrl:
                "https://oauth.invalid/authorize?state=fixture-state",
              expiresAt: hostedExpiry,
            } as const);
      return respond(
        response,
        200,
        answer satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"],
      );
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
      if (!state.connectionAttemptKey) {
        state.connectionAttemptKey = idempotencyKey;
        return respond(
          response,
          409,
          problem(409, "Connection verification is still in progress"),
        );
      }
      if (idempotencyKey !== state.connectionAttemptKey) {
        return respond(
          response,
          409,
          problem(409, "Retry must use the original idempotency key"),
        );
      }
      state.fixtureConnectionCreated = true;
      return respond(response, 201, {
        connection,
      } satisfies ConnectionOperations["connectProviderWithKey"]["responses"][201]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/automations")) {
      return respond(response, 200, fixtureCatalog());
    }
    if (method === "GET" && isWorkspacePath(pathname, "/subscriptions")) {
      return respond(response, 200, {
        subscriptions: [
          ...state.projectAutomationScopes.map(projectAutomationSubscription),
          { ...manualSubscription, status: state.manualStatus },
          webhookSubscription(),
          ...(state.archivableArchived ? [] : [archivableSubscription]),
          {
            ...projectDraftSubscription,
            unmetConnections: state.draftNeedsConnection
              ? [oauthProvider.providerId]
              : [],
          },
        ],
      } satisfies AutomationOperations["listSubscriptions"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "PATCH" &&
      isWorkspacePath(pathname, `/subscriptions/${manualSubscriptionId}`)
    ) {
      // A status change — Pause or Go live, kept for this test (register F38) —
      // or a set-up save, holding each declared setting to its control's type as
      // the catalog does; the saved values are not kept.
      const body = (await requestJson(request)) as {
        config?: Json;
        status?: string;
      };
      if (!request.headers["idempotency-key"]) {
        return respond(
          response,
          422,
          problem(422, "The request could not be processed"),
        );
      }
      if (body.status !== undefined) {
        if (
          Object.keys(body).join() !== "status" ||
          (body.status !== "paused" && body.status !== "live")
        ) {
          return respond(
            response,
            422,
            problem(422, "Undeclared fixture subscription update"),
          );
        }
        state.manualStatus = body.status;
        return respond(response, 200, {
          subscription: { ...manualSubscription, status: state.manualStatus },
        } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
      }
      const config = body.config;
      if (
        !config ||
        Object.keys(config).sort().join() !==
          "holdAboveAmount,notifyOnFailure" ||
        typeof config.holdAboveAmount !== "number" ||
        typeof config.notifyOnFailure !== "boolean"
      ) {
        return respond(
          response,
          422,
          problem(422, "The request could not be processed"),
        );
      }
      return respond(response, 200, {
        subscription: {
          ...manualSubscription,
          status: state.manualStatus,
          config,
        },
      } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
    }
    // Backend §12.1 #126: a move to v2, refused while an approval waits.
    if (
      method === "PATCH" &&
      isWorkspacePath(pathname, `/subscriptions/${webhookSubscriptionId}`)
    ) {
      const body = (await requestJson(request)) as { templateVersion?: number };
      if (body.templateVersion !== 2 || !request.headers["idempotency-key"]) {
        return respond(
          response,
          422,
          problem(422, "Undeclared fixture subscription update"),
        );
      }
      if (state.approvalPendingOnMove) {
        return respond(response, 409, {
          ...problem(409, "Conflict"),
          details: { reason: "approvals_pending" },
        });
      }
      state.webhookVersion = 2;
      return respond(response, 200, {
        subscription: webhookSubscription(),
      } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
    }
    // Backend §12.1 #91: the address, for an owner or admin only; the secret
    // only in an issue's answer.
    if (
      isWorkspacePath(
        pathname,
        `/subscriptions/${webhookSubscriptionId}/webhook`,
      )
    ) {
      if (!administering)
        return respond(response, 403, {
          ...problem(403, "Forbidden"),
          details: { requiredRole: "admin" },
        });
      const address = `https://hooks.example.test/v1/webhooks/${webhookEndpointId}`;
      if (method === "GET") {
        if (state.webhookSecrets === 0) {
          return respond(response, 404, problem(404, "Not Found"));
        }
        return respond(response, 200, {
          endpointId: webhookEndpointId,
          url: address,
          createdAt: now,
          lastDeliveryAt: now,
          lastOutcome: "accepted",
        } satisfies Automations["WebhookEndpoint"]);
      }
      if (method === "POST") {
        state.webhookSecrets += 1;
        return respond(response, 200, {
          endpointId: webhookEndpointId,
          url: address,
          createdAt: now,
          secret: `fixture-secret-${state.webhookSecrets}`,
          rotated: state.webhookSecrets > 1,
        } satisfies Automations["IssuedWebhookEndpoint"]);
      }
    }
    // FR-14: an upload for the manual automation, which asks for a file.
    if (method === "POST" && isWorkspacePath(pathname, "/uploads")) {
      const body = (await requestJson(request)) as {
        subscriptionId?: string;
        filename?: string;
        contentType?: string;
        sizeBytes?: number;
      };
      if (body.subscriptionId !== manualSubscriptionId) {
        return respond(response, 409, {
          ...problem(409, "Conflict"),
          details: { reason: "no_file_input" },
        });
      }
      if (body.contentType !== "application/pdf") {
        return respond(response, 400, {
          ...problem(400, "Bad Request"),
          details: { reason: "content_type_not_accepted" },
        });
      }
      const uploadSessionId = crypto.randomUUID();
      state.uploads.set(uploadSessionId, {
        filename: body.filename ?? "file",
        contentType: body.contentType,
        sizeBytes: body.sizeBytes ?? 0,
      });
      return respond(response, 200, {
        uploadSessionId,
        uploadUrl: `https://127.0.0.1:${port}/__fixture/objects/${uploadSessionId}?size=${body.sizeBytes}`,
        expiresAt: now,
        maximumSizeBytes: 5_000_000,
      } satisfies Automations["UploadTicket"]);
    }
    const uploadComplete = new RegExp(
      `^/v1/workspaces/${workspaceId}/uploads/([^/]+)/complete$`,
      "u",
    ).exec(pathname);
    if (method === "POST" && uploadComplete) {
      const upload = state.uploads.get(uploadComplete[1] ?? "");
      if (!upload) return respond(response, 404, problem(404, "Not Found"));
      if (upload.received === undefined) {
        return respond(response, 400, {
          ...problem(400, "Bad Request"),
          details: { reason: "no_object" },
        });
      }
      state.uploads.delete(uploadComplete[1] ?? "");
      const artifactId = crypto.randomUUID();
      state.files.set(artifactId, {
        filename: upload.filename,
        sizeBytes: upload.received,
      });
      return respond(response, 200, {
        artifact: {
          artifactId,
          filename: upload.filename,
          contentType: upload.contentType,
          sizeBytes: upload.received,
        },
      });
    }
    // Backend §12.1 #39: the complete export — running on its first read,
    // ready with a signed link after, and expired when the fixture says so.
    if (method === "POST" && isWorkspacePath(pathname, "/exports")) {
      if (!administering)
        return respond(response, 403, problem(403, "Forbidden"));
      if (!request.headers["idempotency-key"]) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      state.exportJobStarted = true;
      state.exportJobReads = 0;
      return respond(response, 200, {
        export: { id: exportJobId, status: "running", createdAt: now },
      } satisfies Platform["WorkspaceExportJobResponse"]);
    }
    if (
      method === "GET" &&
      isWorkspacePath(pathname, `/exports/${exportJobId}`)
    ) {
      if (!administering || !state.exportJobStarted) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      state.exportJobReads += 1;
      if (state.exportExpired) {
        return respond(response, 200, {
          export: {
            id: exportJobId,
            status: "expired",
            createdAt: now,
            completedAt: now,
            complete: true,
          },
        } satisfies Platform["WorkspaceExportJobResponse"]);
      }
      return respond(response, 200, {
        export:
          state.exportJobReads < 2
            ? { id: exportJobId, status: "running", createdAt: now }
            : {
                id: exportJobId,
                status: "ready",
                createdAt: now,
                completedAt: now,
                complete: true,
                file: {
                  artifactId: exportJobId,
                  filename: "workspace-export-2026-08-12.json",
                  sizeBytes: 52,
                  downloadUrl: `https://127.0.0.1:${port}/__fixture/export-file?read=${state.exportJobReads}`,
                  expiresAt: now,
                },
              },
      } satisfies Platform["WorkspaceExportJobResponse"]);
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
      state.archivableArchived = true;
      return respond(response, 200, {
        subscription: { ...archivableSubscription, status: "archived" },
      } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "POST" && isWorkspacePath(pathname, "/subscriptions")) {
      const body = (await requestJson(request)) as {
        templateId?: string;
        projectId?: string;
      };
      if (body.templateId === projectAutomation.templateId) {
        // One live subscription per template and scope; a project the person
        // cannot see is 404, as the catalog answers it.
        const scope = body.projectId ?? null;
        if (scope !== null && scope !== projectId) {
          return respond(response, 404, problem(404, "Not Found"));
        }
        if (state.projectAutomationScopes.includes(scope)) {
          return respond(
            response,
            409,
            problem(409, "This automation is already added here"),
          );
        }
        state.projectAutomationScopes.push(scope);
        return respond(response, 200, {
          subscription: projectAutomationSubscription(scope),
        } satisfies AutomationOperations["createSubscription"]["responses"][200]["content"]["application/json"]);
      }
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
      const { artifactId, ...typed } = input;
      // FR-14: a file field names a completed upload, given to this run once.
      const file =
        typeof artifactId === "string"
          ? state.files.get(artifactId)
          : undefined;
      if (artifactId !== undefined && (!file || file.runId)) {
        return respond(response, 422, {
          ...problem(422, "The request could not be processed"),
          details: { reason: "artifact_unavailable" },
        });
      }
      const exact =
        body.subscriptionId === manualSubscriptionId &&
        Object.keys(typed).sort().join() === "amount,reference,vendor" &&
        typeof typed.vendor === "string" &&
        typeof typed.amount === "number" &&
        typeof typed.reference === "string";
      if (!request.headers["idempotency-key"] || !exact) {
        return respond(
          response,
          422,
          problem(422, "The request could not be processed"),
        );
      }
      if (file) file.runId = startedRunId;
      return respond(response, 201, {
        run: { ...fixtureRun(startedRunId), status: "pending" },
      } satisfies AutomationOperations["createRun"]["responses"][201]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/runs")) {
      if (state.runsRead === "failing") {
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
      // The deterministic runs, so Activity renders rows and the run pages are
      // reached by a person rather than typed — or none, for a new workspace.
      return respond(response, 200, {
        runs: state.runsRead === "empty" ? [] : listedRunIds.map(fixtureRun),
      } satisfies AutomationOperations["listRuns"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/run-stats")) {
      if (state.runStatsFailing) {
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
      return respond(
        response,
        200,
        fixtureRunStats(url.searchParams.get("since")),
      );
    }
    if (
      method === "POST" &&
      isWorkspacePath(pathname, `/runs/${runningRunId}/cancel`)
    ) {
      // Only a pending or running run is cancelled; any other answers 404, as
      // `cancelRun` does.
      if (state.runningCancelled) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      state.runningCancelled = true;
      return respond(response, 200, {
        run: fixtureRun(runningRunId),
      } satisfies AutomationOperations["cancelRun"]["responses"][200]["content"]["application/json"]);
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
    const decision = new RegExp(
      `^/v1/workspaces/${workspaceId}/approvals/([^/]+)/decision$`,
      "u",
    ).exec(pathname);
    if (method === "POST" && decision) {
      const approval = state.approvals.find(
        (entry) => entry.id === decision[1],
      );
      if (!approval) return respond(response, 404, problem(404, "Not Found"));
      const role =
        fixtureSession === "owner" ||
        fixtureSession === "admin" ||
        fixtureSession === "member"
          ? fixtureSession
          : null;
      if (!role || !approval.eligibleRoles.includes(role)) {
        return respond(response, 403, problem(403, "Forbidden"));
      }
      const body = (await requestJson(request)) as { decision?: string };
      if (
        !request.headers["idempotency-key"] ||
        (body.decision !== "approved" && body.decision !== "rejected")
      ) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      approval.status = body.decision;
      approval.decidedAt = now;
      approval.decidedByUserId = userId;
      return respond(response, 200, {
        approval,
      } satisfies AutomationOperations["decideApproval"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/approvals")) {
      const status = url.searchParams.get("status");
      return respond(response, 200, {
        approvals: state.approvals.filter(
          (entry) => !status || entry.status === status,
        ),
      } satisfies AutomationOperations["listApprovals"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "GET" &&
      pathname === "/v1/plans" &&
      state.billingNotConfigured
    ) {
      return respond(response, 503, problem(503, "Billing is not configured"));
    }
    if (method === "GET" && pathname === "/v1/plans") {
      // Any signed-in person may read the plan list; the free floor is never
      // on it (a plan with no provider price is omitted).
      const body = {
        plans: [teamPlan, proPlan],
      } satisfies Platform["PlanListResponse"];
      return respond(response, 200, body);
    }
    // Billing, per workspace (register F31): the organization's and the owner's
    // personal workspace each hold their own plan, as the Edge scopes them.
    const billing =
      /^\/v1\/workspaces\/([^/]+)\/billing(\/checkout|\/portal)?$/u.exec(
        pathname,
      );
    if (billing) {
      const billedWorkspace = billing[1];
      const operation = billing[2] ?? "";
      if (
        billedWorkspace !== workspaceId &&
        billedWorkspace !== personalWorkspaceId
      ) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      // Owner or admin for the workspace's billing, its checkout and its
      // portal, as the Edge enforces (billing-routes.ts): a member is refused.
      // The admin administers the organization only; the personal workspace
      // is the owner's alone.
      if (
        fixtureSession !== "owner" &&
        !(fixtureSession === "admin" && billedWorkspace === workspaceId)
      ) {
        return respond(
          response,
          403,
          problem(403, "Billing requires an admin", { requiredRole: "admin" }),
        );
      }
      if (state.billingNotConfigured) {
        return respond(
          response,
          503,
          problem(503, "Billing is not configured"),
        );
      }
      const subscribed = state.subscribedPlan.get(billedWorkspace);
      if (method === "GET" && operation === "") {
        if (
          fixtureCookieEntry(request.headers.cookie) ===
          `${fixtureCookie}=page-failing`
        ) {
          return respond(response, 500, problem(500, "Internal Server Error"));
        }
        const body = subscribed
          ? ({
              workspaceId: billedWorkspace,
              planId: subscribed.planId,
              displayName: subscribed.displayName,
              status: "active",
              currentPeriodEnd: "2026-09-12T12:00:00.000Z",
              cancelAtPeriodEnd: false,
            } satisfies Platform["WorkspaceBillingResponse"])
          : ({
              workspaceId: billedWorkspace,
              planId: "fixture-free",
              displayName: "Free",
            } satisfies Platform["WorkspaceBillingResponse"]);
        return respond(response, 200, body);
      }
      if (method === "POST" && operation === "/checkout") {
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
        state.subscribedPlan.set(billedWorkspace, plan);
        return respond(response, 201, {
          url: "https://billing.invalid/checkout/fixture-session",
          expiresAt: hostedExpiry,
        } satisfies Platform["HostedBillingSession"]);
      }
      if (method === "POST" && operation === "/portal") {
        await requestJson(request);
        // No billing account yet answers 409: the client sends the person to
        // checkout rather than showing a conflict.
        if (!subscribed) {
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
    }
    if (method === "GET" && isWorkspacePath(pathname, "/export")) {
      state.exportCount += 1;
      const complete = state.exportCount % 2 === 1;
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
        state.departed = true;
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
      // Deleted: the Edge clears the session cookies with its 200
      // (`apps/api/src/app.ts`, the `/v1/account` handler), so the browser is
      // signed out by the deletion itself, not only by the courtesy logout
      // after it (register F34).
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "set-cookie": `${fixtureCookie}=; Path=/; Max-Age=0`,
      });
      // The requester owns no workspace, so none leaves with the account.
      return response.end(
        JSON.stringify({
          deleted: true,
          workspaces: [],
          account: {},
        } satisfies Platform["AccountDeletionResult"]),
      );
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
