import { prisma } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";

/**
 * Server-only: list projects for a user (ordered by created desc).
 * Caller must pass the authenticated user id; never accept user_id from client.
 */
export async function getProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Server-only: create a project for the given user.
 * Caller must pass the authenticated user id.
 */
export async function createProject(
  userId: string,
  data: { name: string; description?: string | null; status?: ProjectStatus }
) {
  return prisma.project.create({
    data: {
      userId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: data.status ?? "active",
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });
}
