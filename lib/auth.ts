import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { getRequiredAuthEnv, validateEnv } from "@/lib/env";

let validated = false;

function ensureEnv() {
  if (!validated) {
    validateEnv();
    validated = true;
  }
}

/**
 * Provision or update User by Google sub (or email fallback). Called only from jwt callback at request time.
 * No top-level prisma import to keep build safe.
 */
async function provisionUser(params: {
  sub: string | null;
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<{ id: string }> {
  const { prisma } = await import("@/lib/db");
  const { sub, email, name, image } = params;

  if (sub) {
    const bySub = await prisma.user.findUnique({ where: { googleSub: sub } });
    if (bySub) {
      await prisma.user.update({
        where: { id: bySub.id },
        data: { email, name: name ?? null, image: image ?? null },
      });
      return { id: bySub.id };
    }
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleSub: sub, name: name ?? null, image: image ?? null },
      });
      return { id: byEmail.id };
    }
    const created = await prisma.user.create({
      data: { email, googleSub: sub, name: name ?? null, image: image ?? null },
    });
    return { id: created.id };
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { name: name ?? null, image: image ?? null },
    });
    return { id: byEmail.id };
  }
  const created = await prisma.user.create({
    data: { email, name: name ?? null, image: image ?? null },
  });
  return { id: created.id };
}

/**
 * Ensure user has a default workspace (create if none). Returns workspaceId.
 * Idempotent: re-fetches first membership after create to handle concurrent logins.
 * No top-level prisma import; called only from jwt callback.
 */
async function ensureDefaultWorkspaceForUser(userId: string): Promise<string> {
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
    return await prisma.$transaction(async (tx) => {
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
  } catch {
    const after = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });
    if (after) return after.workspaceId;
    throw new Error("Failed to ensure default workspace");
  }
}

/**
 * Shared NextAuth config. Use in the API route and in getServerSession().
 * Provisions User on sign-in (upsert by googleSub or email); stores user.id in JWT and session.
 */
export function getAuthOptions(): NextAuthOptions {
  ensureEnv();
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getRequiredAuthEnv();

  return {
    providers: [
      GoogleProvider({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
      }),
    ],
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
      signIn: "/login",
    },
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account && profile && "email" in profile && profile.email) {
          const sub =
            account.provider === "google"
              ? (account.providerAccountId as string)
              : null;
          const { id } = await provisionUser({
            sub,
            email: profile.email,
            name: "name" in profile ? (profile.name as string | null) : null,
            image: "picture" in profile ? (profile.picture as string | null) : null,
          });
          (token as JWT).userId = id;
        }
        const userId = (token as JWT).userId;
        if (userId) {
          (token as JWT).workspaceId =
            await ensureDefaultWorkspaceForUser(userId);
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = (token as JWT).userId as string | undefined;
          session.user.workspaceId = (token as JWT).workspaceId as
            | string
            | undefined;
        }
        return session;
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}
