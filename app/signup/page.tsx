"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, FormEvent } from "react";

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]";

export default function SignupPage() {
  const [status, setStatus] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("Email signup coming soon — you can sign up instantly with Google below.");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">Sign Up</h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-[var(--text)]">
                Full Name
              </label>
              <input
                id="full-name"
                type="text"
                name="fullName"
                autoComplete="name"
                placeholder="Enter your full name"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email"
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
                autoComplete="new-password"
                placeholder="Choose a password"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--text)]">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={inputClassName}
              />
            </div>

            <button type="submit" className="btn-primary w-full px-5">
              Create Account
            </button>

            {status ? (
              <p className="text-center text-sm text-[var(--muted)]" role="status">
                {status}
              </p>
            ) : null}
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-[var(--ring)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--surface)] px-3 text-sm text-[var(--muted)]">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/account" })}
            className="w-full rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Sign up with Google
          </button>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ring)] pt-5">
            <span className="text-sm text-[var(--muted)]">Already have an account?</span>
            <Link
              href="/login"
              className="btn-secondary inline-flex px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            >
              Log in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
