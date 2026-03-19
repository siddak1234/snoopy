import Link from "next/link";
import type { ReactNode } from "react";
import IndustrySignals from "@/components/IndustrySignals";
import AutomationFlowDiagram from "@/components/home/AutomationFlowDiagram";
import RevealOnScroll from "@/components/home/RevealOnScroll";
import HeroSection from "@/components/home/HeroSection";
import ValueCard from "@/components/home/ValueCard";
import { AutonomousIcon, ScalableIcon, SecureIcon } from "@/components/icons/valueIcons";

type IconCard = {
  title: string;
  description: string;
  icon: ReactNode;
};

const whatAutom8xDoes: IconCard[] = [
  {
    title: "Invoice Processing",
    description: "Extract line items, match policies, and prepare posting data.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-[var(--icon-text)]" aria-hidden>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v4h4M10 11h6M10 15h6" />
      </svg>
    ),
  },
  {
    title: "Document Intelligence",
    description: "Classify operational documents and route them to the right team.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-[var(--icon-text)]" aria-hidden>
        <path d="M6 4h12v16H6z" />
        <path d="M9 8h6M9 12h3M9 16h6" />
      </svg>
    ),
  },
  {
    title: "Workflow Automation",
    description: "Connect systems and automate approvals across business operations.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-[var(--icon-text)]" aria-hidden>
        <rect x="3.5" y="4.5" width="6" height="6" rx="1.5" />
        <rect x="14.5" y="4.5" width="6" height="6" rx="1.5" />
        <rect x="9" y="13.5" width="6" height="6" rx="1.5" />
        <path d="M9.5 7.5h5M12 10.5v3" />
      </svg>
    ),
  },
];

const exampleAutomations: IconCard[] = [
  {
    title: "Invoice Processing",
    description: "Capture invoice data and assign GL codes automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-[var(--icon-text)]" aria-hidden>
        <path d="M7 4h10v16H7zM10 9h4M10 13h4M10 17h2" />
      </svg>
    ),
  },
  {
    title: "Document Classification",
    description: "Sort and route contracts, forms, and operational records.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-[var(--icon-text)]" aria-hidden>
        <path d="M5 5h14v14H5zM9 9h6M9 13h6" />
      </svg>
    ),
  },
  {
    title: "Operations Automation",
    description: "Automate approvals and repetitive back-office tasks.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 text-[var(--icon-text)]" aria-hidden>
        <circle cx="7.5" cy="7.5" r="2.5" />
        <circle cx="16.5" cy="7.5" r="2.5" />
        <circle cx="12" cy="16.5" r="2.5" />
        <path d="M9.8 8.5h4.4M8.8 9.6l2.1 4.3M15.2 9.6l-2.1 4.3" />
      </svg>
    ),
  },
];

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

function IconCard({ title, description, icon }: IconCard) {
  return (
    <article className="interactive-card bubble p-5 sm:p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--icon-border)] bg-[var(--icon-bg)]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </article>
  );
}

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

      {/* What Autom8x does */}
      <RevealOnScroll>
      <section className="bubble p-6 sm:p-8">
        <h2 className="text-xl font-semibold sm:text-2xl">
          What Autom8x does
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          Replace manual processing with structured automation that your team can trust.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {whatAutom8xDoes.map((card) => (
            <IconCard key={card.title} {...card} />
          ))}
        </div>
      </section>
      </RevealOnScroll>

      {/* Example automations */}
      <RevealOnScroll>
      <section>
        <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
          Example automations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exampleAutomations.map((card) => (
            <IconCard key={card.title} {...card} />
          ))}
        </div>
      </section>
      </RevealOnScroll>

      {/* How it works */}
      <RevealOnScroll>
      <section className="bubble p-6 sm:p-8">
        <h2 className="text-xl font-semibold sm:text-2xl">
          Automate operational workflows with AI
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          Build a workflow once. Autom8x handles extraction, routing, and updates across systems.
        </p>
        <AutomationFlowDiagram />
      </section>
      </RevealOnScroll>

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
