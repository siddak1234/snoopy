"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JoinProjectDialog } from "./JoinProjectDialog";

export function JoinProjectButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary inline-flex px-5"
      >
        Join team project
      </button>
      <JoinProjectDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
