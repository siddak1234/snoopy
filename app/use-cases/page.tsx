import Link from "next/link";

const useCases = [
  { slug: "healthcare-documentation", category: "Healthcare", title: "From Documentation Burden to Intelligent Care Delivery", date: "2026-03-05", dateLabel: "March 5, 2026" },
  { slug: "performance-intelligence", category: "Human Resources & Governance", title: "From Performance Reviews to Performance Intelligence", date: "2026-02-22", dateLabel: "February 22, 2026" },
  { slug: "contracts-financial-truth", category: "Finance & Legal", title: "From Contracts to Financial Truth", date: "2026-02-08", dateLabel: "February 8, 2026" },
];

const useCasesByDate = [...useCases].sort((a, b) => b.date.localeCompare(a.date));

export default function UseCasesPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Use Cases</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          Explore how Autom8x applies AI and automation to specific workflows and business problems—from document processing and intake to billing, compliance, and operations.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Use cases</h2>
        <div className="flex flex-col gap-4">
          {useCasesByDate.map((study) => (
            <Link
              key={study.slug}
              href={`/use-cases/${study.slug}`}
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
