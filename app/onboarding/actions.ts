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
import { JOIN_OUTSIDE_DOMAIN } from "@/lib/domain-only";

function platformMessage(error: unknown, fallback: string): string {
  return error instanceof PlatformServerError ? error.message : fallback;
}

/**
 * `null` is "no session" only. A refused or failed read throws (backend §12.1
 * #160), so every action calls this inside its try and shows the platform's
 * answer rather than "Please sign in again."
 */
async function currentSession() {
  const session = await getAppSession();
  if (!session?.user.id) return null;
  return session;
}

export type CreateOrgResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** The organization made before its claim was refused; the retry claims on it. */
      workspaceId?: string;
    };

/**
 * The organization, made active, then its claim on the email's domain, joined
 * by approval — the app's two steps (`snoopy-mobile`'s org-join).
 *
 * **Both idempotency keys come from the form**, one per intent, kept from press
 * to press: a press after a lost answer is answered with the organization or
 * the claim already made. A refused claim returns the organization made, and
 * the form's retry names it: only the claim is asked again, and no second
 * organization is made (backend §12.1 #186). The platform claims only on an
 * organization this person owns or administers.
 */
export async function createOrgWorkspaceAction(
  formData: FormData,
): Promise<CreateOrgResult> {
  const createKey = String(formData.get("createKey") ?? "");
  const claimKey = String(formData.get("claimKey") ?? "");
  if (
    ![createKey, claimKey].every((key) =>
      /^[A-Za-z0-9._~:-]{16,128}$/u.test(key),
    )
  ) {
    return { ok: false, error: "Reload the page and try again." };
  }
  let workspaceId = String(formData.get("workspaceId") ?? "") || null;
  try {
    const session = await currentSession();
    if (!session) return { ok: false, error: "Please sign in again." };

    const domain = extractDomain(session.user.email);
    if (!domain) {
      return { ok: false, error: "Your email domain is unavailable." };
    }
    if (!workspaceId) {
      const name = formData.get("name");
      if (typeof name !== "string" || !name.trim()) {
        return { ok: false, error: "Organization name is required." };
      }
      const created = await createWorkspace(
        { name: name.trim(), type: "organization", activate: true },
        createKey,
      );
      workspaceId = created.workspace.id;
    }
    await claimOrganizationDomain(
      workspaceId,
      { domain, joinPolicy: "approval" },
      claimKey,
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The organization could not be created."),
      ...(workspaceId ? { workspaceId } : {}),
    };
  }
}

export type CreatePersonalResult = { ok: true } | { ok: false; error: string };

export async function createPersonalWorkspaceAction(): Promise<CreatePersonalResult> {
  try {
    const session = await currentSession();
    if (!session) return { ok: false, error: "Please sign in again." };
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
  try {
    if (!(await currentSession())) {
      return { ok: false, error: "Please sign in again." };
    }
    const result = await requestOrganizationJoin(workspaceId);
    return {
      ok: true,
      outcome: result.outcome,
      ...(result.request ? { requestId: result.request.id } : {}),
    };
  } catch (error) {
    // An organization that admits only its verified domains (decision 8B).
    if (
      error instanceof PlatformServerError &&
      error.details?.reason === "outside_org_domain"
    ) {
      return { ok: false, error: JOIN_OUTSIDE_DOMAIN };
    }
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
  try {
    if (!(await currentSession())) {
      return { ok: false, error: "Please sign in again." };
    }
    await cancelOrganizationJoinRequest(workspaceId, joinRequestId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: platformMessage(error, "The join request could not be cancelled."),
    };
  }
}
