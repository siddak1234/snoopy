import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DELETE /api/account/delete
 * Deletes the current user's account and related data. Call only when user has confirmed.
 */
export async function DELETE() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: null, ownerName: null },
      });
      await tx.user.delete({
        where: { id: userId },
      });
    });
    console.log("ACCOUNT_DELETED", { userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ACCOUNT_DELETE_FAIL", { userId, message: (err as Error).message });
    return NextResponse.json(
      { error: "Could not delete account. Please try again." },
      { status: 500 }
    );
  }
}
