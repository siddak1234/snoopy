import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { validateEnv } from "@/lib/env";

let validated = false;

function ensureEnv() {
  if (!validated) {
    validateEnv();
    validated = true;
  }
}

/**
 * Shared NextAuth config. Use in the API route and in getServerSession().
 * Validates required env on first use (production only).
 */
export function getAuthOptions(): NextAuthOptions {
  ensureEnv();

  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}
