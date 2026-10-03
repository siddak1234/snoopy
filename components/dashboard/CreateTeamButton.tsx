"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateTeamDialog, type TeamWorkspace } from "./CreateTeamDialog";
import { revalidateAccountTeamsAction } from "@/app/account/teams/actions";

export function CreateTeamButton({ workspace }: { workspace: TeamWorkspace }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex px-5"
      >
        Create a team
      </button>
      <CreateTeamDialog
        open={open}
        onClose={() => setOpen(false)}
        workspace={workspace}
        onSuccess={async (projectId) => {
          await revalidateAccountTeamsAction();
          // Straight to its page, where people are added.
          router.push(`/account/teams/${projectId}`);
        }}
      />
    </>
  );
}
