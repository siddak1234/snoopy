"use server";

import { PlatformServerError } from "@/lib/platform-server";
import { getAppSession } from "@/lib/app-session";
import { extractDomain } from "@/lib/domain-utils";
import {
  cancelOrganizationJoinRequest,
  claimOrganizationDomain,
  createWorkspace,
  requestOrganizationJoin,
} from "@/lib/tenancy";

function platformMessage(error: unknown, fallback: string): string {
  return error instanceof PlatformServerError ? error.message : fallback;
}

async function currentSession() {
  const session = await getAppSession();
  if (!session?.user.id) return null;
  return session;
}

export type CreateOrgResult = { ok: true } | { ok: false; error: string };

export async function createOrgWorkspaceAction(
  formData: FormData,
): Promise<CreateOrgResult> {
  const session = await currentSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Organization name is required." };
  }
  const domain = extractDomain(session.user.email);
  if (!domain) return { ok: false, error: "Your email domain is unavailable." };

  try {
    const created = await createWorkspace({
      name: name.trim(),
      type: "organization",
      activate: true,
    });
    await claimOrganizationDomain(created.workspace.id, {
      domain,
      joinPolicy: "approval",
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The organization could not be created."),
    };
  }
}

export type CreatePersonalResult = { ok: true } | { ok: false; error: string };

export async function createPersonalWorkspaceAction(): Promise<CreatePersonalResult> {
  const session = await currentSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  try {
    const label = session.user.name?.trim()
      ? `${session.user.name.trim()}'s Workspace`
      : `${session.user.email}'s Workspace`;
    await createWorkspace({ name: label, type: "personal", activate: true });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(
        error,
        "The personal workspace could not be created.",
      ),
    };
  }
}

export type JoinOrgResult =
  | { ok: true; outcome: "joined" }
  | { ok: true; outcome: "requested"; requestId?: string }
  | { ok: false; error: string };

export async function joinOrgWorkspaceAction(
  workspaceId: string,
): Promise<JoinOrgResult> {
  if (!(await currentSession())) {
    return { ok: false, error: "Please sign in again." };
  }
  try {
    const result = await requestOrganizationJoin(workspaceId);
    return {
      ok: true,
      outcome: result.outcome,
      ...(result.request ? { requestId: result.request.id } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The organization could not be joined."),
    };
  }
}

export type CancelJoinRequestResult =
  { ok: true } | { ok: false; error: string };

export async function cancelJoinRequestAction(
  workspaceId: string,
  joinRequestId: string,
): Promise<CancelJoinRequestResult> {
  if (!(await currentSession())) {
    return { ok: false, error: "Please sign in again." };
  }
  try {
    await cancelOrganizationJoinRequest(workspaceId, joinRequestId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The join request could not be cancelled."),
    };
  }
}
