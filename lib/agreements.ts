/**
 * The health data agreement and a workspace's Documents, as the website reads
 * them (backend ADR-0049, C3; the words in `lib/health-agreement.ts`). Server
 * only: every call goes through `lib/platform-server.ts`.
 */

import {
  platformServerJson,
  PlatformServerError,
  workspacePath as scope,
} from "@/lib/platform-server";
import {
  AGREEMENT_NOT_PUBLISHED,
  ASK_OWNER,
  agreementRequired,
  type AgreementOffer,
} from "@/lib/health-agreement";
import { listWorkspaces } from "@/lib/tenancy";
import type {
  components,
  operations,
} from "./generated/platform-contracts/platform";

type Schema = components["schemas"];
export type HealthDataAgreement = Schema["HealthDataAgreement"];
export type AgreementAcceptanceRequest = Schema["AgreementAcceptanceRequest"];
export type WorkspaceDocument = Schema["WorkspaceDocument"];
export type WorkspaceDocumentCopy = Schema["WorkspaceDocumentCopy"];
type AcceptAgreementResponse =
  operations["acceptAgreement"]["responses"][201]["content"]["application/json"];
type ReadWorkspaceDocumentResponse =
  operations["readWorkspaceDocument"]["responses"][200]["content"]["application/json"];

const notPublished = (error: unknown) =>
  error instanceof PlatformServerError &&
  error.status === 503 &&
  error.details?.reason === "agreement_not_published";

/** The current text to read, or `null` while none is published (503 `agreement_not_published`). */
export async function readHealthDataAgreement(): Promise<HealthDataAgreement | null> {
  try {
    return await platformServerJson<HealthDataAgreement>(
      "/v1/agreements/health-data",
    );
  } catch (error) {
    if (notPublished(error)) return null;
    throw error;
  }
}

/**
 * The workspace's owner accepts the text it read (owner only, by the
 * platform's rule). The key is the dialog's, one per opening, so a retry
 * after a lost answer signs once.
 */
export function acceptAgreement(
  workspaceId: string,
  body: AgreementAcceptanceRequest,
  idempotencyKey: string,
): Promise<AcceptAgreementResponse> {
  return platformServerJson<AcceptAgreementResponse>(
    `${scope(workspaceId)}/agreements`,
    { method: "POST", body: JSON.stringify(body), idempotencyKey },
  );
}

/** The workspace's signed documents, newest first, at most 50: one read when the page opens. */
export async function listWorkspaceDocuments(
  workspaceId: string,
): Promise<WorkspaceDocument[]> {
  const { documents } = await platformServerJson<
    operations["listWorkspaceDocuments"]["responses"][200]["content"]["application/json"]
  >(`${scope(workspaceId)}/documents`);
  return documents;
}

/** One document with its signed copy, read only when its row is opened; `null` when it is not this workspace's. */
export async function readWorkspaceDocument(
  workspaceId: string,
  documentId: string,
): Promise<WorkspaceDocumentCopy | null> {
  try {
    const { document } =
      await platformServerJson<ReadWorkspaceDocumentResponse>(
        `${scope(workspaceId)}/documents/${encodeURIComponent(documentId)}`,
      );
    return document;
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404)
      return null;
    throw error;
  }
}

/** An add, a run or an item refused for the agreement, as a server action answers it. */
export type AgreementRefusal = {
  ok: false;
  /** The line to show; empty when the dialog opens instead. */
  error: string;
  state: "agreement-required";
  /** For the workspace's owner, while a version is published: the dialog's text. */
  agreement?: AgreementOffer;
};

/**
 * A refused add, run or item (`createSubscription`, `createRun`,
 * `createItem`) read as the agreement's, or `null` when the refusal is
 * another's. Only on this refusal
 * does it read anything: the workspace list (who this person is there, and
 * its name) and, for its owner, the text — never on any other add or run.
 * The owner gets the text to accept, or "isn't available yet" while none is
 * published; anyone else the line asking the owner.
 */
export async function agreementRefusal(
  error: unknown,
  workspaceId: string,
): Promise<AgreementRefusal | null> {
  if (!(error instanceof PlatformServerError)) return null;
  const required = agreementRequired(error.status, error.details);
  if (!required) return null;
  const refused = (line: string): AgreementRefusal => ({
    ok: false,
    error: line,
    state: "agreement-required",
  });
  try {
    const workspace = (await listWorkspaces()).find(
      (entry) => entry.id === workspaceId,
    );
    if (workspace?.role !== "owner") return refused(ASK_OWNER);
    const agreement =
      required.version === undefined ? null : await readHealthDataAgreement();
    if (!agreement) return refused(AGREEMENT_NOT_PUBLISHED);
    return {
      ...refused(""),
      agreement: {
        version: agreement.version,
        text: agreement.text,
        sha256: agreement.sha256,
        organization: workspace.name,
      },
    };
  } catch (read) {
    // Said in place, as every refusal here is (backend §12.1 #160).
    if (read instanceof PlatformServerError) return refused(read.message);
    throw read;
  }
}
