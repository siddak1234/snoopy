import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import AuthNavLinks from "@/components/navigation/AuthNavLinks";
import MobileNavMenu from "@/components/navigation/MobileNavMenu";
import SolutionsDropdown from "@/components/navigation/SolutionsDropdown";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SessionProvider from "@/components/providers/SessionProvider";
import LogoFull from "@/components/branding/LogoFull";
import LogoMark from "@/components/branding/LogoMark";
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
        <SessionProvider>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-6 sm:px-6 lg:px-8">
          <header className="bubble-soft sticky top-3 z-50 mt-3 px-4 py-3 sm:px-5">
            <div className="flex w-full items-center gap-4 sm:gap-6">
              {/* Left: brand — full logo on desktop, mark only on mobile */}
              <div className="flex shrink-0 items-center">
                <div className="hidden md:block">
                  <LogoFull width={60} height={24} />
                </div>
                <Link
                  href="/"
                  className="flex items-center md:hidden text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] rounded-full"
                  aria-label="Autom8x"
                >
                  <LogoMark width={48} height={19} />
                </Link>
              </div>

              {/* Center: main nav — evenly distributed */}
              <nav
                aria-label="Main navigation"
                className="hidden min-w-0 flex-1 md:flex md:justify-evenly md:gap-2"
              >
                {navLinks.slice(0, 1).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                  >
                    {link.label}
                  </Link>
                ))}
                <SolutionsDropdown />
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

              {/* Right: theme + mobile menu (mobile only) */}
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                <ThemeToggle />
                <MobileNavMenu />
              </div>
            </div>
          </header>

          <main className="flex-1 py-8 sm:py-10">{children}</main>

          <footer className="mt-4 py-6 text-center text-sm text-[var(--muted)]">
            <p>
              © {year} {site.name}. {site.tagline}
            </p>
          </footer>
        </div>
        </SessionProvider>
      </body>
    </html>
  );
}
