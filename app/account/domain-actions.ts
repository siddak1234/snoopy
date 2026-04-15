"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/auth-supabase";
import { sendEmail, buildDomainVerificationEmail } from "@/lib/mailer";

const VERIFY_BASE_URL = "https://www.autom8x.ai/verify-domain";
const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;  // 72 hours
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX = 3;

export type ResendVerificationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Resend a domain verification email for the current user's organization workspace.
 *
 * Guards:
 * - User must be authenticated
 * - Workspace must be type "organization" and not yet verified
 * - User must be OWNER of that workspace
 * - Max RATE_LIMIT_MAX emails per workspace in the last 24 hours
 *
 * On success: deletes any existing unused tokens for this workspace (so old links
 * stop working), creates a fresh token, and sends the email.
 */
export async function resendDomainVerificationAction(): Promise<ResendVerificationResult> {
  const session = await getAppSession();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, error: "Not authenticated." };
  }

  const { id: userId, email, workspaceId } = session.user;
  if (!workspaceId) {
    return { ok: false, error: "No workspace found." };
  }

  // Verify user is OWNER and workspace is an unverified org
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: {
      role: true,
      workspace: {
        select: {
          name: true,
          type: true,
          domain: true,
          domainVerified: true,
        },
      },
    },
  });

  if (!membership || membership.role !== "OWNER") {
    return { ok: false, error: "You must be the workspace owner to resend verification." };
  }

  const ws = membership.workspace;

  if (ws.type !== "organization") {
    return { ok: false, error: "Domain verification is only available for organization workspaces." };
  }

  if (ws.domainVerified) {
    return { ok: false, error: "This domain is already verified." };
  }

  if (!ws.domain) {
    return { ok: false, error: "No domain is associated with this workspace." };
  }

  // Rate limit: count tokens created for this workspace in the last 24 hours
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await prisma.domainVerificationToken.count({
    where: {
      workspaceId,
      createdAt: { gt: windowStart },
    },
  });

  if (recentCount >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      error: `Too many verification emails sent. Please try again after 24 hours.`,
    };
  }

  // Delete existing unused tokens so old links are invalidated
  await prisma.domainVerificationToken.deleteMany({
    where: { workspaceId, usedAt: null },
  });

  // Create a fresh token
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.domainVerificationToken.create({
    data: { workspaceId, token, expiresAt },
  });

  // Send the email
  const verifyUrl = `${VERIFY_BASE_URL}/${token}`;
  const { subject, html } = buildDomainVerificationEmail(ws.name, ws.domain, verifyUrl);
  await sendEmail(email, subject, html);

  return { ok: true };
}
