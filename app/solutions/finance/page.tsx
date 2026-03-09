import Link from "next/link";

const painPoints = [
  {
    title: "Manual invoice and document handling",
    description:
      "High volume still means manual entry, re-keying into ERPs, and chasing approvals across email and spreadsheets.",
  },
  {
    title: "Fragmented approvals and routing",
    description:
      "Multi-step workflows span systems and people; delays and visibility gaps when work moves between tools.",
  },
  {
    title: "Repetitive data entry and coding",
    description:
      "Expense categorization, GL coding, and vendor matching consume time and introduce inconsistency at scale.",
  },
  {
    title: "Exception-heavy back-office volume",
    description:
      "Non-standard docs and one-off cases create backlogs; every exception needs human review.",
  },
];

const useCases = [
  {
    title: "Invoice processing automation",
    description:
      "Ingest from email, portals, and scans; extract line items and vendor data; route for validation and posting.",
  },
  {
    title: "Expense and receipt classification",
    description:
      "Process at scale with GL suggestions and policy rules; route for approval with audit trails.",
  },
  {
    title: "AP intake and routing",
    description:
      "Centralize intake; parse and validate docs, match to POs where applicable; route to the right approvers.",
  },
  {
    title: "Financial document extraction",
    description:
      "Extract structured data from PDFs and scans so downstream systems get clean data without re-keying.",
  },
  {
    title: "Exception handling workflows",
    description:
      "Route exceptions to the right reviewers with context; standardize triage and resolution with full traceability.",
  },
  {
    title: "Approval workflow automation",
    description:
      "Orchestrate multi-step approvals across thresholds and systems; human-in-the-loop where required.",
  },
  {
    title: "Audit support and traceable history",
    description:
      "Audit-ready process with clear lineage from source to posting; consistent workflow history for compliance.",
  },
  {
    title: "Reconciliation and matching support",
    description:
      "Structure data from statements and feeds so teams focus on exceptions and judgment, not manual prep.",
  },
];

const outcomes = [
  "Reduce manual processing time",
  "Improve consistency across workflows",
  "Accelerate approvals and document turnaround",
  "Increase visibility into back-office operations",
  "Scale finance operations without scaling headcount",
  "Improve downstream data readiness",
];

const howItWorksSteps = [
  {
    step: "1",
    title: "Ingest",
    description: "Connect invoices, receipts, spreadsheets, and systems. We pull in the docs your teams use daily.",
  },
  {
    step: "2",
    title: "Understand",
    description: "AI extracts amounts, dates, vendors, and line items for validation without re-entry.",
  },
  {
    step: "3",
    title: "Route",
    description: "Send the right items to the right people or systems. Human review where you need it.",
  },
  {
    step: "4",
    title: "Track",
    description: "Visibility into status and bottlenecks. See what’s in progress and where to focus.",
  },
];

export default function FinanceSolutionsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <section className="bubble p-6 sm:p-8 lg:p-10">
        <Link
          href="/solutions"
          className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          ← Solutions
        </Link>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Finance & Accounting
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
          AI-powered workflows for finance and accounting operations
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-7 text-[var(--muted)] sm:text-xl">
          Automate document-heavy back-office work so teams focus on analysis, control, and scale.
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
          AI + automation for AP, expenses, controllership, and shared services—human-in-the-loop and audit-ready.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary px-5">
            Book a demo
          </Link>
          <Link href="/solutions/use-cases/expense-classification" className="btn-secondary px-5">
            Read case study
          </Link>
        </div>
      </section>

      {/* Pain points / industry challenges */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Where Autom8x fits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {painPoints.map((item) => (
            <article
              key={item.title}
              className="bubble p-5 sm:p-6"
            >
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Finance use cases */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Finance & Accounting use cases we support
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <article
              key={useCase.title}
              className="bubble p-5 sm:p-6"
            >
              <h3 className="text-base font-semibold text-[var(--text)] sm:text-lg">
                {useCase.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {useCase.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Why Autom8x / How we help */}
      <section className="bubble p-6 sm:p-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Why AI + automation matters for finance operations
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Unstructured docs slow processing and create backlogs. Autom8x structures content with AI, then routes and tracks it—operational workflow automation, not chat AI. Fewer touchpoints, faster turnaround, full visibility. Human review and audit-ready process where you need it.
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {["Operational control", "End-to-end visibility", "Faster processing", "Audit-ready workflows"].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--bullet)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Outcomes / value */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Outcomes and value
        </h2>
        <div className="flex flex-wrap gap-3">
          {outcomes.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--bullet)]" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorksSteps.map((item) => (
            <article
              key={item.step}
              className="bubble flex flex-col p-5 sm:p-6"
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] text-sm font-semibold text-[var(--step-pill-text)]"
                aria-hidden
              >
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bubble-soft p-6 sm:p-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Ready to streamline finance operations?
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
          Scale finance operations without scaling headcount. We’ll walk you through a tailored view of your use case.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary px-5">
            Get in touch
          </Link>
          <Link href="/solutions" className="btn-secondary px-5">
            Explore all solutions
          </Link>
        </div>
      </section>
    </div>
  );
}
