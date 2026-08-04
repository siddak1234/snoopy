import Link from "next/link";
import { footerColumns } from "@/lib/nav";
import { site } from "@/lib/site";

/** The design's four-column footer: brand + Product / Company / Write to us. */
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 border-t border-[var(--color-divider)] py-11 text-[13px] leading-6 text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="m-0 text-[15px] font-[var(--font-heading)] text-[var(--color-text)]">
            {site.name}
          </p>
          <p className="mt-2 max-w-[32ch]">
            Automation multiplied by AI. Any repetitive task, automated.
          </p>
          <p className="mt-3">
            © {year} {site.name}. {site.legalEntity}
          </p>
        </div>
        {footerColumns.map((column) => (
          <nav
            key={column.heading}
            aria-label={column.heading}
            className="flex flex-col gap-1.5"
          >
            <span className="text-[11px] tracking-[0.14em] text-[var(--color-neutral-400)] uppercase">
              {column.heading}
            </span>
            {column.links.map((link) =>
              link.href.startsWith("mailto:") ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-inherit transition hover:text-[var(--color-accent)]"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-inherit transition hover:text-[var(--color-accent)]"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
    </footer>
  );
}
