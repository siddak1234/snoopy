"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import RevealOnScroll from "@/components/home/RevealOnScroll";
import AutomationFlowDiagram from "@/components/home/AutomationFlowDiagram";
import { fadeInUp, staggerContainer } from "@/lib/motion";

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
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5 text-[var(--icon-text)]"
        aria-hidden
      >
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v4h4M10 11h6M10 15h6" />
      </svg>
    ),
  },
  {
    title: "Document Intelligence",
    description:
      "Classify operational documents and route them to the right team.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5 text-[var(--icon-text)]"
        aria-hidden
      >
        <path d="M6 4h12v16H6z" />
        <path d="M9 8h6M9 12h3M9 16h6" />
      </svg>
    ),
  },
  {
    title: "Workflow Automation",
    description:
      "Connect systems and automate approvals across business operations.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5 text-[var(--icon-text)]"
        aria-hidden
      >
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
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5 text-[var(--icon-text)]"
        aria-hidden
      >
        <path d="M7 4h10v16H7zM10 9h4M10 13h4M10 17h2" />
      </svg>
    ),
  },
  {
    title: "Document Classification",
    description: "Sort and route contracts, forms, and operational records.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5 text-[var(--icon-text)]"
        aria-hidden
      >
        <path d="M5 5h14v14H5zM9 9h6M9 13h6" />
      </svg>
    ),
  },
  {
    title: "Operations Automation",
    description: "Automate approvals and repetitive back-office tasks.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5 text-[var(--icon-text)]"
        aria-hidden
      >
        <circle cx="7.5" cy="7.5" r="2.5" />
        <circle cx="16.5" cy="7.5" r="2.5" />
        <circle cx="12" cy="16.5" r="2.5" />
        <path d="M9.8 8.5h4.4M8.8 9.6l2.1 4.3M15.2 9.6l-2.1 4.3" />
      </svg>
    ),
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

export default function HomeAnimatedSections() {
  return (
    <>
      {/* What Autom8x does */}
      <RevealOnScroll variants={staggerContainer({ stagger: 0.08 })}>
        <section className="bubble p-6 sm:p-8">
          <motion.h2
            variants={fadeInUp({ y: 10 })}
            className="text-xl font-semibold sm:text-2xl"
          >
            What Autom8x does
          </motion.h2>
          <motion.p
            variants={fadeInUp({ y: 10 })}
            className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base"
          >
            Replace manual processing with structured automation that your team can trust.
          </motion.p>
          <motion.div
            variants={staggerContainer({ stagger: 0.07, delayChildren: 0.05 })}
            className="mt-5 grid gap-4 md:grid-cols-3"
          >
            {whatAutom8xDoes.map((card) => (
              <motion.div key={card.title} variants={fadeInUp({ y: 10 })}>
                <IconCard {...card} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      </RevealOnScroll>

      {/* Example automations */}
      <RevealOnScroll variants={staggerContainer({ stagger: 0.08 })}>
        <section>
          <motion.h2
            variants={fadeInUp({ y: 10 })}
            className="mb-4 text-xl font-semibold sm:text-2xl"
          >
            Example automations
          </motion.h2>
          <motion.div
            variants={staggerContainer({ stagger: 0.07, delayChildren: 0.05 })}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {exampleAutomations.map((card) => (
              <motion.div key={card.title} variants={fadeInUp({ y: 10 })}>
                <IconCard {...card} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      </RevealOnScroll>

      {/* How it works */}
      <RevealOnScroll variants={staggerContainer({ stagger: 0.08 })}>
        <section className="bubble p-6 sm:p-8">
          <motion.h2
            variants={fadeInUp({ y: 10 })}
            className="text-xl font-semibold sm:text-2xl"
          >
            Automate operational workflows with AI
          </motion.h2>
          <motion.p
            variants={fadeInUp({ y: 10 })}
            className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base"
          >
            Build a workflow once. Autom8x handles extraction, routing, and updates across systems.
          </motion.p>
          <motion.div variants={fadeInUp({ y: 10 })}>
            <AutomationFlowDiagram />
          </motion.div>
        </section>
      </RevealOnScroll>
    </>
  );
}

