import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { normalizeInviteCode } from "@/lib/invite-utils";

// Re-export so callers can keep a single import
export { normalizeInviteCode } from "@/lib/invite-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/L/0/1
const BCRYPT_ROUNDS = 10;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateWorkspaceInviteResult =
  | { ok: true; id: string; token: string; code: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Create a new single-use invite for an organization workspace.
 * Only the workspace OWNER may call this.
 */
export async function createWorkspaceInvite(
  workspaceId: string,
  ownerId: string
): Promise<CreateWorkspaceInviteResult> {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: ownerId, workspaceId } },
    select: { role: true, workspace: { select: { type: true } } },
  });

  if (!membership || membership.role !== "OWNER") {
    return { ok: false, error: "Not authorised to create invites for this workspace." };
  }
  if (membership.workspace.type !== "organization") {
    return { ok: false, error: "Invites are only available for organization workspaces." };
  }

  const code = generateInviteCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const created = await prisma.workspaceInvite.create({
    data: { workspaceId, createdBy: ownerId, token, codeHash, expiresAt },
    select: { id: true },
  });

  return { ok: true, id: created.id, token, code, expiresAt };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Load an invite by token for display (public — no auth required). */
export async function getWorkspaceInviteByToken(token: string) {
  if (!token) return null;
  return prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { id: true, name: true } },
    },
  });
}

/** List pending (not accepted, not revoked, not expired) invites for a workspace. */
export async function listPendingWorkspaceInvites(workspaceId: string, ownerId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: ownerId, workspaceId } },
    select: { role: true },
  });
  if (!membership || membership.role !== "OWNER") return [];

  const now = new Date();
  return prisma.workspaceInvite.findMany({
    where: {
      workspaceId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

export type AcceptWorkspaceInviteResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

/**
 * Validate token + code and add the user to the workspace as a member.
 * Burns the invite (single-use) on success.
 * If the user is already a member, succeeds without duplicating.
 */
export async function validateAndAcceptWorkspaceInvite(
  token: string,
  rawCode: string,
  userId: string
): Promise<AcceptWorkspaceInviteResult> {
  if (!token || !rawCode || !userId) {
    return { ok: false, error: "Invalid request." };
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      workspaceId: true,
      codeHash: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.revokedAt) return { ok: false, error: "This invite has been revoked." };
  if (invite.acceptedAt) return { ok: false, error: "This invite has already been used." };
  if (invite.expiresAt < new Date()) return { ok: false, error: "This invite has expired." };

  const normalizedCode = normalizeInviteCode(rawCode);
  const codeMatch = await bcrypt.compare(normalizedCode, invite.codeHash);
  if (!codeMatch) return { ok: false, error: "Invalid invite code." };

  // Burn the invite and upsert the membership in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedBy: userId },
    });

    await tx.membership.upsert({
      where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
      create: { userId, workspaceId: invite.workspaceId, role: "MEMBER" },
      update: {}, // already a member — no-op
    });
  });

  return { ok: true, workspaceId: invite.workspaceId };
}

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

export type RevokeWorkspaceInviteResult = { ok: true } | { ok: false; error: string };

/**
 * Soft-revoke a pending invite. Only the workspace OWNER may do this.
 */
export async function revokeWorkspaceInvite(
  inviteId: string,
  ownerId: string
): Promise<RevokeWorkspaceInviteResult> {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
    select: { workspaceId: true, acceptedAt: true, revokedAt: true },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.revokedAt) return { ok: false, error: "Invite already revoked." };
  if (invite.acceptedAt) return { ok: false, error: "Invite already accepted." };

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: ownerId, workspaceId: invite.workspaceId } },
    select: { role: true },
  });
  if (!membership || membership.role !== "OWNER") {
    return { ok: false, error: "Not authorised." };
  }

  await prisma.workspaceInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}
