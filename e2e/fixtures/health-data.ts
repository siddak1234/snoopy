/**
 * The fixture Edge's health data surfaces (Round 21, Stage 2), beside
 * `public-edge.ts`, which owns its state and calls `healthRoute` before its
 * own key and run routes: the health data agreement, a workspace's
 * acceptance of it (ADR-0049 amendment 2) and its Documents (backend
 * ADR-0049, C3), and the EHR, a SMART Backend Services
 * provider (ADR-0050, D1); and S1-8b's Approve that a disconnect expired.
 * Each is off until a test's control turns it on,
 * but for the one signed document the organization starts with, so no other
 * test meets them. Made-up text and addresses only: this repository is public.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { components as PlatformSchemas } from "../../lib/generated/platform-contracts/platform";
import type { components as ConnectionSchemas } from "../../lib/generated/platform-contracts/connections";

type Platform = PlatformSchemas["schemas"];
type Connections = ConnectionSchemas["schemas"];
type Json = Record<string, unknown>;

const now = "2026-08-12T12:00:00.000Z";

/** The agreement's text, `{Covered Entity}` and `{Effective date}` left to fill, and its hash. */
const AGREEMENT_TEXT =
  "# Business Associate Agreement\n\nThis agreement is between {Covered Entity} and Autom8x, effective {Effective date}.\n\n1. Autom8x uses health data only to run the flows the Covered Entity adds.\n2. Autom8x tells the Covered Entity of any breach it finds.\n";
const AGREEMENT_SHA256 = createHash("sha256")
  .update(AGREEMENT_TEXT)
  .digest("hex");

/** The document the organization starts with: accepted by its owner. */
export const signedDocumentId = "d0c0d0c0-d0c0-4d0c-8d0c-d0c0d0c0d0c0";
const signedDocument = {
  id: signedDocumentId,
  kind: "health-data",
  version: 1,
  signerName: "Fixture Owner",
  signerTitle: "Owner",
  acceptedAt: now,
} satisfies Platform["WorkspaceDocument"];

/** The copy as accepted: the text filled, and its signature section. */
function signedCopy(
  document: Platform["WorkspaceDocument"],
  organization: string,
): Platform["WorkspaceDocumentCopy"] {
  const filled = AGREEMENT_TEXT.replace(
    "{Covered Entity}",
    organization,
  ).replace("{Effective date}", "August 12, 2026");
  return {
    ...document,
    text: `${filled}\n## Signature\n\n${organization}\n${document.signerName}, ${document.signerTitle}\nAuthorized to sign for ${organization}.\nAccepted ${document.acceptedAt}, version ${document.version}, SHA-256 ${AGREEMENT_SHA256}.\n`,
  };
}

export const ehrProviderId = "ehr-fhir";
const EHR_VENDORS = [
  { id: "epic-test", label: "Epic (test system)" },
  { id: "epic", label: "Epic" },
];
const ehrConnectionId = "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4";

export function healthState() {
  return {
    // The workspace's flows carry health data, and whether its owner has
    // accepted the current agreement, or none is published yet.
    healthData: false,
    agreementAccepted: false,
    agreementUnpublished: false,
    // How many repeats after the acceptance are refused (502), once each.
    repeatsRefused: 0,
    // Builds 37 and 39, wave 2: the workspace's agreement read failing
    // (503), and how many acceptances answer 409 `agreement_changed`.
    agreementReadFailing: false,
    agreementChanges: 0,
    // Every run start, item and turn-on (`public-edge.ts`'s Invoice
    // Processing PATCH to live) sent while the flows carry health data, with
    // its key — a repeat after Accept must carry the refused one's.
    healthRequests: [] as {
      path: "runs" | "items" | "turn-on";
      key: string | null;
      accepted: boolean;
    }[],
    // Every acceptance the platform took, with its key and body.
    acceptances: [] as { key: string | null; body: Json }[],
    documents: [signedDocument] as Platform["WorkspaceDocument"][],
    // The EHR: how many vendors this deployment holds a key for (0: not
    // offered), the host it is connected to, and every connect sent.
    ehrVendors: 0,
    ehrHost: null as string | null,
    ehrConnects: [] as { key: string | null; credentials: Json }[],
    // S1-8b: while set, an Approve is refused 409 approval_expired, its
    // approval expired by this provider's disconnect.
    approvalDisconnected: null as string | null,
  };
}
export type HealthState = ReturnType<typeof healthState>;

/** The controls a test turns these on with. A value it cannot use is false (400). */
export function healthControls(
  health: HealthState,
  url: URL,
): Record<string, () => boolean | void> {
  return {
    "/__fixture/health-data": () => {
      health.healthData = true;
    },
    "/__fixture/agreement-repeat-refused-once": () => {
      health.healthData = true;
      health.repeatsRefused = 1;
    },
    "/__fixture/agreement-unpublished": () => {
      health.healthData = true;
      health.agreementUnpublished = true;
    },
    "/__fixture/agreement-accepted": () => {
      health.healthData = true;
      health.agreementAccepted = true;
    },
    "/__fixture/agreement-read-failing": () => {
      health.healthData = true;
      health.agreementReadFailing = true;
    },
    "/__fixture/agreement-changed-once": () => {
      health.healthData = true;
      health.agreementChanges = 1;
    },
    "/__fixture/approval-disconnected": () => {
      health.approvalDisconnected = "quickbooks";
    },
    "/__fixture/documents-none": () => {
      health.documents = [];
    },
    "/__fixture/ehr-offered": () => {
      const vendors = Number(url.searchParams.get("vendors") ?? "2");
      if (vendors !== 1 && vendors !== 2) return false;
      health.ehrVendors = vendors;
    },
  };
}

/** The EHR in the provider list, while offered. */
export function ehrProviders(
  health: HealthState,
): Connections["ConnectionProvider"][] {
  if (health.ehrVendors === 0) return [];
  return [
    {
      providerId: ehrProviderId,
      displayName: "EHR",
      description:
        "Reads visit notes from your EHR. It never changes your records.",
      icon: "FirstAid",
      scopes: ["system/DocumentReference.read"],
      authType: "smart-backend",
      credentialFields: [
        {
          name: "fhirBaseUrl",
          label: "FHIR address",
          secret: false,
          help: "Your EHR team gives you this address.",
        },
      ],
      vendors: EHR_VENDORS.slice(0, health.ehrVendors),
    },
  ];
}

/** The EHR connection, once connected: named by the clinic's host. */
export function ehrConnections(
  health: HealthState,
  workspaceId: string,
): Connections["Connection"][] {
  if (!health.ehrHost) return [];
  return [
    {
      id: ehrConnectionId,
      providerId: ehrProviderId,
      workspaceId,
      externalAccount: { displayName: health.ehrHost },
      status: "connected",
      requiredScopes: [],
      grantedScopes: [],
      usedByCount: 0,
    },
  ];
}

/** The 403 a run start, an item or a turn-on answers before the owner accepted. */
export function agreementRefusal(
  health: HealthState,
  problem: (status: number, title: string, details?: Json) => Json,
): Json {
  return {
    ...problem(403, "Forbidden"),
    details: {
      reason: "agreement_required",
      kind: "health-data",
      ...(health.agreementUnpublished ? {} : { version: 1 }),
    },
  };
}

const header = (request: IncomingMessage, name: string) => {
  const value = request.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
};

/**
 * Answers a request that is one of these surfaces, as the platform would;
 * false for any other, which `public-edge.ts` answers.
 */
export async function healthRoute(input: {
  health: HealthState;
  method: string;
  pathname: string;
  workspaceId: string;
  organizationName: string;
  session: string | null;
  request: IncomingMessage;
  response: ServerResponse;
  respond: (response: ServerResponse, status: number, answer: Json) => void;
  problem: (status: number, title: string, details?: Json) => Json;
  requestJson: (request: IncomingMessage) => Promise<Json>;
}): Promise<boolean> {
  const { health, method, pathname, request, response, respond, problem } =
    input;
  const scope = `/v1/workspaces/${input.workspaceId}`;

  // A run start or an item (whose run it starts) while the flows carry
  // health data: refused 403 `agreement_required` until the owner accepts,
  // nothing made — a member's item excepted, which the Edge refuses first as
  // a member's. Once accepted, recorded and answered by the fixture's own
  // routes. An add is not refused (ADR-0049 amendment 2): its turn-on is,
  // in `public-edge.ts` (`agreementRefusal`).
  const item = new RegExp(`^${scope}/subscriptions/[^/]+/items$`, "u").test(
    pathname,
  );
  const start = method === "POST" && (pathname === `${scope}/runs` || item);
  if (start && health.healthData && !(item && input.session === "member")) {
    health.healthRequests.push({
      path: item ? "items" : "runs",
      key: header(request, "idempotency-key"),
      accepted: health.agreementAccepted,
    });
    if (health.agreementAccepted && health.repeatsRefused === 0) return false;
    if (health.agreementAccepted) {
      health.repeatsRefused -= 1;
      respond(response, 502, problem(502, "Bad Gateway"));
      return true;
    }
    respond(response, 403, agreementRefusal(health, problem));
    return true;
  }

  // What Set up's "Contract and accept" reads (ADR-0049 amendment 2): owner
  // or admin, a member 403; the current version, null while unpublished, and
  // the workspace's acceptance of it.
  if (method === "GET" && pathname === `${scope}/agreements/health-data`) {
    if (input.session === "member") {
      respond(response, 403, {
        ...problem(403, "Forbidden"),
        details: { requiredRole: "admin" },
      });
      return true;
    }
    if (health.agreementReadFailing) {
      respond(response, 503, problem(503, "Service Unavailable"));
      return true;
    }
    respond(response, 200, {
      kind: "health-data",
      current: health.agreementUnpublished
        ? null
        : { version: 1, sha256: AGREEMENT_SHA256 },
      acceptance:
        health.agreementAccepted && !health.agreementUnpublished
          ? (health.documents.find((document) => document.version === 1) ??
            null)
          : null,
    } satisfies Platform["WorkspaceHealthDataAgreement"]);
    return true;
  }

  // S1-8b: an Approve — the one press a test makes while this is on — after
  // the connection its held run was built on was disconnected.
  if (
    method === "POST" &&
    health.approvalDisconnected &&
    new RegExp(`^${scope}/approvals/[^/]+/decision$`, "u").test(pathname)
  ) {
    respond(response, 409, {
      ...problem(409, "The approval expired: its connection was disconnected"),
      details: {
        reason: "approval_expired",
        expiredBy: {
          reason: "connection-disconnected",
          providerId: health.approvalDisconnected,
        },
      },
    });
    return true;
  }

  if (method === "GET" && pathname === "/v1/agreements/health-data") {
    if (health.agreementUnpublished) {
      respond(response, 503, {
        ...problem(503, "Service Unavailable"),
        details: { reason: "agreement_not_published" },
      });
      return true;
    }
    respond(response, 200, {
      version: 1,
      text: AGREEMENT_TEXT,
      sha256: AGREEMENT_SHA256,
    } satisfies Platform["HealthDataAgreement"]);
    return true;
  }

  // The owner accepts: owner only, the text it read, and that it may sign.
  if (method === "POST" && pathname === `${scope}/agreements`) {
    if (input.session !== "owner") {
      respond(response, 403, {
        ...problem(403, "Forbidden"),
        details: { requiredRole: "owner" },
      });
      return true;
    }
    const body = await input.requestJson(request);
    const named = (key: string) =>
      typeof body[key] === "string" &&
      (body[key] as string).length >= 1 &&
      (body[key] as string).length <= 120;
    if (
      Object.keys(body).sort().join() !==
        "authorized,kind,sha256,signerName,signerTitle,version" ||
      body.kind !== "health-data" ||
      body.authorized !== true ||
      !named("signerName") ||
      !named("signerTitle")
    ) {
      respond(response, 400, problem(400, "Bad Request"));
      return true;
    }
    // A text changed since it was read: once per `agreement-changed-once`.
    const changed = health.agreementChanges > 0;
    if (changed) health.agreementChanges -= 1;
    if (changed || body.version !== 1 || body.sha256 !== AGREEMENT_SHA256) {
      respond(response, 409, {
        ...problem(409, "Conflict"),
        details: { reason: "agreement_changed" },
      });
      return true;
    }
    const document = {
      id: `d0c0d0c0-d0c0-4d0c-8d0c-${String(health.documents.length).padStart(12, "0")}`,
      kind: "health-data",
      version: 1,
      signerName: body.signerName as string,
      signerTitle: body.signerTitle as string,
      acceptedAt: now,
    } satisfies Platform["WorkspaceDocument"];
    health.acceptances.push({
      key: header(request, "idempotency-key"),
      body,
    });
    health.agreementAccepted = true;
    health.documents = [document, ...health.documents];
    respond(response, 201, { document });
    return true;
  }

  if (method === "GET" && pathname === `${scope}/documents`) {
    respond(response, 200, {
      documents: health.documents,
    } satisfies Platform["WorkspaceDocumentListResponse"]);
    return true;
  }
  const one = new RegExp(`^${scope}/documents/([^/]+)$`, "u").exec(pathname);
  if (method === "GET" && one) {
    const document = health.documents.find((entry) => entry.id === one[1]);
    // An id that is not a UUID is refused before it is looked up.
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(one[1]))
      respond(response, 400, {
        ...problem(400, "Bad Request"),
        details: { field: "documentId" },
      });
    else if (!document) respond(response, 404, problem(404, "Not Found"));
    else
      respond(response, 200, {
        document: signedCopy(document, input.organizationName),
      });
    return true;
  }

  // The EHR's connect: a vendor it lists and the clinic's FHIR address, no
  // secret; each address the platform refuses by its reason.
  if (method === "POST" && pathname === `${scope}/connections/key`) {
    const body = await input.requestJson(request);
    if (body.providerId !== ehrProviderId) return false;
    const credentials = (body.credentials ?? {}) as Json;
    health.ehrConnects.push({
      key: header(request, "idempotency-key"),
      credentials,
    });
    const vendor = credentials.vendor;
    const address = String(credentials.fhirBaseUrl ?? "");
    if (
      health.ehrVendors === 0 ||
      !EHR_VENDORS.slice(0, health.ehrVendors).some(({ id }) => id === vendor)
    ) {
      respond(response, 400, problem(400, "Bad Request"));
      return true;
    }
    const refusedFor: Record<string, string> = {
      "https://silent.example.test/fhir": "fhir_not_answering",
      "https://inactive.example.test/fhir": "ehr_not_activated",
    };
    const reason = address.startsWith("https://")
      ? refusedFor[address]
      : "fhir_address_refused";
    if (reason) {
      respond(response, 400, {
        ...problem(400, "Bad Request"),
        details: { reason },
      });
      return true;
    }
    health.ehrHost = new URL(address).host;
    respond(response, 201, {
      connection: ehrConnections(health, input.workspaceId)[0],
    });
    return true;
  }
  return false;
}
