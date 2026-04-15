import type { ProjectMemberRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// canModifyMember — second-layer role-level enforcement (pure, no DB)
// ---------------------------------------------------------------------------
// This file has NO server-only imports so it can be used in client components.
// See lib/project-rbac.ts for the DB-backed checks (canUserPerform, etc.).
// ---------------------------------------------------------------------------

export type MemberModifyAction = "add" | "remove" | "change_role";

/**
 * Synchronous: all inputs are already-resolved roles, no DB lookup needed.
 *
 * @param actorRole  Role of the user performing the action.
 * @param targetRole Current role of the member being affected.
 *                   Pass null when adding a brand-new member (action === "add").
 * @param action     Operation: "add" | "remove" | "change_role".
 * @param newRole    Destination role — required when action === "change_role".
 */
export function canModifyMember(
  actorRole: ProjectMemberRole,
  targetRole: ProjectMemberRole | null,
  action: MemberModifyAction,
  newRole?: ProjectMemberRole
): boolean {
  // Owner can do anything to anyone
  if (actorRole === "owner") return true;

  if (actorRole === "admin") {
    // Admin can never touch the owner
    if (targetRole === "owner") return false;

    switch (action) {
      case "add":
        return true; // admin can add any new member

      case "remove":
        // Admin can only remove members, not other admins
        return targetRole === "member" || targetRole === "project_user";

      case "change_role":
        // Admin can only promote member/project_user → admin
        // Cannot demote admins, cannot touch owner (already handled above)
        if (targetRole !== "member" && targetRole !== "project_user") return false;
        return newRole === "admin";
    }
  }

  // member, project_user: cannot modify anyone
  return false;
}
