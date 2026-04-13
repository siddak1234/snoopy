import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { canUserPerform } from "@/lib/project-rbac";
import { normalizeInviteCode } from "@/lib/invite-utils";

// Re-export so server-only callers can keep a single import
export { normalizeInviteCode } from "@/lib/invite-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/L/0/1
const BCRYPT_ROUNDS = 10;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

export type CreateInviteResult =
  | { ok: true; token: string; code: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Create a new single-use invite for a project.
 * Only the project owner may call this (project:create_invite).
 */
export async function createInvite(
  projectId: string,
  createdBy: string
): Promise<CreateInviteResult> {
  const allowed = await canUserPerform(createdBy, projectId, "project:create_invite");
  if (!allowed) return { ok: false, error: "Not authorised to create invites for this project." };

  const code = generateInviteCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.projectInvite.create({
    data: { projectId, createdBy, token, codeHash, expiresAt },
  });

  return { ok: true, token, code, expiresAt };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Load an invite by token for display (public — no auth required). */
export async function getInviteByToken(token: string) {
  if (!token) return null;
  return prisma.projectInvite.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      project: { select: { id: true, name: true, ownerName: true } },
    },
  });
}

/** List pending (not accepted, not revoked, not expired) invites for a project. */
export async function listPendingInvites(projectId: string, requestedBy: string) {
  const allowed = await canUserPerform(requestedBy, projectId, "project:view_members");
  if (!allowed) return [];

  const now = new Date();
  return prisma.projectInvite.findMany({
    where: {
      projectId,
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

export type AcceptInviteResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

/**
 * Validate token + code and add the user to the project as a member.
 * Burns the invite (single-use) on success.
 */
export async function acceptInvite(
  token: string,
  rawCode: string,
  userId: string
): Promise<AcceptInviteResult> {
  if (!token || !rawCode || !userId) {
    return { ok: false, error: "Invalid request." };
  }

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    select: {
      id: true,
      projectId: true,
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

  // Burn the invite and create the membership in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.projectInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedBy: userId },
    });

    await tx.projectMembership.upsert({
      where: { projectId_userId: { projectId: invite.projectId, userId } },
      create: { projectId: invite.projectId, userId, role: "member" },
      update: {}, // already a member — no-op
    });
  });

  return { ok: true, projectId: invite.projectId };
}

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

export type RevokeInviteResult = { ok: true } | { ok: false; error: string };

/**
 * Soft-revoke a pending invite. Only the project owner may do this.
 */
export async function revokeInvite(
  inviteId: string,
  requestedBy: string
): Promise<RevokeInviteResult> {
  const invite = await prisma.projectInvite.findUnique({
    where: { id: inviteId },
    select: { projectId: true, acceptedAt: true, revokedAt: true },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.revokedAt) return { ok: false, error: "Invite already revoked." };
  if (invite.acceptedAt) return { ok: false, error: "Invite already accepted." };

  const allowed = await canUserPerform(
    requestedBy,
    invite.projectId,
    "project:revoke_invite"
  );
  if (!allowed) return { ok: false, error: "Not authorised." };

  await prisma.projectInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}
