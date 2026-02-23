"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const solutionsItems = [
  { href: "/solutions/healthcare", label: "Healthcare" },
  { href: "/solutions/finance", label: "Finance" },
];

const linkClass =
  "block rounded-xl px-4 py-3 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset";

export default function MobileNavMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [solutionsExpanded, setSolutionsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
      >
        <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        {menuOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {menuOpen ? (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-label="Main navigation"
          className="absolute right-0 top-full z-50 mt-2 min-w-[16rem] max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto rounded-2xl border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[0_12px_24px_rgba(12,24,40,0.14)] [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]"
        >
          <nav className="flex flex-col gap-0.5 py-1">
            <Link href="/" className={linkClass} onClick={closeMenu}>
              Home
            </Link>

            <div>
              <button
                type="button"
                onClick={() => setSolutionsExpanded((prev) => !prev)}
                aria-expanded={solutionsExpanded}
                className={`${linkClass} w-full text-left`}
              >
                <span className="flex items-center justify-between">
                  Solutions
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className={`h-4 w-4 transition ${solutionsExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" />
                  </svg>
                </span>
              </button>
              {solutionsExpanded ? (
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l-2 border-[var(--ring)] pl-3">
                  {solutionsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg py-2.5 pl-1 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
                      onClick={closeMenu}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <Link href="/automation-builder" className={linkClass} onClick={closeMenu}>
              Automation Builder
            </Link>
            <Link href="/contact" className={linkClass} onClick={closeMenu}>
              Contact
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset"
              onClick={closeMenu}
            >
              Login / Signup
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
