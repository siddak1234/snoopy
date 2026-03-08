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
      await tx.project.updateMany({
        where: { ownerUserId: appUserId },
        data: { ownerUserId: null, ownerName: null },
      });
      await tx.user.delete({
        where: { id: appUserId },
      });
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
