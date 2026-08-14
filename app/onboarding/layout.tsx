import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { listWorkspaces } from "@/lib/tenancy";
import LogoMark from "@/components/branding/LogoMark";
import ThemeToggle from "@/components/theme/ThemeToggle";

/**
 * Onboarding layout — two guards:
 *
 * 1. Auth guard: unauthenticated users are sent to /login.
 *    (Middleware already does this, but we double-check here because the layout
 *    needs the userId anyway.)
 *
 * 2. Workspace guard: if the user already has a Membership row they have
 *    completed onboarding (or were a pre-existing user). Send them to /account
 *    so they never see onboarding pages again — including via browser back-button.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  if (!session?.user.id) redirect("/login");
  // Only redirect if the user already has an org workspace — a pre-existing
  // personal workspace must not block org creation/joining.
  const existing = (await listWorkspaces()).some(
    (workspace) => workspace.type === "organization",
  );

  if (existing) redirect("/account");

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Autom8x home"
          className="flex items-center rounded-full text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
        >
          <LogoMark height={22} />
        </Link>
        <ThemeToggle />
      </header>
      {children}
    </div>
  );
}
