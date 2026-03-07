import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getRequiredAuthEnv, validateEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase";

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
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function provisionUser(params: {
  sub: string | null;
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<{ id: string }> {
  const { prisma } = await import("@/lib/db");
  const { sub, name, image } = params;
  const email = normalizeEmail(params.email);

  if (sub) {
    const bySub = await prisma.user.findUnique({ where: { googleSub: sub } });
    if (bySub) {
      await prisma.user.update({
        where: { id: bySub.id },
        data: { email, name: name ?? null, image: image ?? null },
      });
      return { id: bySub.id };
    }
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (byEmail) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { email, googleSub: sub, name: name ?? null, image: image ?? null },
      });
      return { id: byEmail.id };
    }
    const created = await prisma.user.create({
      data: { email, googleSub: sub, name: name ?? null, image: image ?? null },
    });
    return { id: created.id };
  }

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { email, name: name ?? null, image: image ?? null },
    });
    return { id: byEmail.id };
  }
  const created = await prisma.user.create({
    data: { email, name: name ?? null, image: image ?? null },
  });
  return { id: created.id };
}

/**
 * Provision or get User by email only (Supabase email/password auth). No Google sub.
 */
async function provisionUserFromEmail(email: string, name?: string | null): Promise<{ id: string }> {
  const { prisma } = await import("@/lib/db");
  const normalized = normalizeEmail(email);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (existing) {
    if (name != null && existing.name !== name) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: name || null },
      });
    }
    return { id: existing.id };
  }
  const created = await prisma.user.create({
    data: { email: normalized, name: name ?? null },
  });
  return { id: created.id };
}

/**
 * Find app user by email (case-insensitive). Used to link Supabase Auth to existing Google user.
 */
async function findUserByEmail(email: string): Promise<{ id: string; email: string; name: string | null } | null> {
  const { prisma } = await import("@/lib/db");
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  return user;
}

/**
 * Ensure user has a default workspace (create if none). Returns workspaceId.
 * Idempotent: re-fetches first membership after create to handle concurrent logins.
 * No top-level prisma import; called only from jwt callback.
 * Exported for use by lib/tenant (workspace-as-org).
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

/**
 * Shared NextAuth config. Use in the API route and in getServerSession().
 * Provisions User on sign-in (upsert by googleSub or email); stores user.id in JWT and session.
 */
export function getAuthOptions(): NextAuthOptions {
  ensureEnv();
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getRequiredAuthEnv();

  return {
    providers: [
      CredentialsProvider({
        id: "credentials",
        name: "Email and password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;
          const normalizedEmail = normalizeEmail(credentials.email);
          const password = credentials.password;

          const supabase = getSupabaseServerClient();
          let { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (error) {
            const existingAppUser = await findUserByEmail(normalizedEmail);
            if (existingAppUser) {
              const signUpResult = await supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: { data: { full_name: existingAppUser.name ?? undefined } },
              });
              if (signUpResult.error) {
                if (
                  signUpResult.error.code === "user_already_registered" ||
                  String(signUpResult.error.message).toLowerCase().includes("already registered")
                ) {
                  console.warn("AUTH_CREDENTIALS_FAIL", {
                    email: `${normalizedEmail.slice(0, 3)}***`,
                    reason: "auth user exists, wrong password",
                  });
                  return null;
                }
                console.warn("AUTH_LINK_SIGNUP_FAIL", {
                  email: `${normalizedEmail.slice(0, 3)}***`,
                  message: signUpResult.error.message,
                });
                return null;
              }
              const linkData = signUpResult.data;
              if (linkData.session) {
                const user = linkData.user;
                const name =
                  (user?.user_metadata?.full_name as string | null) ?? (user?.user_metadata?.name as string | null) ?? existingAppUser.name;
                console.log("AUTH_LINK_OK", { userId: existingAppUser.id, email: `${normalizedEmail.slice(0, 3)}***` });
                return {
                  id: existingAppUser.id,
                  email: normalizedEmail,
                  name: name ?? undefined,
                };
              }
              const signInAfterSignUp = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });
              if (signInAfterSignUp.error) {
                console.warn("AUTH_LINK_SIGNIN_AFTER_SIGNUP_FAIL", signInAfterSignUp.error.message);
                return null;
              }
              data = signInAfterSignUp.data;
              error = null;
            } else {
              console.warn("AUTH_CREDENTIALS_FAIL", {
                email: `${normalizedEmail.slice(0, 3)}***`,
                code: error.code,
                message: error.message,
              });
              return null;
            }
          }

          if (error || !data?.user) return null;

          const user = data.user;
          const email = user?.email ?? normalizedEmail;
          const name =
            (user?.user_metadata?.full_name as string | null) ?? (user?.user_metadata?.name as string | null) ?? null;

          try {
            const { id } = await provisionUserFromEmail(email, name);
            console.log("AUTH_CREDENTIALS_OK", { userId: id, email: `${email.slice(0, 3)}***` });
            return { id, email, name: name ?? undefined };
          } catch (err) {
            console.error("AUTH_CREDENTIALS_PROVISION_FAIL", (err as Error).message);
            return null;
          }
        },
      }),
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
      async jwt({ token, account, profile, user }) {
        if (account?.provider === "credentials" && user?.id) {
          (token as JWT).userId = user.id as string;
        }
        if (account && profile && "email" in profile && profile.email) {
          console.log("AUTH_JWT_CALLBACK", {
            provider: account.provider,
            hasEmail: Boolean(profile.email),
          });
          const sub =
            account.provider === "google"
              ? (account.providerAccountId as string)
              : null;
          try {
            const { id } = await provisionUser({
              sub,
              email: profile.email,
              name: "name" in profile ? (profile.name as string | null) : null,
              image: "picture" in profile
                ? (profile.picture as string | null)
                : null,
            });
            (token as JWT).userId = id;
            console.log("PROVISION_USER_OK", { userId: id });
          } catch (error) {
            console.error("PROVISION_USER_FAIL", {
              message: (error as Error).message,
            });
            throw error;
          }
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
