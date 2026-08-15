"use server";

import { revalidatePath } from "next/cache";
import { PlatformServerError } from "@/lib/platform-server";
import {
  claimOrganizationDomain,
  decideOrganizationJoinRequest,
  removeWorkspaceMember,
  revokeOrganizationDomain,
  updateOrganizationDomain,
  updateWorkspace,
  verifyOrganizationDomain,
  type OrganizationDomainJoinPolicy,
  type OrganizationJoinRequestDecision,
} from "@/lib/tenancy";

type OrganizationActionResult = { ok: true } | { ok: false; error: string };

function organizationActionError(error: unknown, fallback: string): string {
  return error instanceof PlatformServerError ? error.message : fallback;
}

function revalidateOrganization() {
  revalidatePath("/account/organization");
}

export type UpdateWorkspaceNameResult = OrganizationActionResult;

export async function updateWorkspaceNameAction(
  workspaceId: string,
  newName: string,
): Promise<UpdateWorkspaceNameResult> {
  const name = newName.trim();
  if (!name) return { ok: false, error: "Organization name is required." };

  try {
    await updateWorkspace(workspaceId, { name });
    revalidateOrganization();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(
        error,
        "The organization name could not be updated.",
      ),
    };
  }
}

export type RemoveWorkspaceMemberResult = OrganizationActionResult;

/** The backend authorizes and performs the documented workspace removal. */
export async function removeWorkspaceMemberAction(
  workspaceId: string,
  targetUserId: string,
): Promise<RemoveWorkspaceMemberResult> {
  try {
    await removeWorkspaceMember(workspaceId, targetUserId);
    revalidateOrganization();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(error, "The member could not be removed."),
    };
  }
}

export type ClaimOrganizationDomainResult =
  { ok: true; verificationRecordValue?: string } | { ok: false; error: string };

export async function claimOrganizationDomainAction(
  workspaceId: string,
  domain: string,
  joinPolicy: OrganizationDomainJoinPolicy,
): Promise<ClaimOrganizationDomainResult> {
  try {
    const result = await claimOrganizationDomain(workspaceId, {
      domain: domain.trim(),
      joinPolicy,
    });
    revalidateOrganization();
    return {
      ok: true,
      ...(result.verificationRecordValue
        ? { verificationRecordValue: result.verificationRecordValue }
        : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(error, "The domain could not be claimed."),
    };
  }
}

export async function updateOrganizationDomainAction(
  workspaceId: string,
  domainId: string,
  joinPolicy: OrganizationDomainJoinPolicy,
  discoveryEnabled: boolean,
): Promise<OrganizationActionResult> {
  try {
    await updateOrganizationDomain(workspaceId, domainId, {
      joinPolicy,
      discoveryEnabled,
    });
    revalidateOrganization();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(
        error,
        "The domain settings could not be updated.",
      ),
    };
  }
}

export async function verifyOrganizationDomainAction(
  workspaceId: string,
  domainId: string,
): Promise<OrganizationActionResult> {
  try {
    await verifyOrganizationDomain(workspaceId, domainId);
    revalidateOrganization();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(
        error,
        "The domain could not be verified.",
      ),
    };
  }
}

export async function revokeOrganizationDomainAction(
  workspaceId: string,
  domainId: string,
): Promise<OrganizationActionResult> {
  try {
    await revokeOrganizationDomain(workspaceId, domainId);
    revalidateOrganization();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(error, "The domain could not be revoked."),
    };
  }
}

export async function decideOrganizationJoinRequestAction(
  workspaceId: string,
  joinRequestId: string,
  decision: OrganizationJoinRequestDecision,
): Promise<OrganizationActionResult> {
  try {
    await decideOrganizationJoinRequest(workspaceId, joinRequestId, decision);
    revalidateOrganization();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: organizationActionError(
        error,
        "The join request could not be updated.",
      ),
    };
  }
}
