import type { ReactNode } from "react";

/** Shared shell for the legal pages: a section heading plus measured body copy. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="m-0 text-[20px] font-medium tracking-[-0.01em]">
        {heading}
      </h2>
      <div className="mt-3 flex max-w-[70ch] flex-col gap-3 text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_72%,transparent)]">
        {children}
      </div>
    </section>
  );
}

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <a
      href={href}
      className="text-[var(--color-accent-300)] underline underline-offset-2 transition hover:text-[var(--color-accent)]"
    >
      {children}
    </a>
  );
}
