import Link from "next/link";
import IndustrySignals from "@/components/IndustrySignals";
import TypingHeadline from "@/components/home/TypingHeadline";
import ValueCard from "@/components/home/ValueCard";
import { AutonomousIcon, ScalableIcon, SecureIcon } from "@/components/icons/valueIcons";

const howItWorks = [
  {
    step: "1",
    title: "Ingest",
    description:
      "Connect your documents, forms, emails, and existing tools. We pull in the data your teams already work with.",
  },
  {
    step: "2",
    title: "Understand",
    description:
      "AI extracts and structures key information — dates, amounts, intent — ready for validation without re-entry.",
  },
  {
    step: "3",
    title: "Route",
    description:
      "Send the right items to the right people or systems automatically. Human review stays where you need it.",
  },
  {
    step: "4",
    title: "Track",
    description:
      "Full visibility into status and bottlenecks. See what's in progress, what's resolved, and where to focus.",
  },
];

const valueCards = [
  {
    title: "Secure",
    description:
      "Enterprise-grade data handling with validation, auditability, and controlled workflow approvals. Your business processes run safely and predictably.",
    icon: <SecureIcon />,
  },
  {
    title: "Scalable",
    description:
      "Automations designed to grow with your operations — from a few requests per week to thousands per day without rewriting your process.",
    icon: <ScalableIcon />,
  },
  {
    title: "Autonomous",
    description:
      "Systems understand incoming information and trigger the correct actions automatically, reducing manual work and operational overhead.",
    icon: <AutonomousIcon />,
  },
];

export default function Home() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Brand pill — home only, above hero */}
      <div className="flex justify-center pt-2 pb-2">
        <div className="w-fit rounded-full border border-[var(--ring)] bg-[var(--surface)]/90 px-6 py-2.5 text-sm font-medium tracking-[0.3em] text-[var(--muted)] shadow-lg backdrop-blur">
          AUTOM8X
        </div>
      </div>

      <section className="bubble p-6 sm:p-8 lg:p-10">
        <TypingHeadline />
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
          We build AI-powered workflow automations that replace repetitive manual
          tasks — from document processing to multi-step approvals — so your
          teams can focus on higher-value work.
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

      <IndustrySignals />

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

      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">
          Ready to automate your workflows?
        </h2>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Tell us about one manual process that slows your team down.
          We&rsquo;ll show you how to automate it.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Schedule a Consultation
        </Link>
      </section>
    </div>
  );
}
