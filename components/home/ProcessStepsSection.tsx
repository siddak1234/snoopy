import { cloneElement } from "react";
import ProcessStepFlipCard from "@/components/home/ProcessStepFlipCard";
import TriggerFlipCard from "@/components/home/TriggerFlipCard";
import {
  ProcessingIcon,
  ResultIcon,
  TriggerIcon,
} from "@/components/icons/processIcons";

const steps = [
  {
    stepNumber: 1,
    title: "Trigger",
    tagline: "Work starts anywhere.",
    description: "A message arrives, a file is received, or a scheduled event",
    icon: <TriggerIcon />,
  },
  {
    stepNumber: 2,
    title: "AI Processing",
    tagline: "AI completes the work.",
    description:
      "AI interprets the request, extracts key details, and recreates the manual steps your team normally performs — with rules and approvals when needed.",
    bullets: [
      "Understands intent & context",
      "Extracts structured data",
      "Follows procedures & checks",
      "Escalates when required",
    ],
    icon: <ProcessingIcon />,
  },
  {
    stepNumber: 3,
    title: "Result",
    tagline: "Outcomes delivered automatically.",
    description:
      "Verified results are delivered to the next step in your process — updates, notifications, records, or reports — without manual handoffs.",
    bullets: [
      "Updates & records",
      "Notifications & routing",
      "Reports & exports",
      "Next-step actions",
    ],
    icon: <ResultIcon />,
  },
];

const iconSize = { width: "3rem", height: "3rem" };

export default function ProcessStepsSection() {
  const [, ...otherSteps] = steps;

  return (
    <section aria-labelledby="process-steps-title" className="space-y-4">
      <div className="bubble p-5 sm:p-6">
        <h2 id="process-steps-title" className="text-2xl font-semibold sm:text-3xl">
          From Trigger to Result
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
          We connect to where work starts, use AI to handle the task, and deliver outcomes automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <TriggerFlipCard />

        {otherSteps.map((step) => (
          <ProcessStepFlipCard
            key={step.stepNumber}
            stepNumber={step.stepNumber}
            title={step.title}
            description={step.description}
            icon={cloneElement(step.icon, { style: iconSize })}
            backTitle={step.tagline}
            backContent={
              step.bullets && step.bullets.length > 0 ? (
                <ul
                  className={
                    step.stepNumber === 3
                      ? "space-y-1.5 p-3 text-xs leading-snug text-[var(--muted)] sm:space-y-2 sm:p-4 sm:text-sm"
                      : "space-y-2 p-3 text-sm text-[var(--muted)] sm:p-4 sm:text-base"
                  }
                >
                  {step.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
        ))}
      </div>
    </section>
  );
}
