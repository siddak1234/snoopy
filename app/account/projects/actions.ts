"use server";

import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { createProject as createProjectDb } from "@/lib/projects";
import { revalidatePath } from "next/cache";

const NAME_MIN = 2;
const NAME_MAX = 60;

export type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function createProjectAction(formData: FormData): Promise<CreateProjectResult> {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in to create a project." };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Project name is required." };
  }
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) {
    return { ok: false, error: `Name must be at least ${NAME_MIN} characters.` };
  }
  if (trimmed.length > NAME_MAX) {
    return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` };
  }

  const description = formData.get("description");
  const descriptionStr =
    typeof description === "string" && description.trim() ? description.trim() : null;

  try {
    const project = await createProjectDb(session.user.id, {
      name: trimmed,
      description: descriptionStr,
    });
    revalidatePath("/account");
    revalidatePath("/account/projects");
    return { ok: true, projectId: project.id };
  } catch (e) {
    console.error("createProjectAction", e);
    return { ok: false, error: "Failed to create project. Please try again." };
  }
}
