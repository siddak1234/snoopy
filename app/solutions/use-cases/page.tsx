import Link from "next/link";

export default function UseCasesSolutionsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Use Cases</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          Explore automation use cases tailored to your workflows.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Example use cases</h2>
        <Link
          href="/solutions/use-cases/legal-billing-compliance"
          className="bubble group block p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-8"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Accounting & Legal
          </span>
          <h3 className="mt-2 text-xl font-semibold text-[var(--text)] sm:text-2xl">
            Reducing Revenue Leakage in Legal Billing Through Automation
          </h3>
          <time dateTime="2026-02-25" className="mt-2 block text-sm text-[var(--muted)]">
            February 25, 2026
          </time>
        </Link>
      </section>
    </div>
  );
}
