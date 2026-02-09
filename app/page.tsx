import Link from "next/link";
import { site } from "@/lib/site";

const workflowCards = [
  {
    title: "Inbox → Routing",
    description:
      "Automatically triage incoming requests and route every task to the right owner with clear priority.",
  },
  {
    title: "Documents → JSON",
    description:
      "Convert unstructured business documents into reliable, structured outputs for downstream workflows.",
  },
  {
    title: "JSON → Systems",
    description:
      "Trigger updates across your systems with approvals and controls aligned to your operating model.",
  },
];

export default function Home() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8 lg:p-10">
        <p className="mb-3 inline-flex rounded-full bg-[#e7f1ff] px-3 py-1 text-xs font-semibold tracking-wide text-[#21549c]">
          Automation With AI Workflows
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Automate manual business tasks with AI workflows.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
          {site.name} builds practical automation workflows that reduce repetitive effort, improve consistency, and adapt to your industry operational needs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/solutions" className="btn-primary px-5">
            Explore Solutions
          </Link>
          <Link href="/contact" className="btn-secondary px-5">
            Contact Us
          </Link>
        </div>
      </section>

      <section>
        <h2 className="sr-only">Core workflow patterns</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflowCards.map((card) => (
            <article key={card.title} className="bubble p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-[var(--text)]">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">Ready to streamline operations?</h2>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Start with one business-critical process, then expand to tailored AI workflows across teams.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Start a Conversation
        </Link>
      </section>
    </div>
  );
}
