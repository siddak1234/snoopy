import Link from "next/link";
import IndustrySignals from "@/components/IndustrySignals";
import TypingHeadline from "@/components/home/TypingHeadline";
import ValueCard from "@/components/home/ValueCard";
import { AutonomousIcon, ScalableIcon, SecureIcon } from "@/components/icons/valueIcons";

const automationExamples = [
  "Invoice and receipt processing",
  "Patient intake and documentation",
  "Expense classification and GL coding",
  "Document extraction and routing",
  "Multi-step approval workflows",
  "Compliance checks and audit prep",
];

const howItWorks = [
  {
    step: "1",
    title: "Ingest",
    description:
      "Connect your documents, emails, forms, and existing systems. We pull in the data your teams already work with.",
  },
  {
    step: "2",
    title: "Understand",
    description:
      "AI reads each item, extracts the relevant fields — dates, amounts, codes, intent — and structures it for review.",
  },
  {
    step: "3",
    title: "Route",
    description:
      "The right items reach the right people or systems automatically. Human review stays wherever your policies require it.",
  },
  {
    step: "4",
    title: "Track",
    description:
      "Every workflow has a clear status. See what's queued, what's resolved, and where bottlenecks are forming.",
  },
];

const valueCards = [
  {
    title: "Secure",
    description:
      "Every workflow runs with validation checkpoints, audit trails, and controlled approvals. Your data stays governed and your processes stay predictable.",
    icon: <SecureIcon />,
  },
  {
    title: "Scalable",
    description:
      "Handle ten requests a week or ten thousand a day on the same workflow. Scale operations without scaling headcount or rebuilding your process.",
    icon: <ScalableIcon />,
  },
  {
    title: "Autonomous",
    description:
      "Workflows read documents, extract what matters, and route to the right team or system. Your people handle exceptions — the rest runs automatically.",
    icon: <AutonomousIcon />,
  },
];

export default function Home() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Brand pill */}
      <div className="flex justify-center pt-2 pb-2">
        <div className="w-fit rounded-full border border-[var(--ring)] bg-[var(--surface)]/90 px-6 py-2.5 text-sm font-medium tracking-[0.3em] text-[var(--muted)] shadow-lg backdrop-blur">
          AUTOM8X
        </div>
      </div>

      {/* Hero */}
      <section className="bubble p-6 sm:p-8 lg:p-10">
        <TypingHeadline />
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
          Autom8x turns manual, document-heavy operations into structured
          workflows that run on their own. Invoice handling, intake routing,
          approval chains, compliance checks — automated by AI, reviewed by
          your team.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/solutions" className="btn-primary px-5">
            See How It Works
          </Link>
          <Link href="/contact" className="btn-secondary px-5">
            Talk to Our Team
          </Link>
        </div>
      </section>

      {/* What you can automate */}
      <section className="bubble p-6 sm:p-8">
        <h2 className="text-xl font-semibold sm:text-2xl">
          What teams automate with Autom8x
        </h2>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {automationExamples.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)]"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--bullet)]"
                aria-hidden
              />
              {item}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          These are starting points.{" "}
          <Link
            href="/solutions"
            className="font-semibold text-[var(--link)] underline underline-offset-4"
          >
            See solutions by industry
          </Link>
        </p>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((item) => (
            <article key={item.step} className="bubble flex flex-col p-5 sm:p-6">
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

      {/* Why Autom8x */}
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Why teams choose Autom8x
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {valueCards.map((card) => (
            <ValueCard key={card.title} title={card.title} description={card.description} icon={card.icon} />
          ))}
        </div>
      </section>

      {/* Industry signals — credibility element */}
      <IndustrySignals />

      {/* Final CTA */}
      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">
          Ready to automate a workflow?
        </h2>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Tell us about one manual process that slows your team down.
          We&rsquo;ll show you what an automated version looks like.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Start a Conversation
        </Link>
      </section>
    </div>
  );
}
