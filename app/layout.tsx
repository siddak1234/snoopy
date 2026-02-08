import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.tagline,
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/solutions", label: "Solutions" },
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
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-6 sm:px-6 lg:px-8">
          <header className="bubble-soft sticky top-3 z-50 mt-3 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#b7d2ff] bg-[#dcebff] text-sm font-bold text-[#245196]">
                  {site.name.slice(0, 1)}
                </span>
                <span>{site.name}</span>
              </Link>
              <nav aria-label="Main navigation" className="flex items-center gap-2 text-sm font-medium sm:gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-4 py-2 text-[var(--text)] transition hover:bg-[#e8f2ff]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="flex-1 py-8 sm:py-10">{children}</main>

          <footer className="mt-4 py-6 text-center text-sm text-[var(--muted)]">
            <p>
              © {year} {site.name}. {site.tagline}
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
