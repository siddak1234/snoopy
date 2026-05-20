import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * DELETE /api/account/delete
 * Deletes the current user's account and related data, and removes the auth user
 * (and all linked identities: Google, Microsoft, etc.). Call only when user has confirmed.
 */
export async function DELETE() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const appUserId = session.user.id;

  // Resolve Supabase Auth user id so we can delete auth user and linked identities after DB delete.
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const supabaseUserId = authUser?.id ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Find every workspace the user belongs to (with role + workspace type).
      //    We need this BEFORE deleting the user, since cascade-deleting the
      //    user row would remove their memberships and erase the context.
      const userMemberships = await tx.membership.findMany({
        where: { userId: appUserId },
        select: {
          role: true,
          workspaceId: true,
          workspace: { select: { type: true } },
        },
      });

      // 2. Decide which workspaces should be removed alongside the user:
      //    - Personal workspaces always go (they exist only for this user).
      //    - Org workspaces go only if the user is the LAST remaining OWNER —
      //      otherwise the org survives and other owners/members keep working.
      const workspaceIdsToDelete: string[] = [];
      for (const m of userMemberships) {
        if (m.workspace.type === "personal") {
          workspaceIdsToDelete.push(m.workspaceId);
          continue;
        }
        if (m.role === "OWNER") {
          const otherOwners = await tx.membership.count({
            where: {
              workspaceId: m.workspaceId,
              role: "OWNER",
              userId: { not: appUserId },
            },
          });
          if (otherOwners === 0) {
            workspaceIdsToDelete.push(m.workspaceId);
          }
        }
      }

      // 3. Detach project ownership references that survive on workspaces we
      //    are NOT deleting (the FK on projects.ownerUserId is RESTRICT, so
      //    we need to null these out before the user goes).
      await tx.project.updateMany({
        where: { ownerUserId: appUserId },
        data: { ownerUserId: null, ownerName: null },
      });

      // 4. Delete the user. Cascade clears: memberships, project_memberships,
      //    workflows. Personal workspaces are NOT cascaded by this delete
      //    (workspaces have no FK to user), which is why step 5 is separate.
      await tx.user.delete({ where: { id: appUserId } });

      // 5. Delete the workspaces we marked. Cascade clears the workspace's
      //    projects + project_memberships + invites + verification tokens.
      if (workspaceIdsToDelete.length > 0) {
        await tx.workspace.deleteMany({
          where: { id: { in: workspaceIdsToDelete } },
        });
      }
    });

    if (supabaseUserId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createAdminClient();
        const { error } = await admin.auth.admin.deleteUser(supabaseUserId);
        if (error) {
          console.error("ACCOUNT_DELETE_AUTH_FAIL", {
            supabaseUserId,
            message: error.message,
          });
          // App user and data are already removed; log but still return success so the user is signed out and sees "deleted".
        }
      } catch (adminErr) {
        console.error("ACCOUNT_DELETE_AUTH_ERROR", {
          supabaseUserId,
          message: (adminErr as Error).message,
        });
      }
    } else if (supabaseUserId && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("ACCOUNT_DELETED_AUTH_SKIP", {
        supabaseUserId,
        reason: "SUPABASE_SERVICE_ROLE_KEY not set; auth user and linked identities were not removed.",
      });
    }

    console.log("ACCOUNT_DELETED", { appUserId, supabaseUserId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ACCOUNT_DELETE_FAIL", {
      appUserId,
      message: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Could not delete account. Please try again." },
      { status: 500 }
    );
  }
}
