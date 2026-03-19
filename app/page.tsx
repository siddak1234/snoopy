import Link from "next/link";
import IndustrySignals from "@/components/IndustrySignals";
import RevealOnScroll from "@/components/home/RevealOnScroll";
import HeroSection from "@/components/home/HeroSection";
import HomeAnimatedSections from "@/components/home/HomeAnimatedSections";
import ValueCard from "@/components/home/ValueCard";
import { AutonomousIcon, ScalableIcon, SecureIcon } from "@/components/icons/valueIcons";

const valueCards = [
  {
    title: "Secure",
    description: "Audit-ready controls, approvals, and policy checks in every workflow.",
    icon: <SecureIcon />,
  },
  {
    title: "Scalable",
    description: "Run the same process at higher volume without adding manual work.",
    icon: <ScalableIcon />,
  },
  {
    title: "Autonomous",
    description: "Teams review exceptions while routine work moves automatically.",
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
      <HeroSection />

      <HomeAnimatedSections />

      {/* Industries */}
      <RevealOnScroll>
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Industries
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="interactive-card bubble p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Healthcare operations</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Intake, documentation, and follow-up workflows with clear controls.
            </p>
            <Link href="/solutions/healthcare" className="mt-4 inline-flex text-sm font-semibold text-[var(--link)] underline underline-offset-4">
              View healthcare solutions
            </Link>
          </article>
          <article className="interactive-card bubble p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Finance and accounting</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Invoice, expense, and approval workflows that reduce cycle time.
            </p>
            <Link href="/solutions/finance" className="mt-4 inline-flex text-sm font-semibold text-[var(--link)] underline underline-offset-4">
              View finance solutions
            </Link>
          </article>
        </div>
      </section>
      </RevealOnScroll>

      {/* Automation Builder Preview */}
      <RevealOnScroll>
      <section className="bubble p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              Automation Builder Preview
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
              Draft workflows visually, then refine logic with your team.
            </p>
          </div>
          <Link href="/automation-builder" className="btn-secondary px-5">
            Open Builder
          </Link>
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--ring)] bg-[var(--card)] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flow-node rounded-xl border border-[var(--ring)] bg-[var(--surface)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Trigger</p>
              <p className="mt-1 text-sm font-medium">Invoice arrives by email</p>
            </div>
            <div className="flow-node rounded-xl border border-[var(--ring)] bg-[var(--surface)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">AI Agent</p>
              <p className="mt-1 text-sm font-medium">Extract and validate fields</p>
            </div>
            <div className="flow-node rounded-xl border border-[var(--ring)] bg-[var(--surface)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Action</p>
              <p className="mt-1 text-sm font-medium">Post to accounting system</p>
            </div>
          </div>
        </div>
      </section>
      </RevealOnScroll>

      {/* Why teams choose Autom8x */}
      <RevealOnScroll>
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Built for enterprise operations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {valueCards.map((card) => (
            <ValueCard key={card.title} title={card.title} description={card.description} icon={card.icon} />
          ))}
        </div>
      </section>
      </RevealOnScroll>

      {/* Industry signals — credibility element */}
      <IndustrySignals />

      {/* Final CTA */}
      <RevealOnScroll>
      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">
          Ready to automate one workflow this quarter?
        </h2>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Tell us which manual process is slowing your team.
          We will map a practical automation plan.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Start a Conversation
        </Link>
      </section>
      </RevealOnScroll>
    </div>
  );
}
