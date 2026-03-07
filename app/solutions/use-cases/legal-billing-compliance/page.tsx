import Link from "next/link";

export default function LegalBillingComplianceUseCasePage() {
  return (
    <article className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <Link
          href="/solutions/use-cases"
          className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          ← Use Cases
        </Link>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Accounting & Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
          Improving Revenue Realization in Legal Billing Through Automated Billing Compliance
        </h1>
        <time dateTime="2026-02-25" className="mt-2 block text-sm text-[var(--muted)]">
          February 25, 2026
        </time>
      </section>

      <section className="bubble p-6 sm:p-8">
        <div className="prose prose-invert max-w-none">
          <p className="text-[var(--muted)]">
            Add your use case document content here. This page is a static blog-style post for the legal billing compliance use case.
          </p>
        </div>
      </section>
    </article>
  );
}
