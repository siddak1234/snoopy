"use client";

import { useState } from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";

export function CreateProjectButton() {
  const [open, setOpen] = useState(false);

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
        onSuccess={() => setOpen(false)}
      />
    </>
  );
}
