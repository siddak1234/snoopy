"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const dashboardNavItems = [
  { href: "/account", label: "Home" },
  { href: "/account/flows", label: "Flows" },
  { href: "/account/connections", label: "Connections" },
  { href: "/account/runs", label: "Activity" },
  { href: "/account/approvals", label: "Approvals" },
  { href: "/account/teams", label: "Teams" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/settings", label: "Settings" },
  { href: "/account/support", label: "Support" },
] as const;

const navLinkClass =
  "block rounded-xl px-4 py-3 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-inset";

/**
 * The Organization link shows only where its page renders: for an
 * organization's owners and admins (register F55). Teams is for everyone — a
 * person's own workspace holds teams too (BUILD-PLAN 24.11.11).
 */
type OrganizationLinks = { showOrgSettings?: boolean };

function NavLinks({
  currentPath,
  showOrgSettings,
  onNavigate,
}: OrganizationLinks & {
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
            prefetch={false}
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

      {showOrgSettings ? (
        <Link
          prefetch={false}
          href="/account/organization"
          onClick={onNavigate}
          className={`${navLinkClass} ${
            currentPath.startsWith("/account/organization")
              ? "bg-[var(--surface-hover)] font-medium"
              : ""
          }`}
          aria-current={
            currentPath.startsWith("/account/organization") ? "page" : undefined
          }
        >
          Organization
        </Link>
      ) : null}
    </>
  );
}

export function DashboardSidebar({ showOrgSettings }: OrganizationLinks) {
  const pathname = usePathname();
  return (
    <aside
      className="hidden w-64 shrink-0 lg:block"
      aria-label="Dashboard navigation"
    >
      <nav className="bubble-soft flex flex-col gap-0.5 p-4">
        <NavLinks
          currentPath={pathname ?? ""}
          showOrgSettings={showOrgSettings}
        />
      </nav>
    </aside>
  );
}

// Every page's title for the small-screen header (register F56: four pages
// read "Dashboard").
const pathToTitle: Record<string, string> = {
  "/account": "Dashboard",
  "/account/flows": "Flows",
  "/account/connections": "Connections",
  "/account/runs": "Activity",
  "/account/approvals": "Approvals",
  "/account/teams": "Teams",
  "/account/billing": "Billing",
  "/account/settings": "Settings",
  "/account/support": "Support",
  "/account/organization": "Organization",
};

function getPageTitle(pathname: string): string {
  // Detail pages: /account/runs/[runId], /account/teams/[id]
  if (pathname.startsWith("/account/runs/")) return "Run";
  if (pathname.startsWith("/account/teams/")) return "Team";
  return pathToTitle[pathname] ?? "Dashboard";
}

export function DashboardHeader({ showOrgSettings }: OrganizationLinks) {
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
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--card)] text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
        >
          {menuOpen ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
        <span className="text-lg font-semibold text-[var(--text)]">
          {title}
        </span>
      </div>
      {menuOpen ? (
        <div
          id="dashboard-mobile-nav"
          role="dialog"
          aria-label="Dashboard navigation"
          className="absolute top-full left-0 z-50 mt-2 min-w-[14rem] rounded-[var(--radius-lg)] border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]"
        >
          <nav className="flex flex-col gap-0.5 py-1">
            <NavLinks
              currentPath={pathname ?? ""}
              showOrgSettings={showOrgSettings}
              onNavigate={() => setMenuOpen(false)}
            />
          </nav>
        </div>
      ) : null}
    </div>
  );
}
