import { prisma } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";

/**
 * Server-only: list projects for a user (ordered by created desc).
 * Includes owner (user) for display. Caller must pass the authenticated user id.
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
      user: { select: { name: true } },
    },
  });
}

/**
 * Server-only: delete a project in the database. Only deletes if project belongs to the given user.
 * Returns true if a row was deleted, false otherwise (e.g. not found or not owner).
 */
export async function deleteProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const result = await prisma.project.deleteMany({
    where: { id: projectId, userId },
  });
  return result.count > 0;
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
