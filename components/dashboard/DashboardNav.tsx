"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const dashboardNavItems = [
  { href: "/account", label: "Home" },
  { href: "/account/projects", label: "Projects" },
  { href: "/account/workflow-design", label: "Workflow Design" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/settings", label: "Settings" },
  { href: "/account/support", label: "Support" },
] as const;

const navLinkClass =
  "block rounded-xl px-4 py-3 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset";

function NavLinks({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {dashboardNavItems.map(({ href, label }) => {
        const isActive =
          href === "/account"
            ? currentPath === "/account"
            : currentPath.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`${navLinkClass} ${isActive ? "bg-[var(--surface-hover)] font-medium" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="hidden w-64 shrink-0 lg:block"
      aria-label="Dashboard navigation"
    >
      <nav className="flex flex-col gap-0.5 rounded-2xl border border-[var(--ring)] bg-[var(--surface)]/95 p-4 shadow-lg backdrop-blur [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]">
        <NavLinks currentPath={pathname ?? ""} />
      </nav>
    </aside>
  );
}

const pathToTitle: Record<string, string> = {
  "/account": "Dashboard",
  "/account/projects": "Projects",
  "/account/workflow-design": "Workflow Design",
  "/account/billing": "Billing",
  "/account/settings": "Settings",
  "/account/support": "Support",
};

function getPageTitle(pathname: string): string {
  return pathToTitle[pathname] ?? "Dashboard";
}

export function DashboardHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const title = getPageTitle(pathname ?? "/account");

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

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-controls="dashboard-mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
        >
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
        <span className="text-lg font-semibold text-[var(--text)]">{title}</span>
      </div>
      {menuOpen ? (
        <div
          id="dashboard-mobile-nav"
          role="dialog"
          aria-label="Dashboard navigation"
          className="absolute left-0 top-full z-50 mt-2 min-w-[14rem] rounded-2xl border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[0_12px_24px_rgba(12,24,40,0.14)] [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]"
        >
          <nav className="flex flex-col gap-0.5 py-1">
            <NavLinks currentPath={pathname ?? ""} onNavigate={() => setMenuOpen(false)} />
          </nav>
        </div>
      ) : null}
    </div>
  );
}
