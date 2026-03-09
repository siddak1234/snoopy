import Link from "next/link";

const painPoints = [
  {
    title: "Manual invoice and document handling",
    description:
      "High volume of invoices, receipts, and financial documents still requires manual data entry, re-keying into ERPs, and chasing down approvals across email and spreadsheets.",
  },
  {
    title: "Fragmented approvals and routing",
    description:
      "Multi-step approval workflows span systems and people. Delays and visibility gaps appear when work moves between tools, geographies, or departments.",
  },
  {
    title: "Repetitive data entry and coding",
    description:
      "Expense categorization, GL coding, and vendor matching consume time and introduce inconsistency when done manually at scale across locations or entities.",
  },
  {
    title: "Exception-heavy back-office volume",
    description:
      "Non-standard documents, mismatched line items, and one-off cases create backlogs. Every exception needs human review, slowing turnaround and increasing risk.",
  },
];

const useCases = [
  {
    title: "Invoice processing automation",
    description:
      "Ingest invoices from email, portals, and scans. Extract line items, amounts, and vendor data with AI, then route for validation and posting—reducing manual entry and speeding cycle time.",
  },
  {
    title: "Expense and receipt classification",
    description:
      "Process expense reports and receipts at scale. Classify and suggest GL codes, enforce policy rules, and route for approval with consistent audit trails and fewer manual touchpoints.",
  },
  {
    title: "AP intake and routing",
    description:
      "Centralize AP intake from multiple channels. Parse and validate document types, match to POs or contracts where applicable, and route to the right approvers or systems with clear status visibility.",
  },
  {
    title: "Financial document extraction",
    description:
      "Extract structured data from PDFs, spreadsheets, and scanned packets—invoices, statements, contracts—so downstream systems and reviewers get clean, validated data without re-keying.",
  },
  {
    title: "Exception handling workflows",
    description:
      "Route exceptions and edge cases to the right reviewers with context. Standardize how discrepancies, duplicates, and non-standard items are triaged and resolved while keeping full traceability.",
  },
  {
    title: "Approval workflow automation",
    description:
      "Orchestrate multi-step approvals across thresholds, delegations, and systems. Keep workflows configurable, human-in-the-loop where required, and visible so bottlenecks are easy to spot.",
  },
  {
    title: "Audit support and traceable history",
    description:
      "Maintain audit-ready process standardization with clear lineage from source document to posting. Support compliance and controllership with consistent, traceable workflow history.",
  },
  {
    title: "Reconciliation and matching support",
    description:
      "Support reconciliation and matching workflows by structuring data from statements, ledgers, and external feeds so finance teams can focus on exceptions and judgment instead of manual prep.",
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
    description: "Connect invoices, receipts, spreadsheets, email, and systems. We pull in the documents and data your finance teams work with every day.",
  },
  {
    step: "2",
    title: "Understand",
    description: "AI extracts and structures information—amounts, dates, vendors, line items, and intent—so it can be validated and used downstream without manual re-entry.",
  },
  {
    step: "3",
    title: "Route",
    description: "Workflows send the right items to the right people or systems. Rules and exceptions are configurable; human review stays where you need it.",
  },
  {
    step: "4",
    title: "Track",
    description: "Visibility into status, bottlenecks, and throughput. Know what’s in progress, what’s stuck, and where to focus capacity.",
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
          Automate document-heavy back-office work—invoices, expenses, approvals, and extraction—so your teams spend less time on repetitive manual work and more on analysis, control, and scale.
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Autom8x combines AI and automation to structure unstructured financial workflows across PDFs, email, spreadsheets, and systems. Built for AP, expense management, controllership, and shared services—with human-in-the-loop control and audit-ready process standardization.
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
          Finance and accounting run on documents and data that are often unstructured: invoices, receipts, spreadsheets, and emails. Moving that information into the right systems and workflows has traditionally required manual reading, re-keying, and routing—which slows processing, creates backlogs, and makes it hard to see where work stands.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Autom8x uses AI to understand and structure this content, then automation to route it and track it. This is not generic chat AI—it’s operational workflow automation: orchestration, AI-assisted extraction, human-in-the-loop review, and process standardization. The result is fewer manual touchpoints, faster turnaround, consistent handling of high-volume work, and clear visibility into operational flow.
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
          See how Autom8x can structure your document-heavy workflows and scale your finance operations without scaling headcount. We’ll walk you through a tailored view of your use case.
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
