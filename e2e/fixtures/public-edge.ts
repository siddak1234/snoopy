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
  }) satisfies Automations["AutomationCatalogEntry"];

const catalog = {
  automations: [
    automation("fixture-plan-limit", "Plan-limit automation"),
    automation("fixture-entitlements", "Entitlements automation"),
  ],
  categories: ["All", "Operations"],
} satisfies Automations["AutomationCatalogResponse"];

let connectionAttemptKey: string | null = null;
let fixtureConnectionCreated = false;
let exportCount = 0;

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

function fixtureSessionValue(
  cookie: string | undefined,
): "owner" | "requester" | null {
  const value = cookie
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${fixtureCookie}=`));
  if (value === `${fixtureCookie}=owner`) return "owner";
  if (value === `${fixtureCookie}=requester`) return "requester";
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
    const fixtureSession = fixtureSessionValue(request.headers.cookie);
    if (!fixtureSession) {
      respond(response, 401, problem(401, "Authentication is required"));
      return;
    }

    const { pathname } = url;
    const method = request.method ?? "GET";
    if (method === "GET" && pathname === "/v1/session") {
      return respond(
        response,
        200,
        fixtureSession === "owner" ? session : requesterSession,
      );
    }
    if (method === "GET" && pathname === "/v1/auth/providers") {
      const providers = {
        providers: [{ id: "google", label: "Google" }],
        passwordLoginEnabled: false,
        magicLinkLoginEnabled: false,
      } satisfies Platform["LoginProvidersResponse"];
      return respond(response, 200, providers);
    }
    if (method === "GET" && pathname === "/v1/auth/identities")
      return respond(response, 200, { identities: [] });
    if (method === "GET" && pathname === "/v1/workspaces") {
      return respond(response, 200, {
        workspaces: fixtureSession === "owner" ? [workspace] : [],
        ...(fixtureSession === "owner"
          ? { activeWorkspaceId: workspaceId }
          : {}),
      } satisfies Platform["WorkspaceListResponse"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/projects")) {
      return respond(response, 200, {
        projects: [project],
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
      return respond(response, 200, catalog);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/subscriptions")) {
      return respond(response, 200, {
        subscriptions: [],
      } satisfies AutomationOperations["listSubscriptions"]["responses"][200]["content"]["application/json"]);
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
    if (method === "GET" && isWorkspacePath(pathname, "/runs")) {
      return respond(response, 200, {
        runs: [],
      } satisfies AutomationOperations["listRuns"]["responses"][200]["content"]["application/json"]);
    }
    if (method === "GET" && isWorkspacePath(pathname, "/approvals")) {
      return respond(response, 200, {
        approvals: [],
      } satisfies AutomationOperations["listApprovals"]["responses"][200]["content"]["application/json"]);
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
