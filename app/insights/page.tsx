import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Case studies and use cases showing how Autom8x applies AI workflow automation to real business operations.",
};

const sections = [
  {
    href: "/solutions/use-cases",
    title: "Case Studies",
    description:
      "Detailed analyses of how AI workflow automation applies to specific industries and operational challenges. Each study breaks down the problem, the automated workflow, and the measurable outcome.",
    count: "2 published",
  },
  {
    href: "/use-cases",
    title: "Use Cases",
    description:
      "Practical examples of the workflows Autom8x automates — from healthcare documentation to financial operations. Organized by industry and function.",
    count: "3 published",
  },
];

export default function InsightsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Insights</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Research, case studies, and practical examples of AI workflow
          automation applied to real business operations.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Browse by category</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="bubble group flex flex-col justify-between gap-6 p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-8"
            >
              <div>
                <h3 className="text-2xl font-semibold text-[var(--text)]">
                  {section.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
                  {section.description}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  {section.count}
                </span>
                <span
                  className="inline-flex text-[var(--muted)] transition group-hover:text-[var(--accent-strong)] group-hover:translate-x-1"
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">
          Have a workflow you want to explore?
        </h2>
        <p className="mt-3 text-[var(--muted)]">
          Tell us about a manual process in your organization and we&rsquo;ll
          show you what an automated version looks like.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Get in Touch
        </Link>
      </section>
    </div>
  );
}
