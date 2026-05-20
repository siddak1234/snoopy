"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { revalidateAccountProjectsAction } from "@/app/account/projects/actions";
import type { ProjectScope, ProjectType } from "@/lib/project-types";

type Props = {
  usedTypesByScope?: Record<ProjectScope, ProjectType[]>;
  hasOrg?: boolean;
};

export function CreateProjectButton({ usedTypesByScope, hasOrg }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = async () => {
    await revalidateAccountProjectsAction();
    router.refresh();
  };

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
        onSuccess={handleSuccess}
        usedTypesByScope={usedTypesByScope}
        hasOrg={hasOrg}
      />
    </>
  );
}
