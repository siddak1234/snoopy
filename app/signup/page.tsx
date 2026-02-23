import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">Sign Up</h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            Create an account to get started. Registration will be available soon.
          </p>
          <Link
            href="/login"
            className="btn-primary mt-6 inline-block px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            Back to Login
          </Link>
        </section>
      </div>
    </div>
  );
}
