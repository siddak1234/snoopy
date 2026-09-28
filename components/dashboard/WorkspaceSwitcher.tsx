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
 *
 * Keyboard (backend §12.1 #170): opening moves focus to the current workspace,
 * the arrow keys and Home/End move among the options, and Escape or a selection
 * returns focus to the trigger — a keyboard user never lands on `<body>`.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Opening puts focus on the workspace in use, so the arrow keys start there.
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const current =
      menu?.querySelector<HTMLButtonElement>(
        'button[data-workspace-option][aria-current="true"]',
      ) ??
      menu?.querySelector<HTMLButtonElement>("button[data-workspace-option]");
    current?.focus();
  }, [open]);

  if (workspaces.length < 2) return null;

  const active = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-workspace-option]",
      ) ?? [],
    );
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    options[next]?.focus();
  }

  async function handleSelect(workspaceId: string) {
    if (pending) return;
    if (workspaceId === activeWorkspaceId) {
      close();
      return;
    }
    setPending(true);
    setError(null);
    const result = await selectActiveWorkspaceAction(workspaceId);
    setPending(false);
    if (result.ok) {
      close();
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Switch workspace"
        aria-expanded={open}
        aria-controls="workspace-switcher-menu"
        className="flex h-10 max-w-[14rem] items-center gap-1.5 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
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
          ref={menuRef}
          id="workspace-switcher-menu"
          onKeyDown={onMenuKeyDown}
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
                  data-workspace-option
                  // aria-disabled, not disabled: a disabled button loses focus,
                  // and a switch that fails would leave the keyboard on <body>.
                  aria-disabled={pending || undefined}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => void handleSelect(workspace.id)}
                  className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition aria-disabled:opacity-60 ${isActive ? "bg-[var(--card)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}
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
