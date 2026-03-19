import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import OAuthFragmentRedirect from "@/components/auth/OAuthFragmentRedirect";
import AuthNavLinks from "@/components/navigation/AuthNavLinks";
import MobileNavMenu from "@/components/navigation/MobileNavMenu";
import InsightsDropdown from "@/components/navigation/InsightsDropdown";
import SolutionsDropdown from "@/components/navigation/SolutionsDropdown";
import ThemeToggle from "@/components/theme/ThemeToggle";
import LogoMark from "@/components/branding/LogoMark";
import MotionProvider from "@/components/motion/MotionProvider";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.tagline,
  icons: {
    icon: "/favicon.svg",
  },
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/automation-builder", label: "Automation Builder" },
  { href: "/contact", label: "Contact" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body
        className={`${inter.className} min-h-screen antialiased`}
      >
        <MotionProvider>
          <OAuthFragmentRedirect />
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-6 sm:px-6 lg:px-8">
            <header className="bubble-soft sticky top-3 z-50 mt-3 px-4 py-3 sm:px-5">
              <div className="flex min-h-12 w-full items-center gap-4 sm:gap-6">
                {/* Left: brand — A8X logo mark only */}
                <Link
                  href="/"
                  className="flex min-h-12 flex-shrink-0 items-center justify-center text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] rounded-full"
                  aria-label="Autom8x"
                >
                  <LogoMark width={48} height={24} />
                </Link>

                {/* Center: main nav — evenly distributed */}
                <nav
                  aria-label="Main navigation"
                  className="hidden min-w-0 flex-1 md:flex md:justify-evenly md:gap-2"
                >
                  <Link
                    href={navLinks[0].href}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                  >
                    {navLinks[0].label}
                  </Link>
                  <SolutionsDropdown />
                  <InsightsDropdown />
                  {navLinks.slice(1).map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                {/* Right: account + theme (desktop) */}
                <div className="hidden shrink-0 items-center gap-2 md:flex">
                  <AuthNavLinks />
                  <ThemeToggle />
                </div>

                {/* Right: theme + mobile menu (mobile only) — pinned to far right */}
                <div className="ml-auto flex min-h-12 shrink-0 items-center gap-2 md:ml-0 md:hidden">
                  <ThemeToggle />
                  <MobileNavMenu />
                </div>
              </div>
            </header>

            <main className="flex-1 py-8 sm:py-10">{children}</main>

            <footer className="mt-4 py-6 text-center text-sm text-[var(--muted)]">
              <nav
                aria-label="Footer navigation"
                className="mb-3 flex flex-wrap justify-center gap-x-6 gap-y-1"
              >
                <Link
                  href="/solutions"
                  className="transition hover:text-[var(--text)]"
                >
                  Solutions
                </Link>
                <Link
                  href="/insights"
                  className="transition hover:text-[var(--text)]"
                >
                  Insights
                </Link>
                <Link
                  href="/automation-builder"
                  className="transition hover:text-[var(--text)]"
                >
                  Builder
                </Link>
                <Link
                  href="/contact"
                  className="transition hover:text-[var(--text)]"
                >
                  Contact
                </Link>
              </nav>
              <p>
                &copy; {year} {site.name}. {site.legalEntity}
              </p>
            </footer>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
