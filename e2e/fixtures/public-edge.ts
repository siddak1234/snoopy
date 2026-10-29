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

// The page bodies' composer (ADR-0048), by its own path: Node runs this file
// with its types stripped, which needs the `.ts`; the types are tsc's.
const { itemBody, runBlocks } = (await import(
  new URL("./page-bodies.ts", import.meta.url).href
)) as typeof import("./page-bodies");

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

// A team the plain member is not on, which they may ask to join (backend
// 24.11.2): the organization's directory lists it. The fixture keeps it out of
// the owner's and the admin's lists, so theirs stay the one fixture project.
const operationsTeamId = "abababab-abab-4bab-8bab-abababababab";
// Someone in the organization asking onto the fixture project, for its owner
// to answer.
const newcomerUserId = "13131313-1313-4131-8131-131313131313";
const newcomerRequestId = "14141414-1414-4141-8141-141414141414";
const memberRequestId = "15151515-1515-4151-8151-151515151515";

/**
 * Everything a test can change, in one place, reset by `POST /__fixture/reset`
 * before each test (register F30, F48) — so no test depends on the order the
 * suite runs in, and one can run twice against one fixture process. The route is
 * the fixture's own: it is not part of the published API and the website never
 * calls it.
 */
function initialState() {
  // Who is on the fixture project: its owner and the plain member. The admin
  // is not — an organization admin sees every team from outside (backend
  // 24.11.3), and is the one an owner can add. Typed, not cast, so a field the
  // published ProjectMembership drops or retypes fails typecheck.
  const projectMembers: Platform["ProjectMembership"][] = [
    {
      projectId,
      workspaceId,
      userId,
      role: "owner",
      displayName: "Fixture Owner",
      email: "owner@example.test",
      createdAt: now,
    },
    {
      projectId,
      workspaceId,
      userId: memberUserId,
      role: "member",
      displayName: "Fixture Member",
      email: "member@example.test",
      createdAt: now,
    },
  ];
  return {
    activeWorkspaceId: workspaceId as string,
    // Build 14 (the owner's build 13 decisions 7a3 and 8B): the workspace over
    // its plan's flow allowance; the organization's domain-only setting, and a
    // refusal to turn it on.
    overPlan: false,
    domainOnly: false,
    domainOnlyRefusal: null as { reason: string; count?: number } | null,
    joinRequestStatus: "pending" as "pending" | "approved",
    archivableArchived: false,
    // The fresh copy unarchiving the archivable automation made (the owner's
    // build 12, #4): the archived one stays archived.
    archivableAgain: null as Automations["Subscription"] | null,
    manualStatus: "live" as "live" | "paused",
    connectionAttemptKey: null as string | null,
    fixtureConnectionCreated: false,
    exportCount: 0,
    // Per workspace, so a personal workspace has billing of its own (F31).
    subscribedPlan: new Map<string, Platform["PurchasablePlan"]>(),
    // Every checkout asked for, bought or refused.
    checkoutAttempts: 0,
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
    projectMembers,
    // Backend 24.11.2: the newcomer's request onto the fixture project, and the
    // member's onto Operations — absent until they ask.
    newcomerRequest: "pending" as Platform["ProjectAccessRequest"]["status"],
    memberRequest: null as Platform["ProjectAccessRequest"]["status"] | null,
    // Backend 24.11.4: a platform from before the SEVENTEENTH promotion has no
    // directory and no requests, and answers 404 for both.
    teamAccessMissing: false,
    // Backend 24.11.1: the sign-in accounts linked, the first the primary; the
    // reason the platform refuses the next unlink with, if it does; and whether
    // it is a platform from before the promotion, with no unlink route at all.
    identities: [
      "google",
      "microsoft",
    ] as Platform["LoginIdentitySummary"]["provider"][],
    unlinkRefusal: null as string | null,
    unlinkRouteMissing: false,
    // Whether the organization lists its fixture project, and the teams a test
    // created, in either workspace — so an organization can be new, with none
    // (register F57).
    fixtureProjectListed: true,
    createdProjects: [] as Platform["ProjectSummary"][],
    // Whether the organization's domain is still waiting to be verified.
    domainPending: false,
    // Pro's price, unstated: the provider could not give one flat figure.
    proPriceUnstated: false,
    // A platform with no Pro yet — its row unseeded, as production's is until
    // the owner creates its price — so the plan list is Plus alone (build 10).
    proUnlisted: false,
    // A catalog with nothing to add yet (build 10).
    catalogEmpty: false,
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
    // Backend §12.1 #91: the address once issued, and how many secrets so far.
    webhookSecrets: 0,
    // Backend §12.1 #240: every issue asked for, with the key it carried and
    // whether it was answered as a replay; the key the current secret was made
    // with, and whether making it was a rotation; and how many of the next
    // issues have their answer lost once the secret is made.
    webhookIssues: [] as { idempotencyKey: string | null; replayed: boolean }[],
    webhookSecretKey: null as string | null,
    webhookSecretRotated: false,
    webhookAnswersLost: 0,
    // Backend BUILD-PLAN 25.2.10: how many of the next run starts are refused
    // because the flow is at capacity and its queue is full.
    runsAtCapacity: 0,
    // Backend §12.1 #39: the complete export, read as running once then ready.
    exportJobReads: 0,
    exportJobStarted: false,
    exportExpired: false,
    // How many of the next reads of it the platform fails (503).
    exportReadsFailing: 0,
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
    // The paid plan cancelled in the portal, ending at its period's end (the
    // owner's build 14 feedback #11).
    billingCancelled: false,
    discoveryFailing: false,
    notReady: false,
    draftNeedsConnection: false,
    memberOwnsProject: false,
    // The surfaces the change audit of 97021f9 probed and no test asserted
    // (register § Round 15): the refusals each operation names, answered as
    // the contract answers them, and what the object store saw arrive.
    webhookReadRefusal: null as number | null,
    webhookIssueRefusal: null as string | null,
    // Whether the platform has a public origin to put in an address, and what
    // the last delivery to it came to.
    webhookOrigin: true,
    webhookLastOutcome: "accepted",
    uploadRefusal: null as {
      stage: "open" | "complete";
      status: number;
      reason: string;
    } | null,
    // Backend BUILD-PLAN 25.2.39: how many of the next completions find no
    // place yet to measure their file, each answered 429 `measurement_busy`
    // with its upload kept open, as the platform keeps it; and how many
    // completions were asked for in all, since the Run window asks again by
    // itself (Round 17's B5) and no page shows how often.
    measurementBusy: 0,
    uploadCompletions: 0,
    storeRefusing: false,
    storePuts: 0,
    storePutsWithCookie: 0,
    // BUILD-PLAN 25.8.5: each object the store took — the type the upload was
    // opened with, the type its PUT came as, and its bytes — since no page
    // shows what the website sent.
    storedObjects: [] as {
      filename: string;
      declaredType: string;
      contentType: string | null;
      bytes: string;
    }[],
    // The complete export ends failed — with this reason, or none when empty —
    // or ready but partial.
    exportFailure: null as string | null,
    exportPartial: false,
    // Backend §12.1 #186: the organizations the requester — the person with
    // none — made at /onboarding/setup-org, each with the key and the input it
    // was made with, and how many times one was asked for, a replay included;
    // the one made active; every claim of a domain on one, as asked and as
    // answered; and how many of the next claims are refused.
    createdOrganizations: [] as {
      workspace: Platform["WorkspaceSummary"];
      idempotencyKey: string;
      input: string;
    }[],
    organizationsAskedFor: 0,
    requesterActiveWorkspaceId: null as string | null,
    domainClaims: [] as {
      workspaceId: string;
      domain: string;
      joinPolicy: Platform["ClaimOrganizationDomainRequest"]["joinPolicy"];
      idempotencyKey: string;
      status: number;
    }[],
    domainClaimsRefused: 0,
    // Backend ADR-0036: the next Add refused with this status — a workspace
    // or team the platform could not find or make (404), or its team service
    // unanswered (502).
    addRefusal: null as number | null,
    // Backend ADR-0037: Invoice Processing's flow — its status, its settings
    // (the vendor it chose among them), and whether QuickBooks is connected.
    invoiceStatus: "live" as "live" | "paused" | "draft",
    invoiceConfig: { vendor: "none", holdAboveAmount: 500 } as Json,
    invoiceSaves: [] as Json[],
    // Round 21 (the platform round's F1): Invoice Processing's Set up with
    // a required drop-down of several, its Specialties.
    invoiceSpecialties: false,
    quickbooksConnected: false,
    // Build 23 (B3): a change of the flow's integration refused as a
    // member's is — 403 `integration_requires_admin`, the Edge's "Forbidden".
    vendorChangeRefused: false,
    // The flow still on v1 (Bills & Receipts, which the catalog now names
    // Invoice Processing): its pinned version declares no vendor setting and
    // cannot run without QuickBooks, though the catalog's v3 makes it optional.
    invoiceV1: false,
    // Build 21 (spec A4): Google, connected as person@example.com.
    googleConnected: true,
    // Build 21 (spec A6; the owner's AM4): whether the workspace holds Invoice
    // Processing — not yet, its card offers Add, which opens its Set up.
    invoiceAdded: true,
    // Build 21 (spec A7): the run a person starts from Step 1, as it goes —
    // pending, then running with its first step done, then succeeded with its
    // three receipts; and whether one was started.
    invoiceRunStage: 0,
    invoiceRunStarted: false,
    // Build 22 (spec §4, P5; backend ADR-0041): the Invoice Processing flow's
    // extra email addresses — reserved example addresses, never a real one in
    // this public repository — every list an owner or admin saved, and
    // whether the platform fails the read of who gets the email, or its save.
    emailExtra: ["ap@example.com"] as string[],
    emailSaves: [] as string[][],
    emailRecipientsFailing: false,
    emailRecipientsRefusing: false,
    // Build 24 (P12; backend ADR-0045): every package file asked for — the
    // job, the format, the zone and whether it carried a key; how many of the
    // next asks the platform is too busy for (503 `package_busy`); and a
    // signed file that declares itself over the website's bound.
    packageFiles: [] as {
      runId: string;
      format: string;
      timeZone: string | null;
      keyed: boolean;
    }[],
    packageBusy: 0,
    packageFileOversized: false,
    // Build 25 (the review's R5c 1): the held Invoice Processing job going on
    // while its page is open, then held; its approval left off the next reads
    // of the approvals list; and every read of that list.
    heldJobLive: null as "running" | "held" | null,
    heldApprovalHiddenReads: 0,
    approvalListReads: 0,
    // ADR-0048: every read of the held job's page body (shape=blocks).
    heldJobBlockReads: 0,
    // Build 25's audit: the next read of the approvals list refused (503), and
    // every one refused; the workspace's flows, or the catalog, unreadable.
    approvalListFailing: 0,
    approvalListRefused: 0,
    // §12.1 #300: the next reads of one run refused (503), each counted — a
    // run page's re-reads meet them, and the page that drew it stays.
    runReadsFailing: 0,
    runReadsRefused: 0,
    // #58's audit (backend 27.2.1): Invoice Processing's entry as a flow that
    // declares no word for its documents.
    documentWordsDeclared: true,
    subscriptionsFailing: false,
    catalogFailing: false,
    // Build 25 (the review's R5c 2): signed links answered with another
    // scheme than https — the package's and the complete export's.
    signedLinkScheme: null as "http" | "javascript" | null,
    // Round 19 (backend ADR-0046): a flow with items, off until a test turns
    // it on, so no other test meets it. Its items, the values typed for its
    // select, each item's runs (all set when it is turned on), and what the
    // website sent to make an item or start a run of one.
    itemsFlow: false,
    itemsFailing: false,
    // Round 21 (design D2.6): an item's reading led by a table the platform
    // sent without its rows, as a client older or newer than it might meet.
    itemReadingBroken: false,
    items: [] as Automations["Item"][],
    itemChoices: [] as string[],
    itemRuns: new Map<string, Automations["Run"][]>(),
    itemKeys: new Map<string, string>(),
    itemCreates: [] as Json[],
    itemRunStarts: [] as Json[],
    // Round 21 v2 (backend ADR-0048 amendment 1): every runs list's query as
    // the website sent it; the list answered as the platform that searches,
    // sorts, pages and counts it (`total`) does; the image blocks' file gone
    // (404) or failing (500) for the next reads; the scored run's file link
    // gone; and the run package refused (500).
    runsQueries: [] as string[],
    runsCounted: false,
    pictureGone: false,
    pictureFailing: 0,
    entryFileLinkGone: false,
    packageFailing: false,
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
    // The platform still sends the account's AI answer (the session's S9),
    // never asked; the website reads none of it (Build 21, the owner's D1).
    aiDocumentReading: null,
  },
  workspaces: [workspace],
} satisfies Platform["SessionResponse"];

const requesterSession = {
  authenticated: true,
  user: {
    userId: requesterUserId,
    email: "requester@example.test",
    displayName: "Fixture Requester",
    aiDocumentReading: null,
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

// Backend 24.12.4: a join request names the person asking.
function joinRequest(): Platform["OrganizationJoinRequest"] {
  return state.joinRequestStatus === "approved"
    ? {
        id: joinRequestId,
        workspaceId,
        userId: requesterUserId,
        displayName: requesterSession.user.displayName,
        email: requesterSession.user.email,
        status: "approved",
        createdAt: now,
        decidedAt: now,
        decidedByUserId: userId,
      }
    : {
        id: joinRequestId,
        workspaceId,
        userId: requesterUserId,
        displayName: requesterSession.user.displayName,
        email: requesterSession.user.email,
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
    externalAccount: { displayName: "Fixture OAuth account" },
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
  externalAccount: { displayName: "Fixture account" },
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
    usesAi: false,
    requiredConnections: [],
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
  // Its run takes a file a model reads (backend ADR-0038).
  usesAi: true,
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
// like billing's, lives for one fixture process. Unarchived, it is added afresh
// (`archivableAgain`, the owner's build 12, #4).
const archivableAutomation = automation(
  "fixture-archivable",
  "Archivable automation",
);

// Accepts an Add to the whole workspace or to the fixture project — the path a
// project-scoped subscription is created on (backend 18.6.2).
const projectAutomation = automation("fixture-projects", "Project automation");

// Already in the fixture project, as a draft (`projectDraftSubscription`):
// held, its card offers no team, a second one included (the owner's build 12,
// #9). The plan-limit and entitlements automations are held nowhere, so their
// Add reaches the platform's refusals.
const teamDraftAutomation = {
  ...automation("fixture-team-draft", "Team draft automation"),
  subscribed: true,
} satisfies Automations["AutomationCatalogEntry"];

// Started by a vendor's webhook, and the catalog's newest is v2 while the
// subscription still runs v1 — a flow the platform could not move (backend
// ADR-0041's `notMoved`): its page offers no move (Build 22, P4) and, to an
// owner or admin, the webhook address (§12.1 #91).
const webhookAutomation = {
  ...automation("fixture-webhook", "Webhook automation"),
  version: 2,
  subscribed: true,
  // v2 adds a setting v1 does not declare (backend §12.1 #185): the card draws
  // the pinned version's, so it offers no Set up until the flow is on v2.
  setup: [
    {
      section: "rules",
      key: "toleranceSeconds",
      title: "Signature tolerance",
      description: "How old a signed event may be, in seconds.",
      control: "money",
      defaultValue: 300,
      required: true,
    },
  ],
} satisfies Automations["AutomationCatalogEntry"];

// Invoice Processing, as its v2 manifest declares it (the spec's §2.1):
// QuickBooks optional, the vendor chosen on the flow's vendor page and kept as
// its `connection` setting (backend ADR-0037); five visible groups of its
// steps; a run that reads a file with a model (ADR-0038); and Accounting, the
// team kind its flow goes to (ADR-0036).
const quickbooksProvider = {
  providerId: "quickbooks",
  displayName: "QuickBooks Online",
  description: "Records bills and receipts.",
  icon: "QuickBooksLogo",
  scopes: ["com.intuit.quickbooks.accounting"],
  authType: "oauth2",
} satisfies Connections["ConnectionProvider"];
const quickbooksConnectionId = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1";

// Google, connected as an account with an email (Build 21, spec A4: "Google
// row: glyph · Google · person@example.com · Disconnect"; a reserved example
// address, never a real one in this public repository).
const googleProvider = {
  providerId: "google",
  displayName: "Google",
  description: "Reads and sends email.",
  icon: "GoogleLogo",
  scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  authType: "oauth2",
} satisfies Connections["ConnectionProvider"];
const googleConnectionId = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7";

function googleConnection(): Connections["Connection"] {
  return {
    id: googleConnectionId,
    providerId: googleProvider.providerId,
    workspaceId,
    externalAccount: { displayName: "person@example.com" },
    status: "connected",
    requiredScopes: googleProvider.scopes,
    grantedScopes: googleProvider.scopes,
    usedByCount: 2,
  };
}

// Invoice Processing v4, as its manifest declares it (snoopy-automations
// manifests/invoice-processing.v4.json; Build 22, spec §3): v3's 22 steps in
// five groups — receive in Upload invoice; extract, check-documents and
// verify-read in AI processing; the other 18 in step 4, "Details saved" or,
// with QuickBooks chosen, "QuickBooks updated" (`titleByConnection`) — the
// vendor choice, titled Integration, naming the Connect integration step,
// which no pipeline step names (a setting step, backend ADR-0041), and the
// platform's Email sent last (`platform: email`); the Approval limit in no
// group (Set up only).
const invoiceStep = (
  id: string,
  kicker: "TRIGGER" | "AI STEP" | "ACTION",
  group: string,
  title: string,
  description: string,
) => ({ id, kicker, group, title, description });
const invoiceAutomation = {
  templateId: "fixture-invoice",
  version: 4,
  name: "Invoice Processing",
  description:
    "Reads bills and receipts, then saves the details or records them in QuickBooks.",
  category: "Accounting",
  icon: "Receipt",
  // Its words for its documents, as its manifest declares them from v7 (backend BUILD-PLAN 27.2.1).
  documentWords: { singular: "Invoice", plural: "Invoices" },
  monthlyPriceUsd: 0,
  subscribed: true,
  available: true,
  usesAi: true,
  requiredConnections: [
    {
      providerId: quickbooksProvider.providerId,
      displayName: "QuickBooks Online",
      purpose: "Records bills and receipts.",
      optional: true,
    },
  ],
  setup: [
    {
      section: "connections",
      key: "vendor",
      title: "Integration",
      description: "Where the details go.",
      control: "connection",
      defaultValue: "none",
      required: false,
      providers: [quickbooksProvider.providerId],
      group: "connect",
    },
    {
      section: "rules",
      key: "holdAboveAmount",
      title: "Approval limit",
      description: "Amounts over this wait for approval.",
      control: "money",
      defaultValue: 500,
      required: false,
    },
  ],
  groups: [
    {
      id: "upload",
      title: "Upload invoice",
      description: "Add a PDF or photo.",
    },
    {
      id: "connect",
      title: "Connect integration",
      description: "QuickBooks, or None.",
    },
    {
      id: "process",
      title: "AI processing",
      description: "AI reads and checks each document.",
    },
    {
      id: "record",
      title: "Details saved",
      description: "Saved, or recorded in QuickBooks.",
      titleByConnection: {
        field: "vendor",
        titles: [
          {
            providerId: quickbooksProvider.providerId,
            title: "QuickBooks updated",
          },
        ],
      },
    },
    {
      id: "email",
      title: "Email sent",
      description: "The results are emailed.",
      platform: "email",
    },
  ],
  pipeline: [
    invoiceStep(
      "receive",
      "TRIGGER",
      "upload",
      "Document received",
      "A PDF or photo arrives.",
    ),
    invoiceStep(
      "extract",
      "AI STEP",
      "process",
      "Documents read",
      "AI reads each document.",
    ),
    invoiceStep(
      "check-documents",
      "ACTION",
      "process",
      "Documents checked",
      "Checks totals and dates.",
    ),
    invoiceStep(
      "verify-read",
      "AI STEP",
      "process",
      "Read again",
      "Only when something looks wrong.",
    ),
    invoiceStep(
      "read-company",
      "ACTION",
      "record",
      "QuickBooks checked",
      "Checks QuickBooks is connected.",
    ),
    invoiceStep(
      "read-preferences",
      "ACTION",
      "record",
      "QuickBooks settings read",
      "Reads currency and closed dates.",
    ),
    invoiceStep(
      "find-accounts",
      "ACTION",
      "record",
      "Accounts read",
      "Reads your accounts from QuickBooks.",
    ),
    invoiceStep(
      "find-vendors",
      "ACTION",
      "record",
      "Vendors looked up",
      "Finds each vendor in QuickBooks.",
    ),
    invoiceStep(
      "find-names",
      "ACTION",
      "record",
      "Names checked",
      "QuickBooks allows each name once.",
    ),
    invoiceStep(
      "find-duplicates",
      "ACTION",
      "record",
      "Duplicates checked",
      "Looks for the same number or amount.",
    ),
    invoiceStep(
      "find-related",
      "ACTION",
      "record",
      "Related records looked up",
      "Looks for a bill it pays.",
    ),
    invoiceStep(
      "decide",
      "ACTION",
      "record",
      "Ready to record?",
      "Records each one, or waits for approval.",
    ),
    invoiceStep(
      "create-vendors",
      "ACTION",
      "record",
      "Vendors added",
      "Adds new vendors.",
    ),
    invoiceStep(
      "create-records",
      "ACTION",
      "record",
      "Recorded in QuickBooks",
      "Creates bills and expenses.",
    ),
    invoiceStep(
      "save-documents",
      "ACTION",
      "record",
      "Details saved",
      "Saves the details for your team.",
    ),
    invoiceStep(
      "ask-approval",
      "ACTION",
      "record",
      "Needs your approval",
      "Waits for your approval.",
    ),
    invoiceStep(
      "confirm-company",
      "ACTION",
      "record",
      "Company checked again",
      "After approval.",
    ),
    invoiceStep(
      "confirm-vendors",
      "ACTION",
      "record",
      "Vendors checked again",
      "After approval.",
    ),
    invoiceStep(
      "create-approved-vendors",
      "ACTION",
      "record",
      "Approved vendors added",
      "After approval.",
    ),
    invoiceStep(
      "confirm-no-duplicates",
      "ACTION",
      "record",
      "Duplicates checked again",
      "After approval.",
    ),
    invoiceStep(
      "create-approved-records",
      "ACTION",
      "record",
      "Approved documents recorded",
      "After approval.",
    ),
    invoiceStep(
      "save-approved",
      "ACTION",
      "record",
      "Approved details saved",
      "After approval.",
    ),
  ],
} satisfies Automations["AutomationCatalogEntry"];

const invoiceSubscriptionId = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
// The workspace's Accounting team, which the platform made for the flow: on
// no list the fixture answers, so the card names it by its category.
const accountingTeamId = "acacacac-acac-4cac-8cac-acacacacacac";

function invoiceSubscription(): Automations["Subscription"] {
  if (state.invoiceV1) {
    return {
      ...invoiceV4Subscription(),
      templateVersion: 1,
      config: { defaultCategory: "Office supplies" },
      // v1 required QuickBooks; it declared no vendor setting.
      unmetConnections: state.quickbooksConnected
        ? []
        : [quickbooksProvider.providerId],
      setup: [
        {
          section: "rules",
          key: "defaultCategory",
          title: "Default category",
          description: "The account a purchase goes to.",
          control: "text",
          required: true,
        },
      ],
    };
  }
  return invoiceV4Subscription();
}

/**
 * Round 21 (the platform round's F1): ICD-10 Code Check's Specialties, a
 * required drop-down of several, on Invoice Processing's Set up when a test
 * asks.
 */
const specialtiesField: Automations["AutomationSetupField"] = {
  section: "rules",
  key: "specialties",
  title: "Specialties",
  description:
    "The specialties your clinic treats. Their codes are listed first when a code is picked.",
  control: "select",
  options: [
    "Nephrology",
    "Internal medicine",
    "Cardiology",
    "Endocrinology",
    "Family practice",
    "Geriatric medicine",
  ],
  multiple: true,
  required: true,
};

/**
 * A drop-down of one choice beside it (`multiple` absent, the contract's
 * default): one option, saved as a string.
 */
const placeOfCareField: Automations["AutomationSetupField"] = {
  section: "rules",
  key: "placeOfCare",
  title: "Place of care",
  description: "Where the visits this flow reads take place.",
  control: "select",
  options: ["Office", "Hospital", "Home"],
  required: true,
};

/** Invoice Processing's settings, with the Specialties and Place of care when asked for. */
function invoiceSetup(): Automations["AutomationSetupField"][] {
  return state.invoiceSpecialties
    ? [...invoiceAutomation.setup, specialtiesField, placeOfCareField]
    : invoiceAutomation.setup;
}

// On v4, the newest: the platform moves every flow there (backend ADR-0041).
function invoiceV4Subscription(): Automations["Subscription"] {
  const vendor = state.invoiceConfig.vendor;
  return {
    id: invoiceSubscriptionId,
    workspaceId,
    templateId: invoiceAutomation.templateId,
    templateVersion: 4,
    name: "Invoice Processing",
    status: state.invoiceStatus,
    config: state.invoiceConfig,
    // The chosen vendor, until it is connected (backend ADR-0037).
    unmetConnections:
      vendor === quickbooksProvider.providerId && !state.quickbooksConnected
        ? [quickbooksProvider.providerId]
        : [],
    triggerKind: "manual",
    setup: invoiceSetup(),
    runInput: [
      {
        key: "invoiceFile",
        title: "Document",
        description: "A PDF or photo of bills or receipts.",
        control: "artifact",
        required: false,
      },
    ],
    projectId: accountingTeamId,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  };
}

function quickbooksConnection(): Connections["Connection"] {
  return {
    id: quickbooksConnectionId,
    providerId: quickbooksProvider.providerId,
    workspaceId,
    externalAccount: { displayName: "Fixture Company" },
    status: "connected",
    requiredScopes: quickbooksProvider.scopes,
    grantedScopes: quickbooksProvider.scopes,
    usedByCount:
      state.invoiceConfig.vendor === quickbooksProvider.providerId ? 1 : 0,
  };
}

const webhookSubscriptionId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
const webhookEndpointId = "efefefef-efef-4fef-8fef-efefefefefef";
const exportJobId = "f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0";

function webhookSubscription(): Automations["Subscription"] {
  return {
    ...manualSubscription,
    id: webhookSubscriptionId,
    templateId: webhookAutomation.templateId,
    templateVersion: 1,
    triggerKind: "webhook",
    runInput: undefined,
    // The pinned version's settings (backend §12.1 #185): v1 declares none.
    setup: undefined,
  };
}

function fixtureCatalog(): Automations["AutomationCatalogResponse"] {
  // Nothing to add yet (build 10): the catalog a new platform answers.
  if (state.catalogEmpty) return { automations: [], categories: [] };
  return {
    automations: [
      automation("fixture-plan-limit", "Plan-limit automation"),
      automation("fixture-entitlements", "Entitlements automation"),
      manualAutomation,
      webhookAutomation,
      {
        ...archivableAutomation,
        subscribed: !state.archivableArchived || state.archivableAgain !== null,
      },
      {
        ...projectAutomation,
        subscribed: state.projectAutomationScopes.length > 0,
      },
      teamDraftAutomation,
      {
        ...(state.documentWordsDeclared
          ? invoiceAutomation
          : wordlessInvoice()),
        subscribed: state.invoiceAdded,
      },
      ...(state.itemsFlow ? [itemsAutomation] : []),
    ],
    categories: ["All", "Accounting", "Operations"],
  };
}

// Invoice Processing's entry with no word for its documents (`catalog-words-none`).
function wordlessInvoice(): Omit<typeof invoiceAutomation, "documentWords"> {
  const entry: Omit<typeof invoiceAutomation, "documentWords"> &
    Partial<Pick<typeof invoiceAutomation, "documentWords">> = {
    ...invoiceAutomation,
  };
  delete entry.documentWords;
  return entry;
}

// Round 19 (backend ADR-0046): a made-up flow with items — every word it
// shows comes from here, never from the website, which names no flow's things.
const itemsSubscriptionId = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1";
const readyItemId = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const readingItemId = "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3";
const failedItemId = "b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b4b4";
const emptyItemId = "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5";
const archivedItemId = "b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6";
const scoredRunId = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
// Build 28 (plan §1): the ready item's file, and the scored run's, each
// behind a signed link to the fixture's store.
const itemFileId = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1";
const entryFileId = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";
// Round 21 v2: the run the platform's image blocks open
// (`packages/contracts/fixtures/blocks` drawn-image and drawn-image-pdf), and
// its two files behind their signed links — a made-up 16 by 12 JPEG, and the
// made-up one-page PDF.
const pictureRunId = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const pictureJpegId = "0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e";
const picturePdfId = "0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f";
const fixtureJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAADAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgADAAQAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAf/aAAwDAQACEQMRAD8A+/qKKKAP/9k=",
  "base64",
);
const WORD_FILE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const areaOptions = ["North", "South"];
const itemsDeclared = {
  words: { singular: "Batch", plural: "Batches" },
  runWords: { singular: "Entry", plural: "Entries" },
  // Build 28 (plan §1): made-up words for a run's verdict.
  verdictWords: { positive: "Keep", negative: "Drop" },
  titleField: "name",
  groupField: "area",
  fields: [
    {
      key: "area",
      title: "Area",
      control: "select",
      options: areaOptions,
      allowOther: true,
      defaultValue: "North",
      required: true,
    },
    {
      key: "name",
      title: "Name",
      control: "text",
      maxLength: 60,
      required: true,
    },
  ],
  file: {
    key: "batchFile",
    title: "Batch file",
    description: "The batch to read.",
    acceptedContentTypes: [
      "application/pdf",
      WORD_FILE,
      "image/jpeg",
      "image/png",
    ],
  },
} satisfies Automations["AutomationItems"];

const itemsRunInput = [
  {
    key: "entryFile",
    title: "Entry file",
    description: "One entry to read.",
    control: "artifact",
    required: false,
    acceptedContentTypes: ["application/pdf", WORD_FILE],
  },
] satisfies Automations["AutomationRunInputField"][];

const itemsAutomation = {
  ...automation("fixture-items", "Item automation"),
  // A department of two words (the review of build 28, finding 4).
  category: "Customer Support",
  subscribed: true,
  usesAi: true,
  pipeline: [
    {
      id: "entry-received",
      kicker: "TRIGGER",
      title: "Entry received",
      description: "An entry is given.",
    },
  ],
  items: itemsDeclared,
} satisfies Automations["AutomationCatalogEntry"];

function itemsSubscription(): Automations["Subscription"] {
  return {
    id: itemsSubscriptionId,
    workspaceId,
    templateId: itemsAutomation.templateId,
    templateVersion: 1,
    status: "live",
    config: {},
    unmetConnections: [],
    triggerKind: "manual",
    setup: [],
    runInput: itemsRunInput,
    items: itemsDeclared,
    projectId: null,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  };
}

function fixtureItem(
  id: string,
  area: string,
  name: string,
  createdAt: string,
  rest: Partial<Automations["Item"]> = {},
): Automations["Item"] {
  return {
    id,
    subscriptionId: itemsSubscriptionId,
    title: name,
    fields: { area, name },
    status: "ready",
    runCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    topScore: null,
    createdAt,
    createdByUserId: userId,
    archivedAt: null,
    ...rest,
  };
}

// Newest first, as the platform lists them. Grouped on the page as North
// (Autumn, then Winter), South, then the typed Coastal; Inland's only item is
// archived, so it is offered on the upload card and draws no group.
function fixtureItems(): Automations["Item"][] {
  return [
    fixtureItem(
      emptyItemId,
      "North",
      "Autumn intake",
      "2026-08-12T11:00:00.000Z",
    ),
    fixtureItem(
      readingItemId,
      "North",
      "Winter intake",
      "2026-08-12T10:00:00.000Z",
      { status: "reading" },
    ),
    fixtureItem(
      readyItemId,
      "South",
      "Spring intake",
      "2026-08-12T09:00:00.000Z",
      {
        runCount: 4,
        positiveCount: 1,
        negativeCount: 1,
        topScore: 91,
        file: fixtureFile(itemFileId, "spring-intake.pdf"),
        sections: [
          {
            title: "Summary",
            entries: [{ title: "Spring intake", text: "Three must-haves." }],
          },
          {
            title: "Must-haves",
            entries: [{ title: "First" }, { title: "Second" }],
          },
        ],
      },
    ),
    fixtureItem(
      failedItemId,
      "Coastal",
      "Harbour list",
      "2026-08-12T08:00:00.000Z",
      { status: "failed", failureReason: "The file had no text." },
    ),
    fixtureItem(
      archivedItemId,
      "Inland",
      "Old list",
      "2026-08-01T08:00:00.000Z",
      {
        archivedAt: "2026-08-02T08:00:00.000Z",
      },
    ),
  ];
}

function itemRun(
  id: string,
  status: Automations["Run"]["status"],
  rest: Partial<Automations["Run"]> = {},
): Automations["Run"] {
  return {
    id,
    workspaceId,
    subscriptionId: itemsSubscriptionId,
    templateId: itemsAutomation.templateId,
    templateVersion: 1,
    status,
    origin: "manual",
    rootRunId: id,
    requestId: "fixture-request",
    itemId: readyItemId,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    ...rest,
  };
}

// As readItem ranks them: highest score first, then those without one,
// newest first.
function readyItemRuns(): Automations["Run"][] {
  return [
    itemRun(scoredRunId, "succeeded", {
      title: "Ada Lane",
      score: 91,
      verdict: "positive",
      resultSummary: "Strong fit · 3 of 3",
      endedAt: now,
    }),
    itemRun("c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2", "succeeded", {
      title: "Ben Ito",
      score: 64,
      verdict: "negative",
      resultSummary: "Fair fit · 2 of 3",
      endedAt: now,
    }),
    itemRun("c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3", "running"),
    itemRun("c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4", "failed", {
      failureReason: "The file could not be read.",
      endedAt: now,
    }),
  ];
}

// What the scored run read, for its page: the first section open, the others
// closed; a link only when it is https or http.
const scoredRunSections: Automations["RunSection"][] = [
  {
    title: "Contact",
    entries: [
      {
        title: "ada@example.test",
        subtitle: "Email",
        url: "https://example.test/ada",
      },
      { title: "Not a link", url: "javascript:alert(1)" },
    ],
  },
  {
    title: "Experience",
    entries: [
      {
        title: "Lead · Example Co",
        subtitle: "2021 – now",
        text: "Ran the example team.",
      },
    ],
  },
  { title: "Education", entries: [{ title: "Example School" }] },
];

/** A made-up uploaded file: a one-page PDF, its bytes the fixture's own. */
function fixtureFile(id: string, filename: string): Automations["RunFile"] {
  return {
    id,
    filename,
    contentType: "application/pdf",
    format: "PDF",
    sizeBytes: fixturePdf(id).byteLength,
    pages: 1,
  };
}

/** A signed link to one of the fixture's uploaded files (`RunFileLink`). */
function fixtureFileLink(file: Automations["RunFile"]): Json {
  return {
    file,
    downloadUrl: signedLink(
      `https://127.0.0.1:${port}/__fixture/run-file?id=${encodeURIComponent(file.id)}&name=${encodeURIComponent(file.filename)}`,
    ),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  } satisfies Automations["RunFileLink"];
}

function itemOf(itemId: string): Automations["Item"] | undefined {
  return state.items.find((item) => item.id === itemId);
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
  // Pinned at the catalog's v1, so its settings are that entry's (backend §12.1 #185).
  setup: manualAutomation.setup,
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
// Its fresh copy, once unarchived: a new subscription, as the platform makes one.
const archivableAgainId = "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2";

// The team draft automation, already added to the fixture project and still a
// draft: its card lists this row under the project and, the flow held, offers
// no team (register F21; the owner's build 12, #9).
const projectDraftSubscription = {
  ...manualSubscription,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  templateId: teamDraftAutomation.templateId,
  status: "draft",
  runInput: undefined,
  projectId,
} satisfies Automations["Subscription"];

function projectAutomationSubscription(
  scope: string | null,
): Automations["Subscription"] {
  return {
    ...manualSubscription,
    // One row per scope, each with its own id: the whole workspace, the fixture
    // project, or a team a test created, told apart by its id's first group.
    id:
      scope === null
        ? "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
        : scope === projectId
          ? "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
          : `cccccccc-cccc-4ccc-8ccc-${scope.slice(0, 8)}cccc`,
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
// Invoice Processing's runs (Build 21, spec A7; backend ADR-0039): one that
// read three receipts from one photo, from three sellers, and saved each — the
// owner's ~04:05Z, "it was 3 receipts in one picture"; one held for a
// document whose total could not be read, its approval refused; v2's run
// 793eef82 as it failed on 2026-10-15, titled then by its request id; and the
// one a person starts from Step 1, which goes as the fixture advances it.
const invoiceRunId = "fixture-run-invoice";
const invoiceHeldRunId = "fixture-run-invoice-held";
const invoiceV2RunId = "793eef82-102d-81be-a2d3-9e8d4e2b2c36";
const invoiceStartedRunId = "fixture-run-invoice-started";
const invoiceRunIds = [invoiceRunId, invoiceHeldRunId, invoiceV2RunId];

/** One of three receipts as v3 writes it (spec §1.1, AM7). */
function receipt(
  index: number,
  overrides: Partial<Automations["RunDocument"]>,
): Automations["RunDocument"] {
  return {
    index,
    status: "saved",
    statusText: "Saved",
    type: "receipt",
    vendor: { name: null, address: null, city: null, storeNumber: null },
    number: null,
    numberLabel: null,
    references: [],
    date: "2026-10-14",
    time: null,
    currency: "USD",
    lineItems: [],
    lineItemsComplete: true,
    subtotal: null,
    tax: null,
    tip: null,
    discount: null,
    total: null,
    payment: { method: "not_shown", cardLast4: null },
    recordedIn: null,
    details: [],
    ...overrides,
  };
}

const threeReceipts: Automations["RunDocument"][] = [
  receipt(1, {
    vendor: {
      name: "Lowe's",
      address: "2150 W Shaw Ave",
      city: "Fresno, CA 93711",
      storeNumber: "1234",
    },
    number: "48291",
    numberLabel: "Receipt #",
    references: [{ label: "Register", value: "07" }],
    time: "14:32",
    lineItems: [
      {
        description: "2X4-8 STUD",
        quantity: "4",
        unitPrice: "3.98",
        amount: "15.92",
      },
    ],
    subtotal: "15.92",
    tax: "1.27",
    total: "17.19",
    payment: { method: "card", cardLast4: "4417" },
    details: [{ label: "Category", value: "Materials" }],
  }),
  receipt(2, {
    vendor: {
      name: "The Home Depot",
      address: "3780 W Shaw Ave",
      city: "Fresno, CA 93711",
      storeNumber: null,
    },
    number: "6620-00071",
    lineItems: [
      {
        description: "Wood screws",
        quantity: "2",
        unitPrice: "8.47",
        amount: "16.94",
      },
      { description: "Bag", quantity: null, unitPrice: null, amount: "0.10" },
    ],
    lineItemsComplete: false,
    subtotal: "17.04",
    tax: "1.36",
    discount: "2.00",
    total: "16.40",
    payment: { method: "cash", cardLast4: null },
  }),
  receipt(3, {
    vendor: {
      name: "Shell",
      address: null,
      city: "Clovis, CA",
      storeNumber: null,
    },
    references: [{ label: "Auth code", value: "559301" }],
    time: "07:05",
    total: "51.00",
    payment: { method: "card", cardLast4: "1234" },
  }),
];

// The files each job was given (Build 24, P10; `RunDetail.files`): one photo
// of three receipts; and the held job's two, each of its documents naming its
// own (Invoice Processing v6's `source`). Made-up names and sizes.
const receiptsPhoto: Automations["RunFile"] = {
  id: "f0f0f0f0-0000-4000-8000-000000000001",
  filename: "receipts.jpg",
  contentType: "image/jpeg",
  format: "JPEG",
  sizeBytes: 482_113,
  pages: 1,
};
const heldBill: Automations["RunFile"] = {
  id: "f0f0f0f0-0000-4000-8000-000000000002",
  filename: "acme-bill.pdf",
  contentType: "application/pdf",
  format: "PDF",
  sizeBytes: 91_204,
  pages: 2,
};
const heldPhoto: Automations["RunFile"] = {
  id: "f0f0f0f0-0000-4000-8000-000000000003",
  filename: "feed-receipt.png",
  contentType: "image/png",
  format: "PNG",
  sizeBytes: 230_871,
  pages: 1,
};

const heldDocuments: Automations["RunDocument"][] = [
  receipt(1, {
    source: { file: heldBill.id, pages: [1, 2] },
    vendor: {
      name: "Acme Supplies",
      address: null,
      city: null,
      storeNumber: null,
    },
    type: "bill",
    number: "INV-7",
    numberLabel: "Invoice #",
    total: "120.00",
  }),
  receipt(2, {
    source: { file: heldPhoto.id },
    status: "waiting",
    statusText: "Waiting for approval: the total can't be read",
    vendor: {
      name: "Fresno Feed",
      address: null,
      city: null,
      storeNumber: null,
    },
  }),
];

/** What each Invoice Processing run reported, in order, by step id. */
function invoiceSteps(runId: string): Automations["RunStep"][] {
  const reported: (readonly [string, "ok" | "held" | "failed", string])[] =
    runId === invoiceV2RunId
      ? [
          ["receive", "ok", "PDF, 1 page"],
          ["read-company", "ok", "QuickBooks: Autom8x Test Co"],
          ["read-preferences", "ok", "Preferences read"],
          ["find-accounts", "ok", "34 accounts read"],
          ["extract", "ok", "Read: receipt from Lowe's"],
          ["check-document", "failed", "Add one document per file."],
        ]
      : runId === invoiceHeldRunId
        ? [
            ["receive", "ok", "Photo, 1 page"],
            ["extract", "ok", "Read: 2 documents"],
            ["check-documents", "ok", "Totals checked"],
            ["verify-read", "ok", "Read again"],
            ["decide", "ok", "1 ready, 1 waiting"],
            ["save-documents", "ok", "1 saved"],
            // Still going while its page is open (R5c 1): not held yet.
            ...(state.heldJobLive === "running"
              ? []
              : ([["ask-approval", "held", "Waiting for approval"]] as const)),
            // Approved, the job goes on under its own id (backend ADR-0044):
            // its next step joins the same timeline.
            ...(invoiceApprovalNow().status === "approved"
              ? ([["confirm-company", "ok", "Company checked again"]] as const)
              : []),
          ]
        : runId === invoiceStartedRunId && state.invoiceRunStage < 2
          ? state.invoiceRunStage === 1
            ? [["receive", "ok", "Photo, 1 page"]]
            : []
          : [
              ["receive", "ok", "Photo, 1 page"],
              ["extract", "ok", "Read: 3 receipts"],
              ["check-documents", "ok", "Totals checked"],
              ["decide", "ok", "3 ready"],
              ["save-documents", "ok", "3 saved"],
            ];
  return reported.map(([stepId, outcome, summary], index) => ({
    id: `${runId}-step-${index + 1}`,
    runId,
    workspaceId,
    stepId,
    outcome,
    summary,
    ...(outcome === "held"
      ? { heldReason: "Document 2: the total can't be read." }
      : {}),
    occurredAt: new Date(Date.parse(now) + index * 60_000).toISOString(),
  }));
}

/** The files an Invoice Processing job was given, on its one-run read. */
function invoiceFiles(runId: string): Automations["RunFile"][] {
  return runId === invoiceHeldRunId ? [heldBill, heldPhoto] : [receiptsPhoto];
}

/** The documents an Invoice Processing run wrote, on its one-run read. */
function invoiceDocuments(runId: string): Automations["RunDocument"][] {
  if (runId === invoiceRunId) return threeReceipts;
  if (runId === invoiceHeldRunId) return heldDocuments;
  if (runId === invoiceStartedRunId && state.invoiceRunStage >= 2)
    return threeReceipts;
  return [];
}

/**
 * Whether each Invoice Processing run's email went out (Build 22, P5c;
 * `RunDetail.email`): the finished run's and the held run's sent; run
 * 793eef82, from before, none; the run started from Step 1 owed once it ends,
 * then sent (stage 3).
 */
function invoiceEmail(runId: string): Automations["RunEmailState"] {
  const at = (seconds: number) =>
    new Date(Date.parse(now) + seconds * 1000).toISOString();
  if (runId === invoiceRunId) return { status: "sent", sentAt: at(21) };
  if (runId === invoiceHeldRunId) return { status: "sent", sentAt: at(390) };
  if (runId === invoiceV2RunId) return { status: "not_sent", sentAt: null };
  return state.invoiceRunStage >= 3
    ? { status: "sent", sentAt: at(154) }
    : { status: "waiting", sentAt: null };
}

const invoiceApprovalId = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";

/** Its approval, refused (S21: its waiting document reads Not approved). */
function invoiceApproval(): Automations["Approval"] {
  return {
    id: invoiceApprovalId,
    runId: invoiceHeldRunId,
    workspaceId,
    subscriptionId: invoiceSubscriptionId,
    stepId: "ask-approval",
    status: "rejected",
    reason: "Document 2: the total can't be read.",
    eligibleRoles: ["owner", "admin"],
    createdAt: now,
    expiresAt: now,
    decidedAt: now,
    decidedByUserId: userId,
  };
}

/**
 * The held job's approval still waiting (Build 24, P6): Approve and Deny in
 * its step 4 and on Approvals; a decision is kept in `state.approvals`.
 */
function pendingInvoiceApproval(): Automations["Approval"] {
  const asked = invoiceApproval();
  delete asked.decidedAt;
  delete asked.decidedByUserId;
  return {
    ...asked,
    status: "pending",
    expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  };
}

/**
 * The held job's approval as a review (Round 21, the platform round's F2;
 * two changes to accept or deny one by one, in ICD-10 Code Check's words
 * for them.
 */
function pendingInvoiceReview(): Automations["Approval"] {
  const review: Automations["Approval"] = {
    ...pendingInvoiceApproval(),
    reason: "2 changes need your review.",
    decisions: [
      {
        id: "change-1",
        label: "N18.4 → Remove",
        detail:
          "Kidney failure (N18.6) is coded, so no stage code goes beside it.",
      },
      { id: "change-2", label: "Add Z99.2" },
    ],
  };
  return review;
}

/** The held job's approval as the platform holds it now: waiting or decided, else refused. */
function invoiceApprovalNow(): Automations["Approval"] {
  return (
    state.approvals.find((entry) => entry.id === invoiceApprovalId) ??
    invoiceApproval()
  );
}

// One deterministic run by id: the failed one carries the automation's own
// reason, the succeeded one its summary. Listed by Activity and read by its
// page, so both handlers describe the same run.
function fixtureRun(runId: string): Automations["Run"] {
  if (runId === invoiceStartedRunId) {
    const stage = state.invoiceRunStage;
    return {
      id: runId,
      workspaceId,
      subscriptionId: invoiceSubscriptionId,
      templateId: invoiceAutomation.templateId,
      templateVersion: 4,
      status: stage === 0 ? "pending" : stage === 1 ? "running" : "succeeded",
      origin: "manual",
      rootRunId: runId,
      requestId: "fixture-request",
      ...(stage >= 2 ? { resultSummary: "3 receipts: 3 saved." } : {}),
      startedAt: now,
      ...(stage >= 2
        ? { endedAt: new Date(Date.parse(now) + 19_000).toISOString() }
        : {}),
      createdAt: now,
      updatedAt: now,
    };
  }
  if (invoiceRunIds.includes(runId)) {
    const v2 = runId === invoiceV2RunId;
    // Approved, the held job runs on under the same id (backend ADR-0044);
    // and it runs while its page is open, before it holds (R5c 1).
    const continued =
      runId === invoiceHeldRunId &&
      (invoiceApprovalNow().status === "approved" ||
        state.heldJobLive === "running");
    const held = runId === invoiceHeldRunId && !continued;
    return {
      id: runId,
      workspaceId,
      subscriptionId: invoiceSubscriptionId,
      templateId: invoiceAutomation.templateId,
      templateVersion: v2 ? 2 : 3,
      status: v2
        ? "failed"
        : held
          ? "held"
          : continued
            ? "running"
            : "succeeded",
      origin: "manual",
      rootRunId: runId,
      // The request id the app once titled run 793eef82 by: never shown.
      requestId: v2
        ? "1e3231c6-0000-4000-8000-000000000000"
        : "fixture-request",
      ...(v2
        ? { failureReason: "Add one document per file." }
        : held || continued
          ? {}
          : { resultSummary: "3 receipts: 3 saved." }),
      startedAt: now,
      ...(continued
        ? {}
        : { endedAt: new Date(Date.parse(now) + 19_000).toISOString() }),
      createdAt: now,
      updatedAt: now,
    };
  }
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

/**
 * The runs list as the platform that searches, sorts, pages and counts it
 * answers (backend ADR-0048 amendment 1, decision 4): 30 made-up runs, newest
 * first, `q` matched in a run's id, `sort` newest or oldest, `page` of 25,
 * and `total`, the runs that match.
 */
function countedRuns(
  url: URL,
): AutomationOperations["listRuns"]["responses"][200]["content"]["application/json"] {
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const all = Array.from({ length: 30 }, (_, at) => ({
    ...fixtureRun(okRunId),
    id: `fixture-counted-${String(at + 1).padStart(2, "0")}`,
    createdAt: new Date(Date.parse(now) - at * 60_000).toISOString(),
  })).filter((run) => run.id.includes(q));
  const ordered =
    url.searchParams.get("sort") === "oldest" ? [...all].reverse() : all;
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  return {
    runs: ordered.slice((page - 1) * 25, page * 25),
    total: ordered.length,
  };
}

/**
 * A made-up run package PDF (Build 24, P12): one Letter page that names the
 * job — a real PDF, built here with its cross-reference table, so a browser
 * can show it. Never the owner's sample package.
 */
function fixturePdf(runId: string): Buffer {
  const text = `BT /F1 18 Tf 72 720 Td (Fixture run package ${runId.replace(/[()\\]/gu, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const table = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/** Made-up workbook bytes: a ZIP's signature and a line, never opened by a test. */
function fixtureWorkbook(): Buffer {
  return Buffer.from("PK\u0003\u0004 fixture run package workbook", "latin1");
}

/** The platform's tally of the listed runs, as `readRunStats` answers it. */
function fixtureRunStats(since: string | null): Automations["RunStats"] {
  const tally = (runIds: readonly string[]) => {
    const counts = {
      total: 0,
      pending: 0,
      running: 0,
      held: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const runId of runIds) {
      const { status } = fixtureRun(runId);
      counts.total += 1;
      if (status in counts) counts[status as keyof typeof counts] += 1;
    }
    return counts;
  };
  const counts = tally(listedRunIds);
  return {
    ...(since ? { since } : {}),
    workspace: counts,
    subscriptions: [
      { subscriptionId: manualSubscriptionId, ...counts },
      // Invoice Processing's own (Build 21, spec A6: its flow page's
      // Dashboard), the run started from Step 1 counted as it goes.
      ...(state.invoiceAdded
        ? [
            {
              subscriptionId: invoiceSubscriptionId,
              ...tally([
                ...(state.invoiceRunStarted ? [invoiceStartedRunId] : []),
                ...invoiceRunIds,
              ]),
            },
          ]
        : []),
    ],
  };
}

// Billing (ADR-0025): the free floor never appears in the plan list, and a
// workspace that has never paid reports the free plan with no status. A
// checkout makes the bought plan `active` — the fixture's stand-in for the
// provider webhook that does it in production — and, once a workspace has a
// plan, a second checkout is refused with `plan_exists` (backend 24.12). Each
// test starts from the fixture's first state. Two plans, at the provider's
// prices (backend ADR-0031), listed by id as the platform lists them — Pro
// before Plus — so the website's own order is by price. Plus is the platform's
// `team` plan renamed: its id stays (build 10). Each carries capabilities, as
// the contract requires, which no card prints.
const plusPlan = {
  planId: "fixture-team",
  displayName: "Plus",
  capabilities: { "automation.subscribe": 10, "workspace.rate": 120 },
  price: { amount: 500, currency: "usd", interval: "month" },
} satisfies Platform["PurchasablePlan"];
const proPlan = {
  planId: "fixture-pro",
  displayName: "Pro",
  capabilities: { "automation.subscribe": 50, "workspace.rate": 240 },
  price: { amount: 1000, currency: "usd", interval: "month" },
} satisfies Platform["PurchasablePlan"];
function listedPlans(): Platform["PurchasablePlan"][] {
  // A platform with no Pro row lists Plus alone (build 10); an unstated price
  // is absent from the answer, as the contract has it.
  if (state.proUnlisted) return [plusPlan];
  return [
    state.proPriceUnstated ? { ...proPlan, price: undefined } : proPlan,
    plusPlan,
  ];
}
const hostedExpiry = "2026-08-12T12:30:00.000Z";

function problem(
  status: number,
  title: string,
  details?: Json,
): Platform["ApiProblem"] {
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

// A refusal a test names: its status's own title, and the reason the contract
// puts in `details` — so a reason the website does not name reads as the title.
const statusTitles: Record<number, string> = {
  400: "Bad Request",
  403: "Forbidden",
  409: "Conflict",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  503: "Service Unavailable",
};

function refusal(status: number, reason?: string): Platform["ApiProblem"] {
  return problem(
    status,
    statusTitles[status] ?? "Refused",
    reason ? { reason } : undefined,
  );
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

/**
 * A signed link as the fixture answers it: its own HTTPS store, or, when a
 * test says so (R5c 2), the same address over `http:`, or a `javascript:`
 * one that marks the page it ran in.
 */
function signedLink(https: string): string {
  if (state.signedLinkScheme === "http")
    return https.replace(/^https:/u, "http:");
  if (state.signedLinkScheme === "javascript")
    return "javascript:document.title='followed'";
  return https;
}

/*
 * The page bodies (backend ADR-0048): a one-run or one-item read that sends
 * `shape=blocks` is answered as the platform's composer answers it — the run
 * without details, documents and sections, with `blocks` and
 * `packageAvailable`; the item with `runs: []`, `blocks`, `going` and its
 * reading on `item.blocks`. `page-bodies.ts` builds them from the fixture's
 * own made-up answers by the platform's rules, and
 * `test/fixture-page-bodies.test.mjs` holds it to the platform's published
 * bodies, so a test reads the body a page draws. The platform's own bodies
 * (`packages/contracts/fixtures/blocks`) are served as they are under
 * `blocks-{name}` run ids, for the scans and the screenshots.
 */
type Block = Automations["Block"];

/** The job's approvals as the platform holds them: the list's, the held job's by its state. */
function jobApprovals(runId: string): Automations["Approval"][] {
  const unlisted =
    runId === invoiceHeldRunId &&
    (state.heldJobLive === "running" || state.heldApprovalHiddenReads > 0);
  return [
    ...state.approvals,
    ...(state.approvals.some((entry) => entry.id === invoiceApprovalId)
      ? []
      : [invoiceApproval()]),
  ].filter(
    (entry) =>
      entry.runId === runId && !(unlisted && entry.id === invoiceApprovalId),
  );
}

/** A run's page body, from its answer: files, outcome, result (`pages.run`). */
function runBody(detail: Json): Json {
  const named = /^blocks-(.+)$/u.exec(String((detail.run as Json).id));
  const fixture = named ? publishedBlocks(named[1] ?? "") : undefined;
  const run = detail.run as Automations["Run"];
  const { details, documents, sections, ...rest } =
    detail as Automations["RunDetail"] & Json;
  if (fixture) return { ...rest, blocks: fixture, packageAvailable: false };
  const subscription = [
    invoiceSubscription(),
    ...(state.itemsFlow ? [itemsSubscription()] : []),
  ].find((candidate) => candidate.id === run.subscriptionId);
  const entry = fixtureCatalog().automations.find(
    (candidate) => candidate.templateId === run.templateId,
  );
  const newest = jobApprovals(run.id)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .at(-1);
  // The held job's read counted; a read the test left its approval off of
  // spent, after this one is answered without it (R5c 1).
  if (run.id === invoiceHeldRunId) {
    state.heldJobBlockReads += 1;
    if (state.heldApprovalHiddenReads > 0 && state.heldJobLive !== "running")
      state.heldApprovalHiddenReads -= 1;
  }
  const runWord = subscription?.items?.runWords.singular;
  const documentWord = entry?.documentWords?.singular;
  return {
    ...rest,
    blocks: runBlocks({
      run,
      files: (detail.files as Automations["RunFile"][] | undefined) ?? [],
      ...(details ? { details } : {}),
      ...(documents ? { documents } : {}),
      ...(sections ? { sections } : {}),
      ...(newest ? { approval: newest } : {}),
      ...(runWord ? { runWord } : {}),
      ...(documentWord ? { documentWord } : {}),
      fileFields: (subscription?.runInput ?? []).filter(
        (field) => field.control === "artifact",
      ),
    }),
    packageAvailable:
      (documents?.length ?? 0) > 0 &&
      run.status !== "pending" &&
      run.status !== "running",
  };
}

/** An item's page body, from its answer: tiles, file, add, runs (`pages.item`). */
function itemPageBody(answer: Json): Json {
  const item = answer.item as Automations["Item"];
  const runs = (answer.runs as Automations["Run"][] | undefined) ?? [];
  const page = itemBody({
    item,
    runs,
    declared: itemsDeclared,
    runFile: itemsRunInput.some((field) => field.control === "artifact"),
  });
  const reading =
    page.reading && state.itemReadingBroken
      ? [
          {
            type: "table",
            columns: [{ title: "Field" }, { title: "Value" }],
          } as unknown as Block,
          ...page.reading,
        ]
      : page.reading;
  return {
    item: reading ? { ...item, blocks: reading } : item,
    runs: [],
    blocks: page.blocks,
    going: page.going,
  };
}

/** Each page's parts, as the platform's `resolvePages` gives a manifest that declares none. */
function withPages(subscription: Json): Json {
  const items = subscription.items as
    Automations["AutomationItems"] | undefined;
  return {
    ...subscription,
    pages: subscription.pages ?? {
      flow: items ? ["items"] : ["dashboard", "steps"],
      item: items
        ? items.verdictWords
          ? ["tiles", "file", "add", "runs"]
          : ["file", "add", "runs"]
        : [],
      run: ["files", "outcome", "result"],
      file: ["viewer", "reading"],
    },
  };
}

/** The platform's published fixture bodies, by name (`block-fixtures.ts`). */
let published: { name: string; blocks: readonly unknown[] }[] = [];
void import(
  new URL(
    "../../lib/generated/platform-contracts/block-fixtures.ts",
    import.meta.url,
  ).href
).then((module: { BLOCK_FIXTURES: typeof published }) => {
  published = module.BLOCK_FIXTURES;
});
function publishedBlocks(name: string): Block[] | undefined {
  return published.find((fixture) => fixture.name === name)?.blocks as
    Block[] | undefined;
}

/** What a response answers as: a page body, the flows with their pages, or itself. */
const shapes = new WeakMap<
  import("node:http").ServerResponse,
  "run" | "item" | "subscriptions"
>();

function respond(
  response: import("node:http").ServerResponse,
  status: number,
  answer: Json,
) {
  const shape = status === 200 ? shapes.get(response) : undefined;
  const body =
    shape === "run"
      ? runBody(answer)
      : shape === "item"
        ? itemPageBody(answer)
        : shape === "subscriptions" && Array.isArray(answer.subscriptions)
          ? {
              ...answer,
              subscriptions: (answer.subscriptions as Json[]).map(withPages),
            }
          : answer;
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

// A request's body, read once: a route may look at it before the one that
// answers it reads it again.
const bodies = new WeakMap<import("node:http").IncomingMessage, Json>();
async function requestJson(request: import("node:http").IncomingMessage) {
  const read = bodies.get(request);
  if (read) return read;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  const body = text ? (JSON.parse(text) as Json) : {};
  bodies.set(request, body);
  return body;
}

const server = createServer(
  { cert: readFileSync(certificate), key: readFileSync(privateKey) },
  async (request, response) => {
    const url = new URL(request.url ?? "/", `https://127.0.0.1:${port}`);
    // A one-run or one-item read asked for its page body (ADR-0048), and the
    // flows, which the platform lists with their pages.
    if (request.method === "GET") {
      const blocks = url.searchParams.get("shape") === "blocks";
      if (
        blocks &&
        /^\/v1\/workspaces\/[^/]+\/runs\/[^/]+$/u.test(url.pathname)
      )
        shapes.set(response, "run");
      else if (
        blocks &&
        /^\/v1\/workspaces\/[^/]+\/items\/[^/]+$/u.test(url.pathname)
      )
        shapes.set(response, "item");
      else if (/^\/v1\/workspaces\/[^/]+\/subscriptions$/u.test(url.pathname))
        shapes.set(response, "subscriptions");
    }
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
    // A control that takes a value answers 400 for one it cannot use, so a
    // test that names a wrong one fails there rather than testing nothing.
    const controls: Record<string, () => boolean | void> = {
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
      // Build 24 (P12): the platform busy building others' packages — for the
      // next ask, or the next two — and a signed file over the site's bound.
      "/__fixture/package-busy": () => {
        state.packageBusy = 1;
      },
      "/__fixture/package-busy-twice": () => {
        state.packageBusy = 2;
      },
      "/__fixture/package-file-oversized": () => {
        state.packageFileOversized = true;
      },
      // Build 24 (P6, P7): the held Invoice Processing job's approval waits
      // too — beside any other that waits.
      // Round 21 (F2): the held job's approval a review of two changes.
      "/__fixture/invoice-review-pending": () => {
        state.approvals = [
          ...state.approvals.filter((entry) => entry.id !== invoiceApprovalId),
          pendingInvoiceReview(),
        ];
      },
      // Round 21 (F1): Set up draws a required drop-down of several.
      "/__fixture/invoice-specialties": () => {
        state.invoiceSpecialties = true;
      },
      "/__fixture/invoice-approval-pending": () => {
        state.approvals = [
          ...state.approvals.filter((entry) => entry.id !== invoiceApprovalId),
          pendingInvoiceApproval(),
        ];
      },
      // Build 25 (the review's R5c 1): the held job still going, no approval
      // asked yet — then held, its approval waiting but left off the next
      // `hidden` reads of the list (1 unless named), as a list read just
      // before the approval was made.
      "/__fixture/held-job-running": () => {
        state.heldJobLive = "running";
      },
      "/__fixture/held-job-holds": () => {
        const hidden = Number(url.searchParams.get("hidden") ?? "1");
        if (!Number.isSafeInteger(hidden) || hidden < 0) return false;
        state.heldJobLive = "held";
        state.heldApprovalHiddenReads = hidden;
        state.approvals = [
          ...state.approvals.filter((entry) => entry.id !== invoiceApprovalId),
          pendingInvoiceApproval(),
        ];
      },
      // Build 25 (the review's R5c 2): the package's and the complete
      // export's signed links answered as `http:` or `javascript:`.
      "/__fixture/signed-link-scheme": () => {
        const scheme = url.searchParams.get("scheme");
        if (scheme !== "http" && scheme !== "javascript") return false;
        state.signedLinkScheme = scheme;
      },
      // Build 25's audit: one read of the approvals list refused, as a busy
      // platform refuses one (a run page's re-read meets it), and the flows
      // or the catalog that an Approvals row's headline joins, unreadable.
      "/__fixture/approvals-failing-once": () => {
        state.approvalListFailing = 1;
      },
      // §12.1 #300: the next `count` reads of a run refused, several in a row.
      "/__fixture/run-reads-failing": () => {
        const count = Number(url.searchParams.get("count") ?? "1");
        if (!Number.isSafeInteger(count) || count < 1) return false;
        state.runReadsFailing = count;
      },
      // #58's audit: the catalog's Invoice Processing declares no word.
      "/__fixture/catalog-words-none": () => {
        state.documentWordsDeclared = false;
      },
      "/__fixture/subscriptions-failing": () => {
        state.subscriptionsFailing = true;
      },
      "/__fixture/catalog-failing": () => {
        state.catalogFailing = true;
      },
      "/__fixture/billing-not-configured": () => {
        state.billingNotConfigured = true;
      },
      "/__fixture/billing-cancelled": () => {
        state.billingCancelled = true;
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
      // Backend ADR-0036: the next Add refused, as the platform refuses one.
      "/__fixture/add-not-found": () => {
        state.addRefusal = 404;
      },
      "/__fixture/add-team-service-down": () => {
        state.addRefusal = 502;
      },
      // Backend ADR-0037: QuickBooks connected, and Invoice Processing's flow
      // paused, so a vendor it is not connected to can be chosen.
      "/__fixture/quickbooks-connected": () => {
        state.quickbooksConnected = true;
      },
      "/__fixture/vendor-change-refused": () => {
        state.vendorChangeRefused = true;
      },
      "/__fixture/invoice-paused": () => {
        state.invoiceStatus = "paused";
      },
      "/__fixture/invoice-v1": () => {
        state.invoiceV1 = true;
      },
      // Build 21 (spec A6): Invoice Processing not added yet, so its card
      // offers Add; and the run started from Step 1 going on a step.
      "/__fixture/invoice-not-added": () => {
        state.invoiceAdded = false;
      },
      // Build 21 (spec A4): Google not connected — and then connected by
      // someone else, after a page read it.
      "/__fixture/google-disconnected": () => {
        state.googleConnected = false;
      },
      "/__fixture/google-connected": () => {
        state.googleConnected = true;
      },
      "/__fixture/invoice-run-started": () => {
        state.invoiceRunStarted = true;
        state.invoiceRunStage = 0;
      },
      // Stage 3: ended, and its email sent (Build 22, P5c).
      "/__fixture/invoice-run-advance": () => {
        state.invoiceRunStage = Math.min(3, state.invoiceRunStage + 1);
      },
      // Build 22 (spec §4, P5): who gets the email — its read failing, its
      // save refused, its extra addresses at the limit or none.
      "/__fixture/email-recipients-failing": () => {
        state.emailRecipientsFailing = true;
      },
      "/__fixture/email-recipients-refusing": () => {
        state.emailRecipientsRefusing = true;
      },
      "/__fixture/email-recipients-full": () => {
        state.emailExtra = Array.from(
          { length: 10 },
          (_, index) => `person${index + 1}@example.com`,
        );
      },
      "/__fixture/email-recipients-none": () => {
        state.emailExtra = [];
      },
      // The project automation held twice, as production's one duplicate from
      // before one flow per workspace is (the owner's build 12, #9): in the
      // fixture project, listed first as the newer, and the whole workspace.
      "/__fixture/flow-held-twice": () => {
        state.projectAutomationScopes = [projectId, null];
      },
      "/__fixture/member-owns-project": () => {
        state.memberOwnsProject = true;
      },
      "/__fixture/team-access-missing": () => {
        state.teamAccessMissing = true;
      },
      // Backend 24.11.1: the next unlink refused with a reason — `refused`
      // unless one is named — or met by a platform with no unlink route yet.
      "/__fixture/unlink-refused": () => {
        state.unlinkRefusal = url.searchParams.get("reason") ?? "refused";
      },
      "/__fixture/unlink-route-missing": () => {
        state.unlinkRouteMissing = true;
      },
      // The organization's domain claimed but not verified yet.
      "/__fixture/domain-pending": () => {
        state.domainPending = true;
      },
      // Backend ADR-0031: a plan whose price the provider cannot state.
      "/__fixture/plan-price-unstated": () => {
        state.proPriceUnstated = true;
      },
      // A platform listing no Pro at all (build 10): the website draws one.
      "/__fixture/plan-pro-unlisted": () => {
        state.proUnlisted = true;
      },
      // A catalog with no flow to add (build 10).
      "/__fixture/catalog-empty": () => {
        state.catalogEmpty = true;
      },
      // FR-14: every completed file collected, so a run named one is refused
      // with `artifact_unavailable`, as a file that is gone is.
      "/__fixture/files-collected": () => {
        state.files.clear();
      },
      // Backend §12.1 #39: the complete export's next read fails, or every one.
      "/__fixture/export-read-failing-once": () => {
        state.exportReadsFailing = 1;
      },
      "/__fixture/export-read-failing": () => {
        state.exportReadsFailing = Number.POSITIVE_INFINITY;
      },
      // The change audit of 97021f9's surfaces (register § Round 15). Each
      // refusal holds until the fixture is reset, before every test — another
      // control does not clear it (register F71).
      // Backend §12.1 #91: the address's read refused (403) or failed (503).
      "/__fixture/webhook-read-refused": () => {
        const status = Number(url.searchParams.get("status"));
        if (status !== 403 && status !== 503) return false;
        state.webhookReadRefusal = status;
      },
      // Issuing refused (409) with a reason.
      "/__fixture/webhook-issue-refused": () => {
        const reason = url.searchParams.get("reason");
        if (!reason) return false;
        state.webhookIssueRefusal = reason;
      },
      // A platform with no public origin answers an address without its url.
      "/__fixture/webhook-no-origin": () => {
        state.webhookOrigin = false;
      },
      "/__fixture/webhook-last-outcome": () => {
        const outcome = url.searchParams.get("outcome");
        if (!outcome) return false;
        state.webhookLastOutcome = outcome;
      },
      // Backend §12.1 #240: the next issue makes its secret, and its answer
      // is lost on the way back.
      "/__fixture/webhook-answer-lost": () => {
        state.webhookAnswersLost = 1;
      },
      // Backend BUILD-PLAN 25.2.10: the next run start finds the flow at
      // capacity with its queue full, once.
      "/__fixture/run-at-capacity-once": () => {
        state.runsAtCapacity = 1;
      },
      // FR-14: opening an upload, or completing one, refused with a reason —
      // and a completion answered 429, which the contract documents for it
      // alone (backend BUILD-PLAN 25.2.39, `measurement_busy`).
      "/__fixture/upload-refused": () => {
        const stage = url.searchParams.get("stage");
        const status = Number(url.searchParams.get("status") ?? "400");
        const reason = url.searchParams.get("reason");
        if (
          (stage !== "open" && stage !== "complete") ||
          (status !== 400 &&
            status !== 409 &&
            !(status === 429 && stage === "complete")) ||
          !reason
        ) {
          return false;
        }
        state.uploadRefusal = { stage, status, reason };
      },
      // Backend BUILD-PLAN 25.2.39: the next completion finds no place yet to
      // measure its file, once; the one after measures it.
      "/__fixture/measurement-busy-once": () => {
        state.measurementBusy = 1;
      },
      // Over the plan's flow allowance (decision 7a3): the list says so, and a
      // run's start is refused with the numbers.
      // Round 19: the flow with items, listed; and every item being read,
      // read — as the run that reads its file ends.
      "/__fixture/items-flow": () => {
        state.itemsFlow = true;
        state.items = fixtureItems();
        state.itemChoices = ["Coastal", "Inland"];
        state.itemRuns = new Map([[readyItemId, readyItemRuns()]]);
      },
      // Round 21 (design D2.6): the ready item's reading led by a table
      // with no rows — a block missing a field its schema requires.
      "/__fixture/item-reading-broken": () => {
        state.itemReadingBroken = true;
      },
      // The flow's item list, unanswered (503).
      "/__fixture/items-failing": () => {
        state.itemsFailing = true;
      },
      "/__fixture/items-read": () => {
        for (const item of state.items)
          if (item.status === "reading") item.status = "ready";
      },
      // Round 21 v2: 28 more items, so the flow lists 32 — more than a page
      // of 25 — newest first as the platform lists them: 14 before the four,
      // 14 after. Only once the flow with items is on.
      "/__fixture/items-many": () => {
        if (!state.itemsFlow) return false;
        const more = Array.from({ length: 28 }, (_, at) => {
          const n = String(at + 1).padStart(2, "0");
          return fixtureItem(
            `e0e0e0e0-e0e0-4e0e-8e0e-0000000000${n}`,
            "South",
            `Extra intake ${n}`,
            new Date(
              at < 14
                ? Date.parse("2026-08-20T12:00:00.000Z") - at * 3_600_000
                : Date.parse("2026-08-10T12:00:00.000Z") -
                    (at - 14) * 3_600_000,
            ).toISOString(),
          );
        });
        state.items = [...more.slice(0, 14), ...state.items, ...more.slice(14)];
      },
      // The scored run judged negative: its score red, its word Drop.
      "/__fixture/scored-run-negative": () => {
        const run = state.itemRuns
          .get(readyItemId)
          ?.find((candidate) => candidate.id === scoredRunId);
        if (!run) return false;
        run.verdict = "negative";
      },
      "/__fixture/runs-counted": () => {
        state.runsCounted = true;
      },
      "/__fixture/picture-gone": () => {
        state.pictureGone = true;
      },
      "/__fixture/picture-failing-once": () => {
        state.pictureFailing = 1;
      },
      "/__fixture/entry-file-link-gone": () => {
        state.entryFileLinkGone = true;
      },
      "/__fixture/package-failing": () => {
        state.packageFailing = true;
      },
      "/__fixture/over-plan": () => {
        state.overPlan = true;
      },
      // Turning domain-only on refused (decision 8B), with its reason.
      "/__fixture/domain-only-refused": () => {
        const reason = url.searchParams.get("reason");
        if (
          reason !== "no_verified_domain" &&
          reason !== "members_outside_domain"
        ) {
          return false;
        }
        const count = Number(url.searchParams.get("count") ?? "");
        state.domainOnlyRefusal =
          Number.isSafeInteger(count) && count > 0
            ? { reason, count }
            : { reason };
      },
      // The store refuses the PUT, as it refuses one whose signature fails.
      "/__fixture/store-refusing": () => {
        state.storeRefusing = true;
      },
      // Backend §12.1 #39: the complete export fails — with a reason, or none.
      "/__fixture/export-failed": () => {
        state.exportFailure = url.searchParams.get("reason") ?? "";
      },
      "/__fixture/export-partial": () => {
        state.exportPartial = true;
      },
      // Backend §12.1 #186: the next domain claim refused, once — busy (429),
      // as any route may answer — after its organization was made.
      "/__fixture/domain-claim-refused-once": () => {
        state.domainClaimsRefused = 1;
      },
    };
    const control =
      request.method === "POST" ? controls[url.pathname] : undefined;
    if (control) {
      const usable = control() !== false;
      response.writeHead(usable ? 204 : 400, { "cache-control": "no-store" });
      return response.end();
    }
    // Register F27: how many times the workspace list was read — and the
    // exports asked for, which no page shows once it has gone.
    if (request.method === "GET" && url.pathname === "/__fixture/counts") {
      return respond(response, 200, {
        workspaceListReads: state.workspaceListReads,
        exportJobReads: state.exportJobReads,
        exportCount: state.exportCount,
        exportJobStarted: state.exportJobStarted,
        // What reached the object store, and how much of it carried a cookie.
        storePuts: state.storePuts,
        storePutsWithCookie: state.storePutsWithCookie,
        // Every completion of an upload asked for, each one asked again
        // included (Round 17's B5).
        uploadCompletions: state.uploadCompletions,
        // Each approval's status: a decision leaves the page, and which it was
        // is read here.
        approvalStatuses: state.approvals.map((entry) => entry.status),
        // Round 21 (F2): each review's answers, as the approval keeps them.
        reviewAnswers: state.approvals.flatMap((entry) =>
          entry.decisions
            ? [entry.decisions.map(({ id, decision }) => ({ id, decision }))]
            : [],
        ),
        // Every run package file asked for (Build 24, P12).
        packageFiles: state.packageFiles,
        // Every read of the approvals list (Build 25, R5c 1), and every one
        // refused (Build 25's audit).
        approvalListReads: state.approvalListReads,
        heldJobBlockReads: state.heldJobBlockReads,
        approvalListRefused: state.approvalListRefused,
        runReadsRefused: state.runReadsRefused,
        // Every checkout asked for: a refused one leaves no plan behind.
        checkoutAttempts: state.checkoutAttempts,
        // Every team a test created — where, and the name and kind it was
        // sent with — and, by its absence, every one refused.
        createdTeams: state.createdProjects.map((team) => ({
          workspaceId: team.workspaceId,
          name: team.name,
          type: team.type,
        })),
        // Every organization made at setup, with the key it was made with;
        // how many times one was asked for, a replay included; and every
        // claim on one — refused or made — with its key.
        createdOrganizations: state.createdOrganizations.map(
          ({ workspace, idempotencyKey }) => ({
            id: workspace.id,
            name: workspace.name,
            idempotencyKey,
          }),
        ),
        organizationsAskedFor: state.organizationsAskedFor,
        domainClaims: state.domainClaims,
        // Every webhook secret asked for, with its key (backend §12.1 #240).
        webhookIssues: state.webhookIssues,
        // Backend ADR-0036, ADR-0037: the Invoice Processing flow's settings
        // as saved, every save, and QuickBooks.
        invoiceConfig: state.invoiceConfig,
        invoiceSaves: state.invoiceSaves,
        quickbooksConnected: state.quickbooksConnected,
        // Build 22: every list of extra email addresses saved, in order.
        emailSaves: state.emailSaves,
        // Round 21 v2: every runs list's query, as sent.
        runsQueries: state.runsQueries,
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
      url.pathname === "/__fixture/oauth-connection-broken"
    ) {
      state.oauthStatus = "reauthorization-required";
      response.writeHead(204, { "cache-control": "no-store" });
      return response.end();
    }
    // FR-14: the fixture plays the object store too. The browser PUTs a file
    // here straight from the website's origin — cross-origin, so the preflight
    // is answered for exactly the origin that asked, as the real store answers
    // its configured one. The signed size is the size. It would take the
    // browser's credentials too, so nothing but the website's own
    // `credentials: "omit"` keeps off a PUT a cookie the browser would send
    // this host — and each PUT that carried one is counted.
    const storeObject = /^\/__fixture\/objects\/([^/]+)$/u.exec(url.pathname);
    if (storeObject) {
      const origin = request.headers.origin;
      const cors: Record<string, string> = origin
        ? {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
            vary: "origin",
          }
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
      const body = Buffer.concat(chunks);
      const size = body.byteLength;
      if (request.method === "PUT") {
        state.storePuts += 1;
        if (request.headers.cookie) state.storePutsWithCookie += 1;
      }
      if (
        request.method !== "PUT" ||
        !upload ||
        size !== upload.sizeBytes ||
        state.storeRefusing
      ) {
        response.writeHead(403, cors);
        return response.end();
      }
      upload.received = size;
      state.storedObjects.push({
        filename: upload.filename,
        declaredType: upload.contentType,
        contentType: request.headers["content-type"] ?? null,
        bytes: body.toString("base64"),
      });
      response.writeHead(200, { ...cors, "content-type": "application/json" });
      return response.end("{}");
    }
    // BUILD-PLAN 25.8.5: what the store took, read by a test at the fixture —
    // the type each file was sent as and its bytes, which no page shows.
    if (request.method === "GET" && url.pathname === "/__fixture/stored") {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      return response.end(JSON.stringify(state.storedObjects));
    }
    // FR-14: every completed file and the run it was given to, read by a test
    // at the fixture, because the run's page does not show its input.
    // Round 19: what the website sent to make an item, and to start a run of one.
    if (request.method === "GET" && url.pathname === "/__fixture/items") {
      return respond(response, 200, {
        creates: state.itemCreates,
        runStarts: state.itemRunStarts,
      });
    }
    if (request.method === "GET" && url.pathname === "/__fixture/files") {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      return response.end(JSON.stringify([...state.files.values()]));
    }
    // Build 24 (P12; backend ADR-0045): the file a run package's signed link
    // names — an attachment, as every signed link is; a made-up one-page PDF,
    // or made-up workbook bytes. Over the site's bound, it says so in its
    // length and is cut off.
    if (
      request.method === "GET" &&
      url.pathname === "/__fixture/package-file"
    ) {
      const runId = url.searchParams.get("run") ?? "";
      const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
      const bytes = format === "pdf" ? fixturePdf(runId) : fixtureWorkbook();
      const headers = {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="run-${runId}.${format}"`,
        "cache-control": "no-store",
      };
      if (state.packageFileOversized) {
        response.writeHead(200, {
          ...headers,
          "content-length": String(25 * 1024 * 1024 + 1),
        });
        response.write(bytes);
        setTimeout(() => response.destroy(), 500);
        return;
      }
      response.writeHead(200, {
        ...headers,
        "content-length": String(bytes.byteLength),
      });
      return response.end(bytes);
    }
    // Build 28 (plan §1): an uploaded file a signed link names — an
    // attachment, as every signed link is; the made-up one-page PDF.
    if (request.method === "GET" && url.pathname === "/__fixture/run-file") {
      const id = url.searchParams.get("id") ?? "";
      const name = (url.searchParams.get("name") ?? "file.pdf").replace(
        /[^A-Za-z0-9._-]/gu,
        "-",
      );
      const bytes = id === pictureJpegId ? fixtureJpeg : fixturePdf(id);
      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${name}"`,
        "content-length": String(bytes.byteLength),
        "cache-control": "no-store",
      });
      return response.end(bytes);
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
      } satisfies Platform["LiveHealthResponse"]);
      return;
    }
    // The Edge's readiness, which the website's `/api/ready` reports.
    if (url.pathname === "/health/ready") {
      return state.notReady
        ? respond(response, 503, {
            status: "not-ready",
            service: "fixture-edge",
            checks: [
              {
                name: "fixture",
                ok: false,
                detail: "Held not ready by a test",
              },
            ],
          } satisfies Platform["ReadinessResponse"])
        : respond(response, 200, {
            status: "ready",
            service: "fixture-edge",
            checks: [{ name: "fixture", ok: true, detail: "Ready" }],
          } satisfies Platform["ReadinessResponse"]);
    }
    // Public, as the Edge serves it: no session is needed to list the ways in,
    // and the website reads it on the server with no cookie (§12.1 #160).
    if (request.method === "GET" && url.pathname === "/v1/auth/providers") {
      const providers = {
        // Microsoft too, so a second linked account has a row (backend 24.11.1).
        providers: [
          { id: "google", label: "Google" },
          { id: "microsoft", label: "Microsoft" },
        ],
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
        user: {
          ...session.user,
          activeWorkspaceId: state.activeWorkspaceId,
          aiDocumentReading: null,
        },
        workspaces: [workspace, personalWorkspace],
      } satisfies Platform["SessionResponse"];
      const memberSession = {
        authenticated: true,
        user: {
          userId: memberUserId,
          email: "member@example.test",
          displayName: "Fixture Member",
          activeWorkspaceId: workspaceId,
          aiDocumentReading: null,
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
          aiDocumentReading: null,
        },
        workspaces: [adminWorkspace],
      } satisfies Platform["SessionResponse"];
      // The requester has no workspace until it makes an organization at
      // setup (backend §12.1 #186), which is theirs, and active, from then on.
      const requesterNow = {
        ...requesterSession,
        user: {
          ...requesterSession.user,
          aiDocumentReading: null,
          ...(state.requesterActiveWorkspaceId
            ? { activeWorkspaceId: state.requesterActiveWorkspaceId }
            : {}),
        },
        workspaces: state.createdOrganizations.map(
          ({ workspace }) => workspace,
        ),
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
              : requesterNow,
      );
    }
    if (method === "PATCH" && pathname === "/v1/session/active-workspace") {
      const body = (await requestJson(request)) as { workspaceId?: string };
      if (
        body.workspaceId !== workspaceId &&
        body.workspaceId !== personalWorkspaceId
      ) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      state.activeWorkspaceId = body.workspaceId;
      return respond(response, 200, {
        activeWorkspaceId: state.activeWorkspaceId,
      } satisfies Platform["ActiveWorkspaceResponse"]);
    }
    // Backend 24.11.1: what is linked, and Unlink — never the account signed
    // up with, refused with the platform's sentence and its reason.
    // Backend 24.12.2: each account with the address its provider reports
    // (an account whose provider reports none carries no `email`).
    const identityEmail: Partial<
      Record<Platform["LoginIdentitySummary"]["provider"], string>
    > = {
      google: "owner@example.test",
      microsoft: "fixture.owner@outlook.test",
    };
    const identities = () =>
      ({
        identities: state.identities.map((provider, index) => ({
          provider,
          primary: index === 0,
          ...(identityEmail[provider]
            ? { email: identityEmail[provider] }
            : {}),
        })),
      }) satisfies Platform["LoginIdentitiesResponse"];
    if (method === "GET" && pathname === "/v1/auth/identities")
      return respond(response, 200, identities());
    const unlink = /^\/v1\/auth\/identities\/(google|microsoft|apple)$/u.exec(
      pathname,
    );
    if (method === "DELETE" && unlink) {
      // A platform from before the SEVENTEENTH promotion: the Edge's own
      // answer to a route it does not have, naming the method and the path.
      if (state.unlinkRouteMissing)
        return respond(response, 404, {
          ...problem(404, "Not Found", { method, path: pathname }),
          detail: "Route is not implemented",
          code: "NOT_FOUND",
        } satisfies Platform["ApiProblem"]);
      const provider =
        unlink[1] as Platform["LoginIdentitySummary"]["provider"];
      const at = state.identities.indexOf(provider);
      if (at === -1)
        return respond(response, 404, {
          ...problem(404, "Not Found"),
          detail: "That sign-in account is not linked",
        } satisfies Platform["ApiProblem"]);
      const sentences: Record<string, string> = {
        primary: "The account you signed up with stays linked",
        last: "The last sign-in account stays linked",
        refused: "This sign-in account cannot be unlinked",
      };
      const reason = at === 0 ? "primary" : state.unlinkRefusal;
      if (reason)
        return respond(response, 400, {
          ...problem(400, "Bad Request", { reason }),
          detail: sentences[reason] ?? "Bad Request",
        } satisfies Platform["ApiProblem"]);
      state.identities = state.identities.filter((entry) => entry !== provider);
      return respond(response, 200, identities());
    }
    // The organization's settings (decision 8B): turning domain-only on is
    // refused while a refusal is set; off always succeeds.
    if (method === "PATCH" && pathname === `/v1/workspaces/${workspaceId}`) {
      const body = (await requestJson(request)) as { domainOnly?: unknown };
      if (
        typeof body.domainOnly !== "boolean" ||
        !request.headers["idempotency-key"]
      ) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      if (body.domainOnly && state.domainOnlyRefusal) {
        const { reason, count } = state.domainOnlyRefusal;
        return respond(response, 409, {
          ...problem(409, "Conflict"),
          details: { reason, ...(count === undefined ? {} : { count }) },
        });
      }
      state.domainOnly = body.domainOnly;
      return respond(response, 200, {
        workspace: state.domainOnly
          ? { ...workspace, domainOnly: true as const }
          : workspace,
      } satisfies Platform["WorkspaceUpdateResponse"]);
    }
    if (method === "GET" && pathname === "/v1/workspaces") {
      state.workspaceListReads += 1;
      const workspaces =
        fixtureSession === "owner"
          ? [
              state.domainOnly
                ? { ...workspace, domainOnly: true as const }
                : workspace,
              personalWorkspace,
            ]
          : fixtureSession === "member"
            ? [memberWorkspace]
            : fixtureSession === "admin"
              ? [adminWorkspace]
              : state.createdOrganizations.map(({ workspace }) => workspace);
      const activeWorkspaceId =
        fixtureSession === "requester"
          ? state.requesterActiveWorkspaceId
          : state.activeWorkspaceId;
      return respond(response, 200, {
        workspaces,
        ...(activeWorkspaceId ? { activeWorkspaceId } : {}),
      } satisfies Platform["WorkspaceListResponse"]);
    }
    // Backend §12.1 #186: an organization the requester makes at setup — theirs
    // as owner, active when asked, and listed to them from then on. A key used
    // again with the same input is answered with the organization it made, as
    // the platform replays it; with other input it is refused (409). Only an
    // organization: the platform makes a personal workspace itself (400).
    if (
      method === "POST" &&
      pathname === "/v1/workspaces" &&
      fixtureSession === "requester"
    ) {
      const key = request.headers["idempotency-key"];
      const body = (await requestJson(request)) as Partial<
        Platform["CreateWorkspaceRequest"]
      >;
      if (
        typeof key !== "string" ||
        body.type !== "organization" ||
        typeof body.name !== "string" ||
        body.name.length < 2 ||
        body.name.length > 120 ||
        typeof body.activate !== "boolean"
      ) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      state.organizationsAskedFor += 1;
      const input = JSON.stringify([body.name, body.activate]);
      let made = state.createdOrganizations.find(
        (entry) => entry.idempotencyKey === key,
      );
      if (made && made.input !== input) {
        return respond(response, 409, {
          ...problem(409, "Conflict"),
          detail: "The idempotency key was already used with different input",
        } satisfies Platform["ApiProblem"]);
      }
      if (!made) {
        made = {
          workspace: {
            id: `${String(state.createdOrganizations.length).padStart(8, "9")}-9999-4999-8999-999999999999`,
            name: body.name,
            type: "organization",
            role: "owner",
          },
          idempotencyKey: key,
          input,
        };
        state.createdOrganizations.push(made);
        if (body.activate) state.requesterActiveWorkspaceId = made.workspace.id;
      }
      return respond(response, 200, {
        workspace: made.workspace,
        ...(body.activate ? { activeWorkspaceId: made.workspace.id } : {}),
      } satisfies Platform["WorkspaceMutationResponse"]);
    }
    // Backend §12.1 #186: setup's second step — the requester's email domain
    // claimed on the organization it made, pending until its DNS record is
    // checked, the challenge only in the answer that made the claim. A key used
    // again with the same input is answered with that claim, without the
    // challenge; with other input it is refused (409). Every claim asked is
    // kept here with its answer, a refused one too, so a test reads the retry.
    const claiming = /^\/v1\/workspaces\/([^/]+)\/domains$/u.exec(pathname);
    const claimedOn =
      claiming && fixtureSession === "requester"
        ? state.createdOrganizations.find(
            ({ workspace }) => workspace.id === claiming[1],
          )
        : undefined;
    if (method === "POST" && claimedOn) {
      const key = request.headers["idempotency-key"];
      const body = (await requestJson(request)) as Partial<
        Platform["ClaimOrganizationDomainRequest"]
      >;
      if (
        typeof key !== "string" ||
        typeof body.domain !== "string" ||
        body.domain.length < 3 ||
        body.domain.length > 253
      ) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      const claim = {
        workspaceId: claimedOn.workspace.id,
        domain: body.domain.toLowerCase(),
        joinPolicy: body.joinPolicy ?? "approval",
        idempotencyKey: key,
      };
      if (state.domainClaimsRefused > 0) {
        state.domainClaimsRefused -= 1;
        state.domainClaims.push({ ...claim, status: 429 });
        response.setHeader("retry-after", "30");
        return respond(response, 429, problem(429, "Too Many Requests"));
      }
      const made = state.domainClaims.find(
        (entry) => entry.status === 200 && entry.idempotencyKey === key,
      );
      if (
        made &&
        (made.workspaceId !== claim.workspaceId ||
          made.domain !== claim.domain ||
          made.joinPolicy !== claim.joinPolicy)
      ) {
        return respond(response, 409, {
          ...problem(409, "Conflict"),
          detail: "The idempotency key was already used with different input",
        } satisfies Platform["ApiProblem"]);
      }
      state.domainClaims.push({ ...claim, status: 200 });
      return respond(response, 200, {
        domain: {
          id: "56565656-5656-4565-8565-565656565656",
          workspaceId: claim.workspaceId,
          domain: claim.domain,
          registrableDomain: claim.domain,
          status: "pending",
          joinPolicy: claim.joinPolicy,
          discoveryEnabled: true,
          verificationRecordName: `_autom8x-challenge.${claim.domain}`,
          createdAt: now,
        },
        ...(made
          ? {}
          : { verificationRecordValue: "autom8x-domain-verification=fixture" }),
      } satisfies Platform["OrganizationDomainClaimResponse"]);
    }
    // The teams a test created in one workspace. An organization's are listed
    // to its owner and its admin — the creator and someone who sees every team
    // (backend 24.11.3) — and never to a plain member who is on none of them.
    const createdIn = (where: string) =>
      state.createdProjects.filter((team) => team.workspaceId === where);
    if (method === "GET" && isWorkspacePath(pathname, "/projects")) {
      // The role each person holds on the fixture project: its owner, an
      // organization admin (effective admin), or a plain member on it.
      const viewerRole = projectRoleOf(fixtureSession);
      return respond(response, 200, {
        projects: [
          ...(viewerRole && state.fixtureProjectListed
            ? [{ ...project, viewerRole }]
            : []),
          ...(fixtureSession === "owner" || fixtureSession === "admin"
            ? createdIn(workspaceId)
            : []),
        ],
      } satisfies Platform["ProjectListResponse"]);
    }
    // Creating a team, in the organization or in the owner's personal
    // workspace: its creator owns it, as Access records the owner membership in
    // the same transaction. Backend 24.12: in an organization only its owners
    // and admins create one (403), and a workspace holds one team per kind —
    // matched without case, an archived team not counted (409
    // `team_kind_taken`).
    const creating = /^\/v1\/workspaces\/([^/]+)\/projects$/u.exec(pathname);
    if (
      method === "POST" &&
      creating &&
      (creating[1] === workspaceId || creating[1] === personalWorkspaceId)
    ) {
      const where = creating[1]!;
      const allowed =
        where === personalWorkspaceId
          ? fixtureSession === "owner"
          : fixtureSession === "owner" || fixtureSession === "admin";
      if (!allowed) return respond(response, 403, problem(403, "Forbidden"));
      if (!request.headers["idempotency-key"])
        return respond(response, 400, problem(400, "Bad Request"));
      const body = (await requestJson(request)) as {
        name?: string;
        type?: string;
      };
      const name = body.name?.trim() ?? "";
      if (name.length < 2 || name.length > 60 || !body.type) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      const kind = body.type.toLowerCase();
      const held = [
        ...(where === workspaceId && state.fixtureProjectListed
          ? [project]
          : []),
        ...createdIn(where),
      ].some(
        (team) =>
          team.status !== "archived" && team.type.toLowerCase() === kind,
      );
      if (held)
        return respond(response, 409, {
          ...problem(409, "Conflict", { reason: "team_kind_taken" }),
          detail: "This workspace already has a team of this kind",
        } satisfies Platform["ApiProblem"]);
      const created = {
        // Eight hex digits in the first group, however many are created.
        id: `${String(state.createdProjects.length).padStart(8, "5")}-5555-4555-8555-555555555555`,
        workspaceId: where,
        name,
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
    // Who is on a team, and the changes its owner or admin makes — or the
    // organization's (backend 24.11.3). A team created here has its creator.
    const memberships = new RegExp(
      `^/v1/workspaces/${workspaceId}/projects/([^/]+)/memberships(?:/([^/]+))?$`,
      "u",
    ).exec(pathname);
    if (memberships) {
      const [, teamId, memberId] = memberships;
      const created = state.createdProjects.find(
        (entry) => entry.id === teamId,
      );
      if (teamId !== projectId && !created)
        return respond(response, 404, problem(404, "Not Found"));
      if (method === "GET" && !memberId) {
        return respond(response, 200, {
          memberships: created
            ? [{ ...state.projectMembers[0]!, projectId: created.id }]
            : state.projectMembers,
        } satisfies Platform["ProjectMembershipListResponse"]);
      }
      const deciding =
        fixtureSession === "owner" ||
        fixtureSession === "admin" ||
        projectRoleOf(fixtureSession) === "owner";
      if (!request.headers["idempotency-key"])
        return respond(response, 400, problem(400, "Bad Request"));
      if (method === "POST" && !memberId && teamId === projectId) {
        const body = (await requestJson(request)) as {
          userId?: string;
          role?: Platform["ProjectMembership"]["role"];
        };
        const person = organizationMembers.find(
          (entry) => entry.userId === body.userId,
        );
        if (!deciding) return respond(response, 403, problem(403, "Forbidden"));
        if (!person || !body.role)
          return respond(response, 400, problem(400, "Bad Request"));
        const membership = {
          projectId,
          workspaceId,
          userId: person.userId,
          role: body.role,
          displayName: person.displayName,
          email: person.email,
          createdAt: now,
        } satisfies Platform["ProjectMembership"];
        state.projectMembers = [
          ...state.projectMembers.filter(
            (entry) => entry.userId !== person.userId,
          ),
          membership,
        ];
        return respond(response, 200, {
          membership,
        } satisfies Platform["ProjectMembershipMutationResponse"]);
      }
      if (method === "DELETE" && memberId && teamId === projectId) {
        const self =
          (fixtureSession === "member" && memberId === memberUserId) ||
          (fixtureSession === "owner" && memberId === userId);
        if (!deciding && !self)
          return respond(response, 403, problem(403, "Forbidden"));
        state.projectMembers = state.projectMembers.filter(
          (entry) => entry.userId !== memberId,
        );
        return respond(response, 200, {
          removed: true,
        } satisfies Platform["RemovalResponse"]);
      }
      return respond(response, 404, problem(404, "Not Found"));
    }
    // The owner's personal workspace holds nothing but its own billing (below)
    // and the teams a test creates in it: every other list the account pages
    // read for it is empty, as the Edge answers a workspace with nothing in it,
    // and the catalog is the same catalog with nothing subscribed. A test that
    // switches to it reads real pages, not 501s — and so does the requester
    // landing in an organization it has just made (backend §12.1 #186).
    const emptyWorkspaceId = [
      personalWorkspaceId,
      ...state.createdOrganizations.map(({ workspace }) => workspace.id),
    ].find((id) => pathname.startsWith(`/v1/workspaces/${id}/`));
    if (method === "GET" && emptyWorkspaceId) {
      const read = pathname.slice(`/v1/workspaces/${emptyWorkspaceId}`.length);
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
        "/projects": {
          projects: createdIn(emptyWorkspaceId),
        } satisfies Platform["ProjectListResponse"],
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
      // Another workspace's subscription has no address here: Runs reads an
      // address by workspace and subscription together, and answers 404.
      if (/^\/subscriptions\/[^/]+\/webhook$/u.test(read)) {
        return respond(response, 404, problem(404, "Not Found"));
      }
    }
    if (method === "GET" && isWorkspacePath(pathname, "/members")) {
      return respond(response, 200, {
        members: organizationMembers,
      } satisfies Platform["WorkspaceMemberListResponse"]);
    }
    const administering =
      fixtureSession === "owner" || fixtureSession === "admin";
    // Backend 24.11.4: the organization's directory — every open team, and
    // where this person stands with each. Operations is listed to the plain
    // member only (see operationsTeamId), and only while the organization has
    // teams at all: under org-without-projects it has none, as the platform's
    // directory would. A team a test created is listed like any open team —
    // its creator and an owner or admin are on it, a plain member is not
    // (the owner's build 10: a member on no team, in an organization that has
    // one, is told to ask to join it).
    if (method === "GET" && isWorkspacePath(pathname, "/project-directory")) {
      if (state.teamAccessMissing)
        return respond(response, 404, problem(404, "Not Found"));
      return respond(response, 200, {
        projects: [
          ...(state.fixtureProjectListed
            ? [
                {
                  id: projectId,
                  workspaceId,
                  name: project.name,
                  type: project.type,
                  status: project.status,
                  access: projectRoleOf(fixtureSession) ? "member" : "none",
                  createdAt: now,
                } satisfies Platform["ProjectDirectoryEntry"],
              ]
            : []),
          ...createdIn(workspaceId)
            .filter((team) => team.status !== "archived")
            .map(
              (team) =>
                ({
                  id: team.id,
                  workspaceId: team.workspaceId,
                  name: team.name,
                  type: team.type,
                  status: team.status,
                  access:
                    fixtureSession === "owner" || fixtureSession === "admin"
                      ? "member"
                      : "none",
                  createdAt: team.createdAt,
                }) satisfies Platform["ProjectDirectoryEntry"],
            ),
          ...(fixtureSession === "member" && state.fixtureProjectListed
            ? [
                {
                  id: operationsTeamId,
                  workspaceId,
                  name: "Operations",
                  type: "Operations",
                  status: "active",
                  access:
                    state.memberRequest === "pending" ? "requested" : "none",
                  createdAt: now,
                } satisfies Platform["ProjectDirectoryEntry"],
              ]
            : []),
        ],
      } satisfies Platform["ProjectDirectoryResponse"]);
    }
    // Backend 24.11.2: asking to join a team. The fixture project's owner and
    // the organization's owner and admin read and answer its requests — anyone
    // else reads only their own, and is refused an answer. The member asks
    // onto Operations, and withdraws their own request.
    const accessRequests = new RegExp(
      `^/v1/workspaces/${workspaceId}/projects/([^/]+)/access-requests(?:/([^/]+))?$`,
      "u",
    ).exec(pathname);
    if (accessRequests) {
      if (state.teamAccessMissing)
        return respond(response, 404, problem(404, "Not Found"));
      const [, teamId, requestId] = accessRequests;
      if (method !== "GET" && !request.headers["idempotency-key"])
        return respond(response, 400, problem(400, "Bad Request"));
      const newcomer = {
        id: newcomerRequestId,
        projectId,
        workspaceId,
        userId: newcomerUserId,
        status: state.newcomerRequest,
        displayName: "Fixture Newcomer",
        email: "newcomer@example.test",
        createdAt: now,
      } satisfies Platform["ProjectAccessRequest"];
      const own = () =>
        ({
          id: memberRequestId,
          projectId: operationsTeamId,
          workspaceId,
          userId: memberUserId,
          status: state.memberRequest ?? "pending",
          displayName: "Fixture Member",
          email: "member@example.test",
          createdAt: now,
        }) satisfies Platform["ProjectAccessRequest"];
      if (teamId === projectId) {
        const deciding =
          administering || projectRoleOf(fixtureSession) === "owner";
        if (method === "GET" && !requestId)
          return respond(response, 200, {
            requests: deciding ? [newcomer] : [],
          } satisfies Platform["ProjectAccessRequestListResponse"]);
        if (method === "PATCH" && requestId === newcomerRequestId) {
          if (!deciding)
            return respond(response, 403, problem(403, "Forbidden"));
          if (state.newcomerRequest !== "pending")
            return respond(response, 409, problem(409, "Conflict"));
          const body = (await requestJson(request)) as { decision?: string };
          if (body.decision !== "approve" && body.decision !== "deny")
            return respond(response, 400, problem(400, "Bad Request"));
          state.newcomerRequest =
            body.decision === "approve" ? "approved" : "denied";
          // Approve puts them on the team as a member, in the same step.
          if (body.decision === "approve")
            state.projectMembers = [
              ...state.projectMembers,
              {
                projectId,
                workspaceId,
                userId: newcomerUserId,
                role: "member",
                displayName: "Fixture Newcomer",
                email: "newcomer@example.test",
                createdAt: now,
              },
            ];
          return respond(response, 200, {
            request: { ...newcomer, status: state.newcomerRequest },
          } satisfies Platform["ProjectAccessRequestMutationResponse"]);
        }
      }
      if (teamId === operationsTeamId && fixtureSession === "member") {
        if (method === "GET" && !requestId)
          return respond(response, 200, {
            requests: state.memberRequest ? [own()] : [],
          } satisfies Platform["ProjectAccessRequestListResponse"]);
        if (method === "POST" && !requestId) {
          if (state.memberRequest === "pending")
            return respond(response, 409, problem(409, "Conflict"));
          state.memberRequest = "pending";
          return respond(response, 200, {
            request: own(),
          } satisfies Platform["ProjectAccessRequestMutationResponse"]);
        }
        if (method === "DELETE" && requestId === memberRequestId) {
          if (state.memberRequest !== "pending")
            return respond(response, 409, problem(409, "Conflict"));
          state.memberRequest = "cancelled";
          return respond(response, 200, {
            request: own(),
          } satisfies Platform["ProjectAccessRequestMutationResponse"]);
        }
      }
      return respond(response, 404, problem(404, "Not Found"));
    }
    if (method === "GET" && isWorkspacePath(pathname, "/domains")) {
      return respond(response, 200, {
        domains: [
          state.domainPending
            ? { ...domain, status: "pending", verifiedAt: undefined }
            : domain,
        ],
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
        providers: [
          keyProvider,
          oauthProvider,
          quickbooksProvider,
          googleProvider,
        ],
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
          ...(state.quickbooksConnected ? [quickbooksConnection()] : []),
          ...(state.googleConnected ? [googleConnection()] : []),
        ],
      } satisfies ConnectionOperations["listConnections"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "DELETE" &&
      isWorkspacePath(pathname, `/connections/${googleConnectionId}`)
    ) {
      if (!state.googleConnected) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      state.googleConnected = false;
      return respond(response, 200, {
        connection: { ...googleConnection(), status: "disconnected" },
      } satisfies ConnectionOperations["disconnectConnection"]["responses"][200]["content"]["application/json"]);
    }
    if (
      method === "DELETE" &&
      isWorkspacePath(pathname, `/connections/${quickbooksConnectionId}`)
    ) {
      if (!state.quickbooksConnected) {
        return respond(response, 404, problem(404, "Not Found"));
      }
      state.quickbooksConnected = false;
      return respond(response, 200, {
        connection: { ...quickbooksConnection(), status: "disconnected" },
      } satisfies ConnectionOperations["disconnectConnection"]["responses"][200]["content"]["application/json"]);
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
      // QuickBooks: reused once connected; otherwise its consent, which the
      // fixture grants at once — the browser is sent straight to the
      // platform's callback landing, as Intuit sends it back, connected.
      if (body.providerId === quickbooksProvider.providerId) {
        if (state.quickbooksConnected) {
          return respond(response, 200, {
            outcome: "reused",
            connection: quickbooksConnection(),
          } satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"]);
        }
        state.quickbooksConnected = true;
        return respond(response, 200, {
          outcome: "authorization-required",
          authorizationUrl:
            "http://127.0.0.1:3001/connections?status=connected",
          expiresAt: hostedExpiry,
        } satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"]);
      }
      // Google: reused while connected; otherwise granted at once, as
      // QuickBooks is.
      if (body.providerId === googleProvider.providerId) {
        if (state.googleConnected) {
          return respond(response, 200, {
            outcome: "reused",
            connection: googleConnection(),
          } satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"]);
        }
        state.googleConnected = true;
        return respond(response, 200, {
          outcome: "authorization-required",
          authorizationUrl:
            "http://127.0.0.1:3001/connections?status=connected",
          expiresAt: hostedExpiry,
        } satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"]);
      }
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
            externalAccount: { displayName: "Fixture other account" },
          },
        } satisfies ConnectionOperations["beginConnectionAuthorization"]["responses"][200]["content"]["application/json"]);
      }
      // Reused only when the grant is connected and nothing is being replaced
      // (backend ADR-0019 §2, §12.1 #175); otherwise consent is asked for. A
      // disconnected grant is not connected, whatever status it had.
      const answer =
        body.replaceConnectionId === undefined &&
        state.oauthStatus === "connected" &&
        !state.oauthDisconnected
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
      if (state.catalogFailing)
        return respond(response, 503, problem(503, "Service Unavailable"));
      return respond(response, 200, fixtureCatalog());
    }
    if (
      method === "GET" &&
      isWorkspacePath(pathname, "/subscriptions") &&
      url.searchParams.get("status") !== "archived" &&
      state.subscriptionsFailing
    ) {
      return respond(response, 503, problem(503, "Service Unavailable"));
    }
    if (method === "GET" && isWorkspacePath(pathname, "/subscriptions")) {
      // Backend §12.1 #203: the archived ones, asked for by name.
      if (url.searchParams.get("status") === "archived")
        return respond(response, 200, {
          subscriptions: state.archivableArchived
            ? [
                {
                  ...archivableSubscription,
                  status: "archived",
                  updatedAt: "2026-09-30T12:00:00.000Z",
                },
              ]
            : [],
        } satisfies AutomationOperations["listSubscriptions"]["responses"][200]["content"]["application/json"]);
      return respond(response, 200, {
        subscriptions: [
          // The newest first, as the platform lists them.
          ...(state.archivableAgain ? [state.archivableAgain] : []),
          ...state.projectAutomationScopes.map(projectAutomationSubscription),
          ...(state.invoiceAdded ? [invoiceSubscription()] : []),
          ...(state.itemsFlow ? [itemsSubscription()] : []),
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
        ...(state.overPlan ? { flowAllowance: { allowed: 2, live: 4 } } : {}),
      } satisfies AutomationOperations["listSubscriptions"]["responses"][200]["content"]["application/json"]);
    }
    // Build 22 (P4; backend ADR-0041): no client chooses a version — a flow's
    // update naming one is refused, as the Edge refuses it, naming the field
    // (the session's S37).
    if (
      method === "PATCH" &&
      /^\/v1\/workspaces\/[^/]+\/subscriptions\/[^/]+$/u.test(pathname) &&
      "templateVersion" in (await requestJson(request))
    ) {
      return respond(
        response,
        400,
        problem(400, "templateVersion is not an accepted field", {
          field: "templateVersion",
        }),
      );
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
    // Invoice Processing's flow (backend ADR-0037, ADR-0040): Pause and Turn
    // on, and its settings — the vendor its Done step chose, `none` or
    // QuickBooks, and its approval limit — replaced whole, as the catalog
    // replaces them; Set up's Turn on sends both in one change. A flow turned
    // or kept on cannot choose a vendor that is not connected (422
    // `unmet_connections`).
    if (
      method === "PATCH" &&
      isWorkspacePath(pathname, `/subscriptions/${invoiceSubscriptionId}`)
    ) {
      const body = (await requestJson(request)) as {
        config?: Json;
        status?: string;
      };
      if (!request.headers["idempotency-key"]) {
        return respond(response, 422, problem(422, "Unprocessable Entity"));
      }
      if (
        body.status !== undefined &&
        body.status !== "live" &&
        body.status !== "paused"
      )
        return respond(response, 422, problem(422, "Unprocessable Entity"));
      const config = body.config;
      if (config !== undefined) {
        const declared = new Set(invoiceSetup().map((field) => field.key));
        // A several-choice value: a list of its options, none twice, never
        // empty when required (Round 21, F1; the backend's checks).
        const choices = config?.specialties;
        const badChoices =
          state.invoiceSpecialties &&
          (!Array.isArray(choices) ||
            choices.length === 0 ||
            new Set(choices).size !== choices.length ||
            choices.some(
              (choice) =>
                typeof choice !== "string" ||
                !(specialtiesField.options ?? []).includes(choice),
            ));
        // A one-choice value: one of its options, as a string.
        const badChoice =
          state.invoiceSpecialties &&
          (typeof config?.placeOfCare !== "string" ||
            !(placeOfCareField.options ?? []).includes(config.placeOfCare));
        if (
          !config ||
          badChoices ||
          badChoice ||
          Object.keys(config).some((key) => !declared.has(key)) ||
          (config.vendor !== undefined &&
            config.vendor !== "none" &&
            config.vendor !== quickbooksProvider.providerId) ||
          (config.holdAboveAmount !== undefined &&
            typeof config.holdAboveAmount !== "number")
        ) {
          return respond(response, 422, {
            ...problem(422, "Unprocessable Entity"),
            details: { reason: "invalid_config" },
          } satisfies Platform["ApiProblem"]);
        }
      }
      if (
        state.vendorChangeRefused &&
        config?.vendor !== undefined &&
        config.vendor !== state.invoiceConfig.vendor
      ) {
        return respond(response, 403, {
          ...problem(403, "Forbidden"),
          detail: "Access is forbidden",
          details: {
            reason: "integration_requires_admin",
            requiredRole: "admin",
          },
        } satisfies Platform["ApiProblem"]);
      }
      const vendor = (config ?? state.invoiceConfig).vendor;
      const status = body.status ?? state.invoiceStatus;
      if (
        status === "live" &&
        vendor === quickbooksProvider.providerId &&
        !state.quickbooksConnected
      ) {
        return respond(response, 422, {
          ...problem(422, "Unprocessable Entity"),
          details: { reason: "unmet_connections" },
        } satisfies Platform["ApiProblem"]);
      }
      if (config !== undefined) {
        state.invoiceConfig = config;
        state.invoiceSaves.push(config);
      }
      if (body.status !== undefined) state.invoiceStatus = body.status;
      return respond(response, 200, {
        subscription: invoiceSubscription(),
      } satisfies AutomationOperations["updateSubscription"]["responses"][200]["content"]["application/json"]);
    }
    // Build 22 (spec §4, P5; backend ADR-0041): who gets a flow's run email —
    // the workspace's owners and admins, as its members list reads them,
    // owners first, and the flow's extra addresses; any member may read it,
    // an owner or admin replaces the extra ones, the whole list, each checked
    // and each address once without case, at most 10 (the platform's rules,
    // its words for a refusal and `details.field`, the session's S36).
    const recipientsOf =
      /^\/v1\/workspaces\/([^/]+)\/subscriptions\/([^/]+)\/email-recipients$/u.exec(
        pathname,
      );
    if (
      recipientsOf &&
      recipientsOf[1] === workspaceId &&
      (method === "GET" || method === "PUT")
    ) {
      const flowId = recipientsOf[2];
      const known = [
        invoiceSubscriptionId,
        manualSubscriptionId,
        webhookSubscriptionId,
        archivableSubscriptionId,
        projectDraftSubscription.id,
      ];
      if (!known.includes(flowId))
        return respond(response, 404, problem(404, "Not Found"));
      const answer = (): Automations["FlowEmailRecipients"] => ({
        subscriptionId: flowId,
        people: (["owner", "admin"] as const).flatMap((role) =>
          organizationMembers
            .filter((member) => member.role === role)
            .map((member) => ({
              email: member.email,
              displayName: member.displayName,
              role,
            })),
        ),
        extra: flowId === invoiceSubscriptionId ? state.emailExtra : [],
        canEdit: administering,
      });
      if (method === "GET") {
        if (state.emailRecipientsFailing)
          return respond(response, 503, problem(503, "Service Unavailable"));
        return respond(response, 200, answer());
      }
      if (!administering)
        return respond(
          response,
          403,
          problem(403, "Forbidden", { requiredRole: "admin" }),
        );
      if (state.emailRecipientsRefusing)
        return respond(response, 503, problem(503, "Service Unavailable"));
      const body = (await requestJson(request)) as { extra?: unknown };
      const extra = body.extra;
      if (!Array.isArray(extra) || Object.keys(body).join() !== "extra")
        return respond(
          response,
          400,
          problem(400, "extra must be an array of email addresses", {
            field: "extra",
          }),
        );
      if (extra.length > 10)
        return respond(
          response,
          400,
          problem(400, "extra must hold at most 10 addresses", {
            field: "extra",
          }),
        );
      const address =
        /^[^\s@<>,;"()[\]\\]{1,64}@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/u;
      const kept: string[] = [];
      for (const [index, entry] of extra.entries()) {
        const trimmed = typeof entry === "string" ? entry.trim() : "";
        if (
          trimmed.length < 3 ||
          trimmed.length > 254 ||
          !address.test(trimmed)
        )
          return respond(
            response,
            400,
            problem(400, `extra[${index}] must be an email address`, {
              field: `extra[${index}]`,
            }),
          );
        if (
          !kept.some((listed) => listed.toLowerCase() === trimmed.toLowerCase())
        )
          kept.push(trimmed);
      }
      state.emailExtra = kept;
      state.emailSaves.push(kept);
      return respond(response, 200, answer());
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
        } satisfies Platform["ApiProblem"]);
      // The contract's `url` is absent only where the platform has no public
      // origin to put in it.
      const address = state.webhookOrigin
        ? { url: `https://hooks.example.test/v1/webhooks/${webhookEndpointId}` }
        : {};
      if (method === "GET") {
        if (state.webhookReadRefusal) {
          return respond(
            response,
            state.webhookReadRefusal,
            refusal(state.webhookReadRefusal),
          );
        }
        if (state.webhookSecrets === 0) {
          return respond(response, 404, problem(404, "Not Found"));
        }
        return respond(response, 200, {
          endpointId: webhookEndpointId,
          ...address,
          createdAt: now,
          lastDeliveryAt: now,
          lastOutcome: state.webhookLastOutcome,
        } satisfies Automations["WebhookEndpoint"]);
      }
      if (method === "POST") {
        // §12.1 #240: an optional Idempotency-Key, refused when it is not the
        // contract's shape, as the Edge refuses it before Runs is asked.
        const presented = request.headers["idempotency-key"];
        const key = typeof presented === "string" ? presented : null;
        if (
          presented !== undefined &&
          (key === null || !/^[A-Za-z0-9._~:-]{16,128}$/u.test(key))
        ) {
          return respond(response, 400, problem(400, "Bad Request"));
        }
        if (state.webhookIssueRefusal) {
          return respond(
            response,
            409,
            refusal(409, state.webhookIssueRefusal),
          );
        }
        // The platform derives the secret from the key, so the key the current
        // secret was made with is answered with that secret again, rotated as
        // its first answer said, and nothing rotates. Any other key, or none,
        // makes a new secret.
        const replayed = key !== null && key === state.webhookSecretKey;
        if (!replayed) {
          state.webhookSecrets += 1;
          state.webhookSecretKey = key;
          state.webhookSecretRotated = state.webhookSecrets > 1;
        }
        state.webhookIssues.push({ idempotencyKey: key, replayed });
        if (state.webhookAnswersLost > 0) {
          // Made, and its answer lost on the way back: the connection drops
          // before a status line is written, as the departing session's does.
          state.webhookAnswersLost -= 1;
          response.socket?.destroy();
          return;
        }
        return respond(response, 200, {
          endpointId: webhookEndpointId,
          ...address,
          createdAt: now,
          secret: `fixture-secret-${state.webhookSecrets}`,
          rotated: state.webhookSecretRotated,
        } satisfies Automations["IssuedWebhookEndpoint"]);
      }
    }
    // Round 19 (backend ADR-0046): the flow with items — its uploads, its
    // items, and a run that names one.
    if (state.itemsFlow) {
      const scope = `/v1/workspaces/${workspaceId}`;
      const itemsPath = `${scope}/subscriptions/${itemsSubscriptionId}/items`;
      if (method === "POST" && isWorkspacePath(pathname, "/uploads")) {
        const body = (await requestJson(request)) as {
          subscriptionId?: string;
          filename?: string;
          contentType?: string;
          sizeBytes?: number;
        };
        if (body.subscriptionId === itemsSubscriptionId) {
          const contentType = body.contentType ?? "";
          if (!itemsDeclared.file.acceptedContentTypes.includes(contentType)) {
            return respond(
              response,
              400,
              refusal(400, "content_type_not_accepted"),
            );
          }
          const uploadSessionId = crypto.randomUUID();
          state.uploads.set(uploadSessionId, {
            filename: body.filename ?? "file",
            contentType,
            sizeBytes: body.sizeBytes ?? 0,
          });
          return respond(response, 200, {
            uploadSessionId,
            uploadUrl: `https://127.0.0.1:${port}/__fixture/objects/${uploadSessionId}?size=${body.sizeBytes}`,
            expiresAt: now,
            maximumSizeBytes: 5_000_000,
          } satisfies Automations["UploadTicket"]);
        }
      }
      if (method === "GET" && pathname === itemsPath) {
        if (state.itemsFailing)
          return respond(response, 503, problem(503, "Service Unavailable"));
        return respond(response, 200, {
          items: state.items.filter((item) => item.archivedAt === null),
          choices: { area: [...state.itemChoices].sort() },
        } satisfies AutomationOperations["listItems"]["responses"][200]["content"]["application/json"]);
      }
      if (method === "POST" && pathname === itemsPath) {
        const key = request.headers["idempotency-key"];
        if (typeof key !== "string" || !key)
          return respond(response, 400, problem(400, "Bad Request"));
        if (!administering) {
          return respond(
            response,
            403,
            problem(403, "Forbidden", { requiredRole: "admin" }),
          );
        }
        const replayed = itemOf(state.itemKeys.get(key) ?? "");
        if (replayed) return respond(response, 200, { item: replayed });
        const body = (await requestJson(request)) as {
          fields?: Record<string, string>;
          file?: string;
        };
        state.itemCreates.push(body as Json);
        const fields = body.fields ?? {};
        const problems: { path: string; message: string }[] = [];
        const area = fields.area ?? "North";
        if (area.length > 40)
          problems.push({ path: "fields.area", message: "too long" });
        if (!fields.name || fields.name.length > 60)
          problems.push({ path: "fields.name", message: "is required" });
        if (problems.length > 0) {
          return respond(
            response,
            422,
            problem(422, "Unprocessable Content", { problems }),
          );
        }
        const file = state.files.get(body.file ?? "");
        if (!file || file.runId) {
          return respond(response, 422, refusal(422, "artifact_unavailable"));
        }
        file.runId = "item-read";
        const made = fixtureItem(
          crypto.randomUUID(),
          area,
          fields.name,
          new Date().toISOString(),
          { status: "reading" },
        );
        state.items.unshift(made);
        state.itemKeys.set(key, made.id);
        if (!areaOptions.includes(area) && !state.itemChoices.includes(area))
          state.itemChoices.push(area);
        return respond(response, 201, { item: made });
      }
      // Build 28 (plan §1): the file an item was made from, behind its link;
      // an item with none, or another workspace's, is not found.
      const itemFileMatch = new RegExp(
        `^${scope}/items/([^/]+)/file$`,
        "u",
      ).exec(pathname);
      if (method === "GET" && itemFileMatch) {
        const file = itemOf(itemFileMatch[1] ?? "")?.file;
        if (!file) return respond(response, 404, problem(404, "Not Found"));
        return respond(response, 200, fixtureFileLink(file));
      }
      const itemPathMatch = new RegExp(
        `^${scope}/items/([^/]+)(/archive)?$`,
        "u",
      ).exec(pathname);
      if (itemPathMatch) {
        const item = itemOf(itemPathMatch[1] ?? "");
        if (!item) return respond(response, 404, problem(404, "Not Found"));
        if (method === "GET" && !itemPathMatch[2]) {
          return respond(response, 200, {
            item,
            runs: state.itemRuns.get(item.id) ?? [],
          } satisfies AutomationOperations["readItem"]["responses"][200]["content"]["application/json"]);
        }
        if (method === "POST" && itemPathMatch[2]) {
          if (!administering) {
            return respond(
              response,
              403,
              problem(403, "Forbidden", { requiredRole: "admin" }),
            );
          }
          item.archivedAt ??= now;
          return respond(response, 200, { item });
        }
      }
      if (method === "POST" && isWorkspacePath(pathname, "/runs")) {
        const body = (await requestJson(request)) as {
          subscriptionId?: string;
          itemId?: string;
          input?: Json;
        };
        if (body.subscriptionId === itemsSubscriptionId) {
          state.itemRunStarts.push(body as Json);
          if (!body.itemId)
            return respond(response, 422, refusal(422, "item_required"));
          if (!administering) {
            return respond(
              response,
              403,
              problem(403, "Forbidden", { requiredRole: "admin" }),
            );
          }
          const item = itemOf(body.itemId);
          if (!item) return respond(response, 404, problem(404, "Not Found"));
          if (item.archivedAt)
            return respond(response, 409, refusal(409, "item_archived"));
          if (item.status !== "ready")
            return respond(response, 409, refusal(409, "item_not_ready"));
          const fileId = body.input?.entryFile;
          const file =
            typeof fileId === "string" ? state.files.get(fileId) : undefined;
          if (!file || file.runId)
            return respond(response, 422, refusal(422, "artifact_unavailable"));
          const run = itemRun(crypto.randomUUID(), "pending", {
            itemId: item.id,
          });
          file.runId = run.id;
          state.itemRuns.set(item.id, [
            ...(state.itemRuns.get(item.id) ?? []).filter(
              (other) => typeof other.score === "number",
            ),
            run,
            ...(state.itemRuns.get(item.id) ?? []).filter(
              (other) => typeof other.score !== "number",
            ),
          ]);
          item.runCount += 1;
          return respond(response, 201, { run });
        }
      }
      if (method === "GET" && pathname === `${scope}/runs/${scoredRunId}`) {
        const run = (state.itemRuns.get(readyItemId) ?? []).find(
          (candidate) => candidate.id === scoredRunId,
        );
        if (run) {
          return respond(response, 200, {
            run,
            steps: [],
            events: [],
            sections: scoredRunSections,
            files: [fixtureFile(entryFileId, "ada-lane.pdf")],
          } satisfies AutomationOperations["readRun"]["responses"][200]["content"]["application/json"]);
        }
      }
      // Build 28 (plan §1): the scored run's file, behind its link; any other
      // file id is not this job's.
      if (
        method === "GET" &&
        pathname.startsWith(`${scope}/runs/${scoredRunId}/files/`)
      ) {
        if (
          pathname !== `${scope}/runs/${scoredRunId}/files/${entryFileId}` ||
          state.entryFileLinkGone
        )
          return respond(response, 404, problem(404, "Not Found"));
        return respond(
          response,
          200,
          fixtureFileLink(fixtureFile(entryFileId, "ada-lane.pdf")),
        );
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
      // And for Invoice Processing's, whose run reads one too.
      if (
        body.subscriptionId !== manualSubscriptionId &&
        body.subscriptionId !== invoiceSubscriptionId
      ) {
        return respond(response, 409, {
          ...problem(409, "Conflict"),
          details: { reason: "no_file_input" },
        } satisfies Platform["ApiProblem"]);
      }
      // Invoice Processing's types — a PDF, a JPEG or a PNG (the owner's
      // approval of 2026-10-10) — the three the website's file field sends
      // (BUILD-PLAN 25.8.5). Any other is refused as the platform refuses a
      // type a manifest does not accept.
      const contentType = body.contentType ?? "";
      if (
        !["application/pdf", "image/jpeg", "image/png"].includes(contentType)
      ) {
        return respond(response, 400, {
          ...problem(400, "Bad Request"),
          details: { reason: "content_type_not_accepted" },
        } satisfies Platform["ApiProblem"]);
      }
      if (state.uploadRefusal?.stage === "open") {
        const { status, reason } = state.uploadRefusal;
        return respond(response, status, refusal(status, reason));
      }
      const uploadSessionId = crypto.randomUUID();
      state.uploads.set(uploadSessionId, {
        filename: body.filename ?? "file",
        contentType,
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
      state.uploadCompletions += 1;
      const upload = state.uploads.get(uploadComplete[1] ?? "");
      if (!upload) return respond(response, 404, problem(404, "Not Found"));
      if (state.uploadRefusal?.stage === "complete") {
        const { status, reason } = state.uploadRefusal;
        return respond(response, status, refusal(status, reason));
      }
      if (upload.received === undefined) {
        return respond(response, 400, {
          ...problem(400, "Bad Request"),
          details: { reason: "no_object" },
        } satisfies Platform["ApiProblem"]);
      }
      // Sealed, with no place yet to measure it: the upload stays open, and
      // completing it again measures it (backend BUILD-PLAN 25.2.39).
      if (state.measurementBusy > 0) {
        state.measurementBusy -= 1;
        return respond(response, 429, refusal(429, "measurement_busy"));
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
      } satisfies AutomationOperations["completeUpload"]["responses"][200]["content"]["application/json"]);
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
      if (state.exportReadsFailing > 0) {
        state.exportReadsFailing -= 1;
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
      state.exportJobReads += 1;
      if (state.exportFailure !== null) {
        return respond(response, 200, {
          export: {
            id: exportJobId,
            status: "failed",
            createdAt: now,
            completedAt: now,
            ...(state.exportFailure
              ? { failureReason: state.exportFailure }
              : {}),
          },
        } satisfies Platform["WorkspaceExportJobResponse"]);
      }
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
                complete: !state.exportPartial,
                file: {
                  artifactId: exportJobId,
                  filename: "workspace-export-2026-08-12.json",
                  sizeBytes: 52,
                  downloadUrl: signedLink(
                    `https://127.0.0.1:${port}/__fixture/export-file?read=${state.exportJobReads}`,
                  ),
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
      // Backend ADR-0036: a team sent is ignored — the flow goes to the
      // workspace's team of its category, found or made, and never one a
      // client names. An Add refused as the platform refuses one.
      if (state.addRefusal !== null) {
        const status = state.addRefusal;
        state.addRefusal = null;
        return respond(response, status, problem(status, "Not Found"));
      }
      // The non-archived team of a kind, matched without case — the fixture
      // project is "general" — or one made for it, owned by the workspace's
      // owner, as Access makes it.
      const categoryTeam = (kind: string) => {
        const found = [
          ...(state.fixtureProjectListed ? [project] : []),
          ...createdIn(workspaceId),
        ].find(
          (team) =>
            team.status !== "archived" &&
            team.type.toLowerCase() === kind.toLowerCase(),
        );
        if (found) return found.id;
        const made = {
          id: `${String(state.createdProjects.length).padStart(8, "5")}-5555-4555-8555-555555555555`,
          workspaceId,
          name: kind,
          type: kind,
          status: "active",
          viewerRole: "owner",
          createdAt: now,
        } satisfies Platform["ProjectSummary"];
        state.createdProjects.push(made);
        return made.id;
      };
      // Invoice Processing, added (Build 21; the owner's AM4): a draft with its
      // defaults, in the Accounting team, whose Set up turns it on.
      if (
        body.templateId === invoiceAutomation.templateId &&
        !state.invoiceAdded
      ) {
        state.invoiceAdded = true;
        state.invoiceStatus = "draft";
        state.invoiceConfig = {};
        return respond(response, 200, {
          subscription: invoiceSubscription(),
        } satisfies AutomationOperations["createSubscription"]["responses"][200]["content"]["application/json"]);
      }
      if (body.templateId === projectAutomation.templateId) {
        const scope = categoryTeam(projectAutomation.category);
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
      if (
        body.templateId === archivableAutomation.templateId &&
        state.archivableArchived &&
        !state.archivableAgain
      ) {
        // Unarchiving is adding afresh (the owner's build 12, #4): its one
        // copy archived, the archivable automation takes a new subscription —
        // a draft, in the team of its category — and the archived one stays
        // as it was.
        state.archivableAgain = {
          ...archivableSubscription,
          id: archivableAgainId,
          status: "draft",
          projectId: categoryTeam(archivableAutomation.category),
        };
        return respond(response, 200, {
          subscription: state.archivableAgain,
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
    if (
      method === "POST" &&
      isWorkspacePath(pathname, "/runs") &&
      state.overPlan
    ) {
      // Decision 7a3: no flow starts a run while the workspace is over its plan.
      return respond(response, 403, {
        ...problem(403, "Access is forbidden"),
        details: { reason: "over_plan_limit", limit: 2, live: 4 },
      });
    }
    if (method === "POST" && isWorkspacePath(pathname, "/runs")) {
      const peek = (await requestJson(request)) as {
        subscriptionId?: string;
        input?: Json;
      };
      // Invoice Processing's run: its one optional field, a file it reads.
      if (peek.subscriptionId === invoiceSubscriptionId) {
        const keys = Object.keys(peek.input ?? {});
        const fileId = peek.input?.invoiceFile;
        const file =
          typeof fileId === "string" ? state.files.get(fileId) : undefined;
        if (
          !request.headers["idempotency-key"] ||
          keys.some((key) => key !== "invoiceFile") ||
          (fileId !== undefined && (!file || file.runId))
        ) {
          return respond(
            response,
            422,
            problem(422, "The request could not be processed"),
          );
        }
        if (file) file.runId = invoiceStartedRunId;
        state.invoiceRunStarted = true;
        state.invoiceRunStage = 0;
        return respond(response, 201, {
          run: fixtureRun(invoiceStartedRunId),
        } satisfies AutomationOperations["createRun"]["responses"][201]["content"]["application/json"]);
      }
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
        } satisfies Platform["ApiProblem"]);
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
      // Backend BUILD-PLAN 25.2.10: at capacity a run is held back `pending`;
      // only with its queue full as well is the start refused, and nothing is
      // created.
      if (state.runsAtCapacity > 0) {
        state.runsAtCapacity -= 1;
        return respond(response, 429, {
          ...problem(429, "The automation is at capacity"),
          details: {
            reason: "max_concurrent_runs",
            templateId: "fixture-manual-input",
            limit: "1",
          },
        } satisfies Platform["ApiProblem"]);
      }
      if (file) file.runId = startedRunId;
      return respond(response, 201, {
        run: { ...fixtureRun(startedRunId), status: "pending" },
      } satisfies AutomationOperations["createRun"]["responses"][201]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/runs")) {
      state.runsQueries.push(url.search);
      if (state.runsRead === "failing") {
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
      // The deterministic runs, so Activity renders rows and the run pages are
      // reached by a person rather than typed — or none, for a new workspace.
      // One flow's runs when asked for by its subscription (Build 21, spec A6:
      // a flow page's Dashboard opens Activity for it).
      const subscriptionId = url.searchParams.get("subscriptionId");
      const ids =
        subscriptionId === invoiceSubscriptionId
          ? [
              ...(state.invoiceRunStarted ? [invoiceStartedRunId] : []),
              ...invoiceRunIds,
            ]
          : subscriptionId === null || subscriptionId === manualSubscriptionId
            ? listedRunIds
            : [];
      if (state.runsCounted) return respond(response, 200, countedRuns(url));
      return respond(response, 200, {
        runs: state.runsRead === "empty" ? [] : ids.map(fixtureRun),
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
    // Round 21 v2: the image blocks' files, behind their signed links — gone
    // (404) or failing (500) while the fixture says so; any other file id is
    // not this job's.
    const pictureAsked = new RegExp(
      `^/v1/workspaces/${workspaceId}/runs/${pictureRunId}/files/([^/]+)$`,
      "u",
    ).exec(pathname);
    if (method === "GET" && pictureAsked) {
      if (state.pictureGone)
        return respond(response, 404, problem(404, "Not Found"));
      if (state.pictureFailing > 0) {
        state.pictureFailing -= 1;
        return respond(response, 500, problem(500, "Internal Server Error"));
      }
      const file =
        pictureAsked[1] === pictureJpegId
          ? {
              id: pictureJpegId,
              filename: "receipt.jpg",
              contentType: "image/jpeg",
              format: "JPEG",
              sizeBytes: fixtureJpeg.byteLength,
              pages: 1,
            }
          : pictureAsked[1] === picturePdfId
            ? fixtureFile(picturePdfId, "scanned-page.pdf")
            : null;
      if (!file) return respond(response, 404, problem(404, "Not Found"));
      return respond(response, 200, fixtureFileLink(file));
    }
    // Build 24 (P12; backend ADR-0045): a job's package as a PDF or an Excel
    // file, behind a signed link to the fixture's store — never the bytes.
    // 409 while it has no documents or goes on; 503 `package_busy`, with its
    // wait, while the fixture says so.
    const packageAsked = new RegExp(
      `^/v1/workspaces/${workspaceId}/runs/([^/]+)/package$`,
      "u",
    ).exec(pathname);
    if (method === "POST" && packageAsked) {
      const runId = decodeURIComponent(packageAsked[1] ?? "");
      const body = (await requestJson(request)) as {
        format?: string;
        timeZone?: string;
      };
      const keyed = Boolean(request.headers["idempotency-key"]);
      if (!keyed || (body.format !== "pdf" && body.format !== "xlsx")) {
        return respond(response, 400, problem(400, "Bad Request"));
      }
      state.packageFiles.push({
        runId,
        format: body.format,
        timeZone: body.timeZone ?? null,
        keyed,
      });
      if (state.packageFailing)
        return respond(response, 500, problem(500, "Internal Server Error"));
      if (state.packageBusy > 0) {
        state.packageBusy -= 1;
        response.setHeader("retry-after", "1");
        return respond(
          response,
          503,
          problem(503, "Service Unavailable", { reason: "package_busy" }),
        );
      }
      const run = fixtureRun(runId);
      const documents = invoiceDocuments(runId);
      if (
        documents.length === 0 ||
        run.status === "pending" ||
        run.status === "running"
      ) {
        return respond(
          response,
          409,
          problem(409, "Conflict", {
            reason: documents.length === 0 ? "no_documents" : "job_in_progress",
          }),
        );
      }
      const bytes =
        body.format === "pdf" ? fixturePdf(run.id) : fixtureWorkbook();
      return respond(response, 200, {
        format: body.format,
        filename: `run-${run.id}.${body.format}`,
        contentType:
          body.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: bytes.byteLength,
        downloadUrl: signedLink(
          `https://127.0.0.1:${port}/__fixture/package-file?run=${encodeURIComponent(run.id)}&format=${body.format}`,
        ),
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      } satisfies Automations["RunPackageFile"]);
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
      // Build 21 (spec A7, C2): a run's documents as a JSON file, named by
      // the run's full id.
      if (runId.endsWith("/documents")) {
        const documentsOf = runId.slice(0, -"/documents".length);
        const run = fixtureRun(documentsOf);
        response.setHeader(
          "content-disposition",
          `attachment; filename="run-${run.id}.json"`,
        );
        return respond(response, 200, {
          runId: run.id,
          templateId: run.templateId,
          templateVersion: run.templateVersion,
          status: run.status,
          startedAt: run.startedAt ?? null,
          endedAt: run.endedAt ?? null,
          documents: invoiceDocuments(documentsOf),
        } satisfies Automations["RunDocumentsFile"]);
      }
      if (state.runReadsFailing > 0) {
        state.runReadsFailing -= 1;
        state.runReadsRefused += 1;
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
      const run = fixtureRun(runId);
      const failed = run.status === "failed";
      // Invoice Processing's runs: what each reported — no step that did not
      // run is reported — and the documents it read (backend ADR-0039).
      if (runId === invoiceStartedRunId || invoiceRunIds.includes(runId)) {
        const documents = invoiceDocuments(runId);
        return respond(response, 200, {
          run,
          steps: invoiceSteps(runId),
          events: [],
          ...(documents.length > 0 ? { documents } : {}),
          files: invoiceFiles(runId),
          email: invoiceEmail(runId),
        } satisfies AutomationOperations["readRun"]["responses"][200]["content"]["application/json"]);
      }
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
      const body = (await requestJson(request)) as {
        decision?: string;
        decisions?: { id?: unknown; decision?: unknown }[];
      };
      if (!request.headers["idempotency-key"])
        return respond(response, 400, problem(400, "Bad Request"));
      // A review (Round 21, F2): it takes `decisions`,
      // every offered change answered once, and never `decision`; saving it
      // always continues the job, even with every change denied. Any other
      // approval takes `decision` alone.
      const offered = approval.decisions;
      if (offered) {
        const answers = Array.isArray(body.decisions) ? body.decisions : [];
        const ids = answers.map((answer) => answer.id);
        if (
          body.decision !== undefined ||
          answers.length !== offered.length ||
          new Set(ids).size !== ids.length ||
          !offered.every((change) => ids.includes(change.id)) ||
          answers.some(
            (answer) =>
              answer.decision !== "accepted" && answer.decision !== "denied",
          )
        )
          return respond(response, 400, {
            ...problem(400, "Bad Request"),
            detail: "decisions must answer every change once",
          });
        for (const change of offered)
          change.decision = answers.find((answer) => answer.id === change.id)!
            .decision as Automations["ReviewAnswer"]["decision"];
        approval.status = "approved";
        approval.decidedAt = now;
        approval.decidedByUserId = userId;
        return respond(response, 200, {
          approval,
        } satisfies AutomationOperations["decideApproval"]["responses"][200]["content"]["application/json"]);
      }
      if (
        body.decisions !== undefined ||
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
      state.approvalListReads += 1;
      if (state.approvalListFailing > 0) {
        state.approvalListFailing -= 1;
        state.approvalListRefused += 1;
        return respond(response, 503, problem(503, "Service Unavailable"));
      }
      // The held job asked nothing while it goes on, and its approval is not
      // listed yet on a read the test left it off (R5c 1).
      const unlisted =
        state.heldJobLive === "running" || state.heldApprovalHiddenReads > 0;
      if (state.heldApprovalHiddenReads > 0) state.heldApprovalHiddenReads -= 1;
      return respond(response, 200, {
        approvals: [
          ...state.approvals,
          ...(state.approvals.some((entry) => entry.id === invoiceApprovalId)
            ? []
            : [invoiceApproval()]),
        ]
          .filter((entry) => !(unlisted && entry.id === invoiceApprovalId))
          .filter((entry) => !status || entry.status === status),
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
        plans: listedPlans(),
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
              cancelAtPeriodEnd: state.billingCancelled,
            } satisfies Platform["WorkspaceBillingResponse"])
          : ({
              workspaceId: billedWorkspace,
              planId: "fixture-free",
              displayName: "Free",
            } satisfies Platform["WorkspaceBillingResponse"]);
        return respond(response, 200, body);
      }
      if (method === "POST" && operation === "/checkout") {
        state.checkoutAttempts += 1;
        const body = (await requestJson(request)) as { planId?: string };
        const plan = listedPlans().find(
          (candidate) => candidate.planId === body.planId,
        );
        // The Edge answers 404 for a plan that is not purchasable — one it
        // does not list.
        if (!plan) {
          return respond(
            response,
            404,
            problem(404, "The plan is not purchasable"),
          );
        }
        // Backend 24.12: a workspace that already has a plan changes it in the
        // portal; a second checkout would bill both.
        if (subscribed) {
          return respond(response, 409, {
            ...problem(409, "Conflict", { reason: "plan_exists" }),
            detail:
              "This workspace already has a plan. Change it in Manage billing.",
          } satisfies Platform["ApiProblem"]);
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
      // (`snoopy-backend/apps/api/src/app.ts`, the `/v1/account` handler), so the browser is
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
