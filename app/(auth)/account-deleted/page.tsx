import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function AccountDeletedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="bubble p-6 text-center sm:p-8">
          <h1 className="text-2xl font-medium sm:text-3xl">Account deleted</h1>
          <p className="mt-4 text-[var(--muted)]">
            Sorry to see you go. Your account, your personal workspace and every
            organization you alone owned have been deleted. Our{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>{" "}
            says what deletion does not remove.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            You can come back anytime with a new account.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/login">Continue to Autom8x</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
