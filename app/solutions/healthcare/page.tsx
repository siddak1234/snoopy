import Link from "next/link";

const painPoints = [
  {
    title: "Administrative burden",
    description:
      "Staff spend hours on repetitive data entry, form-filling, and chasing information across systems instead of focusing on patient-facing and high-value work.",
  },
  {
    title: "Document overload",
    description:
      "PDFs, faxes, scanned forms, and emails pile up. Extracting and routing the right information to the right place still depends on manual review and re-keying.",
  },
  {
    title: "Disconnected workflows",
    description:
      "Intake, authorization, billing, and records live in different tools. Moving data between them creates delays, errors, and visibility gaps.",
  },
  {
    title: "Slow processing & exceptions",
    description:
      "Backlogs grow when every exception or edge case needs a human to read, decide, and act. Speed and consistency suffer without structured automation.",
  },
];

const useCases = [
  {
    title: "Patient intake and registration",
    description:
      "Automate capture and validation of patient information from forms, portals, and documents. Route completed packets for review and reduce manual data entry into your EHR or practice management system.",
  },
  {
    title: "Prior authorization support",
    description:
      "Ingest authorization requests and supporting documentation, extract key clinical and payer criteria, and structure data for staff review and submission—reducing turnaround time and manual lookups.",
  },
  {
    title: "Claims and billing documentation",
    description:
      "Process encounter notes, superbills, and supporting documentation. Extract and validate codes and data for billing workflows while keeping human review in the loop for accuracy and compliance.",
  },
  {
    title: "Medical records processing",
    description:
      "Handle requests for records, release forms, and external documentation. Classify, summarize, and route records for review and fulfillment with consistent audit trails.",
  },
  {
    title: "Referral and order management",
    description:
      "Ingest referrals and orders from multiple channels, parse requirements and patient details, and route to the right team with structured data—reducing delays and lost or incomplete referrals.",
  },
  {
    title: "Back-office and internal operations",
    description:
      "Automate internal workflows: vendor and credentialing documents, policy acknowledgments, internal reporting, and cross-team handoffs that today rely on email and spreadsheets.",
  },
];

const howItWorksSteps = [
  {
    step: "1",
    title: "Ingest",
    description: "Connect PDFs, forms, email, spreadsheets, and systems. We pull in the documents and data your teams work with every day.",
  },
  {
    step: "2",
    title: "Understand",
    description: "AI extracts and structures information—dates, codes, entities, and intent—so it can be validated and used downstream without manual re-entry.",
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
          Reduce administrative burden and automate document-heavy processes—so your teams spend less time on repetitive manual work and more on what requires human judgment and care.
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Autom8x combines AI and automation to structure unstructured workflows across PDFs, forms, email, and systems. Built for intake, authorization, billing support, records, referrals, and back-office operations—with human-in-the-loop control where it matters.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary px-5">
            Book a demo
          </Link>
          <Link
            href="/solutions/use-cases/healthcare-documentation"
            className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
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
          Healthcare runs on documents and data that are often unstructured: PDFs, scanned forms, faxes, emails, and spreadsheets. Moving that information into the right systems and workflows has traditionally required manual reading, re-keying, and routing—which slows processing, creates backlogs, and makes it hard to see where work stands.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Autom8x uses AI to understand and structure this content, then automation to route it and track it. The result is fewer manual touchpoints, faster turnaround, consistent handling of high-volume work, and clear visibility into operational flow. We focus on administrative and operational workflows—intake, authorization, billing support, records, referrals, and back-office—with human review built in where your policies and risk tolerance require it.
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
          See how Autom8x can structure your document-heavy workflows and scale your operations without scaling headcount. We’ll walk you through a tailored view of your use case.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary px-5">
            Get in touch
          </Link>
          <Link
            href="/solutions"
            className="rounded-full border border-[var(--ring)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          >
            Explore all solutions
          </Link>
        </div>
      </section>
    </div>
  );
}
