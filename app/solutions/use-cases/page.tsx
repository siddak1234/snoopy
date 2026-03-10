import Link from "next/link";

const caseStudies = [
  { slug: "expense-classification", category: "Finance & Accounting", title: "Transforming Expense Classification Through AI-Driven Automation", date: "2026-03-01", dateLabel: "March 1, 2026" },
  { slug: "legal-billing-compliance", category: "Accounting & Legal", title: "Reducing Revenue Leakage in Legal Billing Through Automation", date: "2026-02-25", dateLabel: "February 25, 2026" },
];

/** Newest first; add new entries anywhere in caseStudies and they will sort by date. */
const caseStudiesByDate = [...caseStudies].sort((a, b) => b.date.localeCompare(a.date));

export default function CaseStudyPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Case Studies</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          Explore case studies on automation tailored to your workflows.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Case studies</h2>
        <div className="flex flex-col gap-4">
          {caseStudiesByDate.map((study) => (
            <Link
              key={study.slug}
              href={`/solutions/use-cases/${study.slug}`}
              className="bubble group flex flex-col gap-4 p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-8"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  {study.category}
                </span>
                <h3 className="mt-2 text-xl font-semibold text-[var(--text)] sm:text-2xl">
                  {study.title}
                </h3>
                <time dateTime={study.date} className="mt-2 block text-sm text-[var(--muted)]">
                  {study.dateLabel}
                </time>
              </div>
              <div className="flex shrink-0 items-center justify-end sm:pl-4">
                <span
                  className="inline-flex text-[var(--muted)] transition group-hover:text-[var(--accent-strong)] group-hover:scale-110"
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
