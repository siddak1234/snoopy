import Link from "next/link";
import LogoMark from "@/components/branding/LogoMark";
import ThemeToggle from "@/components/theme/ThemeToggle";

/** Narrow centered shell for login / signup / verification flows. */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="page-glow flex min-h-screen flex-col">
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
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
