"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutFromPlatform } from "@/lib/platform-api";
import { useAppSession } from "@/hooks/use-app-session";
import { useEffect, useRef, useState } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { marketingNav } from "@/lib/nav";

const linkClass =
  "block rounded-[var(--radius-md)] px-4 py-3 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset";

const pillClass =
  "rounded-[var(--radius-md)] border border-[var(--ring)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-inset";

/** Mobile marketing menu — flat links from lib/nav.ts plus the auth pair. */
export default function MobileNavMenu() {
  const router = useRouter();
  const { data: session, status } = useAppSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div ref={containerRef} className="relative flex md:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-controls="mobile-nav-panel"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ring)] text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
      >
        <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        {menuOpen ? (
          <XIcon size={20} aria-hidden />
        ) : (
          <ListIcon size={20} aria-hidden />
        )}
      </button>

      {menuOpen ? (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-label="Main navigation"
          className="absolute top-full right-0 z-50 mt-2 max-h-[min(28rem,calc(100vh-6rem))] min-w-[16rem] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]"
        >
          <nav className="flex flex-col gap-0.5 py-1">
            <Link href="/" className={linkClass} onClick={closeMenu}>
              Home
            </Link>
            {marketingNav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={linkClass}
                onClick={closeMenu}
              >
                {label}
              </Link>
            ))}
            {status === "loading" ? (
              <span className={`${pillClass} text-[var(--muted)]`}>…</span>
            ) : session?.user ? (
              <>
                <Link href="/account" className={pillClass} onClick={closeMenu}>
                  Account
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    closeMenu();
                    await signOutFromPlatform();
                    router.replace("/");
                    router.refresh();
                  }}
                  className={`${linkClass} w-full text-center`}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="btn-primary mt-0.5 w-full"
                onClick={closeMenu}
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
