import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 text-center sm:p-8">
          <h1 className="text-2xl font-medium sm:text-3xl">Account deleted</h1>
          <p className="mt-4 text-[var(--muted)]">
            Sorry to see you go. Your account and data have been permanently
            removed.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            You can come back anytime — your first sign-in creates a new
            account.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary inline-flex px-5">
              Continue to Autom8x
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
