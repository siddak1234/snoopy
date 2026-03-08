import Link from "next/link";

export default function UseCasesPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <Link
          href="/solutions"
          className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          ← Solutions
        </Link>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Use Cases</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Explore how Autom8x applies AI and automation to specific workflows and business problems—from document processing and intake to billing, compliance, and operations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/solutions/use-cases" className="btn-primary px-5">
            View case studies
          </Link>
          <Link href="/contact" className="btn-secondary px-5">
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
