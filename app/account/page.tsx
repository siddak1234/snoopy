"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function AccountPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <p className="text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <p className="text-[var(--muted)]">You are not signed in.</p>
          <Link href="/login" className="btn-primary mt-4 inline-block px-5">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const email = session.user.email ?? "—";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">Account</h1>
          <p className="mt-4 text-[var(--muted)]">
            Signed in as: <span className="font-medium text-[var(--text)]">{email}</span>
          </p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn-secondary mt-6 px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
