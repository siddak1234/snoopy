"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]";

export default function LoginPage() {
  const [status, setStatus] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("Auth coming soon.");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">Login</h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="user-id" className="block text-sm font-medium text-[var(--text)]">
                User ID
              </label>
              <input
                id="user-id"
                type="text"
                name="userId"
                autoComplete="username"
                placeholder="Enter your user ID"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className={inputClassName}
              />
            </div>

            <button type="submit" className="btn-primary w-full px-5">
              Log In
            </button>

            {status ? (
              <p className="text-center text-sm text-[var(--muted)]" role="status">
                {status}
              </p>
            ) : null}
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ring)] pt-5">
            <span className="text-sm text-[var(--muted)]">New here?</span>
            <Link
              href="/signup"
              className="btn-secondary inline-flex px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            >
              Sign Up
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
