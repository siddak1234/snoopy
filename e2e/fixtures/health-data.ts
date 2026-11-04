/**
 * The fixture Edge's health data surfaces (Round 21, Stage 2), beside
 * `public-edge.ts`, which owns its state and calls `healthRoute` before its
 * own add and run routes: the health data agreement and a workspace's
 * Documents (backend ADR-0049, C3). Each is off until a test's control turns
 * it on, but for the one signed document the organization starts with, so no
 * other test meets them. Made-up text only: this repository is public.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { components as PlatformSchemas } from "../../lib/generated/platform-contracts/platform";

type Platform = PlatformSchemas["schemas"];
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

export function healthState() {
  return {
    // The workspace's flows carry health data, and whether its owner has
    // accepted the current agreement, or none is published yet.
    healthData: false,
    agreementAccepted: false,
    agreementUnpublished: false,
    // Every add and run start sent while the flows carry health data, with
    // its key — a repeat after Accept must carry the refused one's.
    healthRequests: [] as {
      path: "subscriptions" | "runs";
      key: string | null;
      accepted: boolean;
    }[],
    // Every acceptance the platform took, with its key and body.
    acceptances: [] as { key: string | null; body: Json }[],
    documents: [signedDocument] as Platform["WorkspaceDocument"][],
  };
}
export type HealthState = ReturnType<typeof healthState>;

/** The controls a test turns these on with. */
export function healthControls(
  health: HealthState,
): Record<string, () => boolean | void> {
  return {
    "/__fixture/health-data": () => {
      health.healthData = true;
    },
    "/__fixture/agreement-unpublished": () => {
      health.healthData = true;
      health.agreementUnpublished = true;
    },
    "/__fixture/documents-none": () => {
      health.documents = [];
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

  // An add or a run start while the flows carry health data: refused 403
  // `agreement_required` until the owner accepts, nothing made — a member's
  // add excepted, which the Edge refuses first as a member's. Once accepted,
  // recorded and answered by the fixture's own routes.
  const start =
    method === "POST" &&
    (pathname === `${scope}/subscriptions` || pathname === `${scope}/runs`);
  if (
    start &&
    health.healthData &&
    !(pathname.endsWith("/subscriptions") && input.session === "member")
  ) {
    health.healthRequests.push({
      path: pathname.endsWith("/runs") ? "runs" : "subscriptions",
      key: header(request, "idempotency-key"),
      accepted: health.agreementAccepted,
    });
    if (health.agreementAccepted) return false;
    respond(response, 403, {
      ...problem(403, "Forbidden"),
      details: {
        reason: "agreement_required",
        kind: "health-data",
        ...(health.agreementUnpublished ? {} : { version: 1 }),
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
    if (body.version !== 1 || body.sha256 !== AGREEMENT_SHA256) {
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
    if (!document) respond(response, 404, problem(404, "Not Found"));
    else
      respond(response, 200, {
        document: signedCopy(document, input.organizationName),
      });
    return true;
  }

  return false;
}
