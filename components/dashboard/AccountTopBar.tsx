"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutFromPlatform } from "@/lib/platform-api";
import LogoMark from "@/components/branding/LogoMark";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import type { Workspace } from "@/lib/tenancy";

/**
 * Slim top bar for the account shell (the marketing header no longer wraps
 * the dashboard since the route-group split).
 */
export function AccountTopBar({
  workspaces = [],
  activeWorkspaceId,
}: {
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await signOutFromPlatform();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-16 items-center justify-between">
      <Link
        href="/"
        aria-label="Autom8x home"
        className="flex items-center rounded-full text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
      >
        <LogoMark height={22} />
      </Link>
      <div className="flex items-center gap-2">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
        <ThemeToggle />
        <button
          type="button"
          onClick={handleSignOut}
          className="btn-ghost btn-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
