import Link from "next/link";

const solutions = [
  {
    title: "Intake and Triage",
    bullets: [
      "Normalize requests from email, forms, and shared inboxes.",
      "Auto-tag urgency, team, and policy category.",
      "Route to the correct queue with full context.",
    ],
  },
  {
    title: "Document Intelligence",
    bullets: [
      "Capture fields from PDFs and operational documents.",
      "Flag missing or low-confidence values before handoff.",
      "Output consistent JSON schemas for downstream systems.",
    ],
  },
  {
    title: "System Actions",
    bullets: [
      "Trigger updates in CRM, ticketing, and internal tools.",
      "Apply approval gates for sensitive actions.",
      "Track execution status and exceptions in one view.",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Solutions</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Practical GenAI workflows designed to reduce manual work, increase consistency, and support daily operational decisions.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Solution categories</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {solutions.map((solution) => (
            <article key={solution.title} className="bubble p-5 sm:p-6">
              <h3 className="text-xl font-semibold">{solution.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
                {solution.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4e8fe6]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">Discuss your workflow priorities</h2>
        <p className="mt-3 text-[var(--muted)]">
          We can map your process and identify the fastest path to production impact.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Go to Contact
        </Link>
      </section>
    </div>
  );
}
