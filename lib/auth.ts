/**
 * Ensure user has a default workspace (create if none). Returns workspaceId.
 * Idempotent: re-fetches first membership after create to handle concurrent logins.
 * Exported for use by lib/tenant (workspace-as-org) and lib/auth-supabase.
 */
export async function ensureDefaultWorkspaceForUser(userId: string): Promise<string> {
  const { prisma } = await import("@/lib/db");

  const first = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (first) return first.workspaceId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) throw new Error("User not found");

  const workspaceName =
    user.name?.trim()
      ? `${user.name.trim()}'s Workspace`
      : user.email?.trim()
        ? `${user.email.trim()}'s Workspace`
        : "My Workspace";

  try {
    const workspaceId = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: workspaceName },
      });
      await tx.membership.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });
      return workspace.id;
    });
    console.log("ENSURE_WORKSPACE_OK", { userId, workspaceId });
    return workspaceId;
  } catch (error) {
    console.error("ENSURE_WORKSPACE_FAIL", {
      userId,
      message: (error as Error).message,
    });
    const after = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });
    if (after) return after.workspaceId;
    throw new Error("Failed to ensure default workspace");
  }
}
