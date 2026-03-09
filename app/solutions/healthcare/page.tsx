import Link from "next/link";

const painPoints = [
  {
    title: "Administrative burden",
    description:
      "Hours lost to data entry, form-filling, and chasing information instead of patient-facing work.",
  },
  {
    title: "Document overload",
    description:
      "PDFs, faxes, and emails pile up; extraction and routing still depend on manual review.",
  },
  {
    title: "Disconnected workflows",
    description:
      "Intake, auth, billing, and records live in different tools—delays and visibility gaps follow.",
  },
  {
    title: "Slow processing & exceptions",
    description:
      "Every exception needs a human; backlogs grow and consistency suffers without automation.",
  },
];

const useCases = [
  {
    title: "Patient intake and registration",
    description:
      "Capture and validate patient data from forms and documents; route to EHR with less manual entry.",
  },
  {
    title: "Prior authorization support",
    description:
      "Ingest auth requests and docs; extract clinical and payer criteria for faster review and submission.",
  },
  {
    title: "Claims and billing documentation",
    description:
      "Process notes and superbills; extract and validate codes for billing with human review in the loop.",
  },
  {
    title: "Medical records processing",
    description:
      "Classify, summarize, and route records and release forms with consistent audit trails.",
  },
  {
    title: "Referral and order management",
    description:
      "Ingest referrals from multiple channels; parse and route to the right team with structured data.",
  },
  {
    title: "Back-office and internal operations",
    description:
      "Automate vendor docs, policy acknowledgments, and cross-team handoffs beyond email and spreadsheets.",
  },
];

const howItWorksSteps = [
  {
    step: "1",
    title: "Ingest",
    description: "Connect PDFs, forms, email, and systems. We pull in the documents your teams use daily.",
  },
  {
    step: "2",
    title: "Understand",
    description: "AI extracts and structures dates, codes, and intent for validation without re-entry.",
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

export default function HealthcareSolutionsPage() {
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
          Healthcare
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
          AI-powered workflows for healthcare operations
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-7 text-[var(--muted)] sm:text-xl">
          Reduce administrative burden and automate document-heavy processes so teams focus on high-value work.
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
          AI + automation for intake, authorization, billing, records, and back-office—with human-in-the-loop control.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary px-5">
            Book a demo
          </Link>
          <Link href="/solutions/use-cases/healthcare-documentation" className="btn-secondary px-5">
            Read case study
          </Link>
        </div>
      </section>

      {/* What we help automate */}
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

      {/* Main use cases */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Healthcare use cases we support
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

      {/* Why Autom8x */}
      <section className="bubble p-6 sm:p-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Why AI + automation matters for healthcare operations
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Unstructured docs and data slow processing and create backlogs. Autom8x structures content with AI, then routes and tracks it—fewer touchpoints, faster turnaround, full visibility. Human review stays where your policies require it.
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {["Operational control", "End-to-end visibility", "Faster processing", "Scalable workflows"].map((item) => (
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
          Ready to reduce administrative burden?
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
          Scale operations without scaling headcount. We’ll walk you through a tailored view of your use case.
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
