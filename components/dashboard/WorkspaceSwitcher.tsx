"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { selectActiveWorkspaceAction } from "@/app/account/actions";
import type { Workspace } from "@/lib/tenancy";

/**
 * Surfaces the session's workspaces and drives the public
 * PATCH /v1/session/active-workspace operation. The active workspace lives in
 * the backend session, so switching is a mutation plus a refresh — the client
 * keeps no workspace state of its own.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Workspace[];
  activeWorkspaceId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (workspaces.length < 2) return null;

  const active = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );

  async function handleSelect(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError(null);
    const result = await selectActiveWorkspaceAction(workspaceId);
    setPending(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Switch workspace"
        aria-expanded={open}
        aria-controls="workspace-switcher-menu"
        className="flex h-10 max-w-[14rem] items-center gap-1.5 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
      >
        <span className="truncate">{active?.name ?? "Workspace"}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 flex-shrink-0"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          id="workspace-switcher-menu"
          role="dialog"
          aria-label="Switch workspace"
          className="absolute top-full right-0 z-50 mt-2 min-w-[14rem] rounded-[var(--radius-lg)] border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]"
        >
          <div className="flex flex-col gap-0.5 py-1">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={pending}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => void handleSelect(workspace.id)}
                  className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition disabled:opacity-60 ${isActive ? "bg-[var(--card)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {workspace.name}
                    </span>
                    <span className="block text-xs text-[var(--muted)] capitalize">
                      {workspace.type}
                    </span>
                  </span>
                  {isActive ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4 flex-shrink-0"
                      aria-hidden
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-[var(--muted)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
