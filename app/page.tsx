import Link from "next/link";
import IndustrySignals from "@/components/IndustrySignals";
import ProcessStepsSection from "@/components/home/ProcessStepsSection";
import TypingHeadline from "@/components/home/TypingHeadline";
import ValueCard from "@/components/home/ValueCard";
import { AutonomousIcon, ScalableIcon, SecureIcon } from "@/components/icons/valueIcons";

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
