"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/branding/LogoMark";
import ThemeToggle from "@/components/theme/ThemeToggle";

/**
 * Slim top bar for the account shell (the marketing header no longer wraps
 * the dashboard since the route-group split).
 */
export function AccountTopBar() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
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
