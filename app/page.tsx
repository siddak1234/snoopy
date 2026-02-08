import Link from "next/link";
import { site } from "@/lib/site";

const workflowCards = [
  {
    title: "Inbox → Routing",
    description:
      "Classify incoming requests and route each item to the right team with clear priority and ownership.",
  },
  {
    title: "Documents → JSON",
    description:
      "Extract key fields from contracts, forms, and policies into structured data your team can trust.",
  },
  {
    title: "JSON → Systems",
    description:
      "Push validated outputs into ticketing, CRM, and internal tools with controlled approval steps.",
  },
];

export default function Home() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8 lg:p-10">
        <p className="mb-3 inline-flex rounded-full bg-[#e7f1ff] px-3 py-1 text-xs font-semibold tracking-wide text-[#21549c]">
          GenAI Automation Workflows
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Build reliable AI workflows for modern operations teams.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
          {site.name} designs practical systems that turn everyday inputs into consistent outputs, so teams move faster without adding manual overhead.
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
          Start with one high-impact workflow and expand from there with measurable outcomes.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Start a Conversation
        </Link>
      </section>
    </div>
  );
}
