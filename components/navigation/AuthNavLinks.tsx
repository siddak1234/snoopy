"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppSession } from "@/hooks/use-app-session";

const pillClass =
  "rounded-full px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]";
const pillBorderClass =
  "rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]";

export default function AuthNavLinks() {
  const { data: session, status } = useAppSession();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (status === "loading") {
    return (
      <span className={pillBorderClass} aria-hidden>
        …
      </span>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/account" className={pillBorderClass}>
          Account
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className={pillClass}
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link href="/login" className={pillBorderClass}>
      Login / Signup
    </Link>
  );
}
