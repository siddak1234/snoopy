import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-semibold sm:text-3xl">Check your inbox</h1>
          <p className="mt-4 text-[var(--muted)]">
            We sent you a verification email. Click the link in that email to confirm your account.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            You can close this page after verifying. Then sign in with your email and password.
          </p>
          <Link
            href="/login"
            className="btn-primary mt-6 inline-flex px-5"
          >
            Go to Login
          </Link>
        </section>
      </div>
    </div>
  );
}
