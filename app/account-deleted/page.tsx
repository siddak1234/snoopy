import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-semibold sm:text-3xl">Account deleted</h1>
          <p className="mt-4 text-[var(--muted)]">
            Sorry to see you go. Your account and data have been permanently removed.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            You can sign up again anytime if you change your mind.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary inline-flex px-5">
              Sign up
            </Link>
            <Link href="/login" className="btn-secondary inline-flex px-5">
              Log in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
