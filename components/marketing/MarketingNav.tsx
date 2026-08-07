"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutFromPlatform } from "@/lib/platform-api";
import { useAppSession } from "@/hooks/use-app-session";
import { useHydrated } from "@/hooks/use-hydrated";
import { marketingNav } from "@/lib/nav";
import { Button } from "@/components/ui/Button";
import LogoMark from "@/components/branding/LogoMark";
import ThemeToggle from "@/components/theme/ThemeToggle";
import MobileNavMenu from "@/components/navigation/MobileNavMenu";

/**
 * The design's marketing header: sticky blurred bar with the mark, flat
 * Solutions / Builder / Contact links, theme toggle, and the auth pair
 * (Log in + Sign up, swapping to Account + Sign out with a session).
 */
export function MarketingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useHydrated();
  const { data: session, status } = useAppSession();

  async function handleSignOut() {
    await signOutFromPlatform();
    router.replace("/");
    router.refresh();
  }

  const sessionArea =
    !mounted || status === "loading" ? (
      <span
        className="hidden text-sm text-[var(--color-neutral-300)] md:inline"
        aria-hidden
      >
        …
      </span>
    ) : session?.user ? (
      <>
        <button
          type="button"
          onClick={handleSignOut}
          className="hidden text-sm text-[var(--color-neutral-300)] transition hover:text-[var(--color-accent)] md:inline"
        >
          Sign out
        </button>
        <Button
          href="/account"
          variant="primary"
          size="sm"
          className="hidden md:inline-flex"
        >
          Account
        </Button>
      </>
    ) : (
      <>
        <Link
          href="/login"
          className="hidden text-sm text-[var(--color-neutral-300)] transition hover:text-[var(--color-accent)] md:inline"
        >
          Log in
        </Link>
        <Button
          href="/signup"
          variant="primary"
          size="sm"
          className="hidden md:inline-flex"
        >
          Sign up
        </Button>
      </>
    );

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-[60] bg-[color-mix(in_srgb,var(--color-bg)_78%,transparent)] backdrop-blur-[10px]"
    >
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Autom8x home"
          className="mr-auto flex items-center rounded-full text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
        >
          <LogoMark height={22} />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {marketingNav.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`text-sm transition hover:text-[var(--color-accent)] ${
                  isActive
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <ThemeToggle />
        {sessionArea}

        <div className="md:hidden">
          <MobileNavMenu />
        </div>
      </div>
    </nav>
  );
}
