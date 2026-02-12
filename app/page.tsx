import Link from "next/link";
import IndustrySignals from "@/components/IndustrySignals";
import ProcessStepsSection from "@/components/home/ProcessStepsSection";
import ValueCard from "@/components/home/ValueCard";
import { AutonomousIcon, ScalableIcon, SecureIcon } from "@/components/icons/valueIcons";
import { site } from "@/lib/site";

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
      <section className="bubble p-6 sm:p-8 lg:p-10">
        <p className="mb-3 inline-flex rounded-full bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--chip-text)]">
          Automation With AI Workflows
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Automate repetitive tasks with AI workflows
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

      <IndustrySignals />

      <section>
        <ProcessStepsSection />
      </section>

      <section>
        <h2 className="sr-only">Platform value propositions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {valueCards.map((card) => (
            <ValueCard key={card.title} title={card.title} description={card.description} icon={card.icon} />
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
