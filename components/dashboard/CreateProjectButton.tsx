"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateProjectDialog, type TeamWorkspace } from "./CreateProjectDialog";
import { revalidateAccountProjectsAction } from "@/app/account/projects/actions";

export function CreateProjectButton({
  teamWorkspace,
  inOrganization,
}: {
  teamWorkspace: TeamWorkspace | null;
  inOrganization: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex px-5"
      >
        Create project
      </button>
      <CreateProjectDialog
        open={open}
        onClose={() => setOpen(false)}
        teamWorkspace={teamWorkspace}
        inOrganization={inOrganization}
        onSuccess={async () => {
          await revalidateAccountProjectsAction();
          router.refresh();
        }}
      />
    </>
  );
}
