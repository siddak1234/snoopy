import ProcessStepCard from "@/components/home/ProcessStepCard";
import {
  FileSignalIcon,
  MailSignalIcon,
  ProcessingIcon,
  ResultIcon,
  StopwatchSignalIcon,
  TriggerIcon,
} from "@/components/icons/processIcons";

const steps = [
  {
    stepNumber: 1,
    title: "Step 1 — Trigger",
    tagline: "Work starts anywhere.",
    description: "A message arrives, a file is received, or a scheduled event",
    icon: <TriggerIcon />,
  },
  {
    stepNumber: 2,
    title: "Step 2 — AI Processing",
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
    title: "Step 3 — Result",
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

export default function ProcessStepsSection() {
  const [triggerStep, ...otherSteps] = steps;

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
        <ProcessStepCard
          key={triggerStep.stepNumber}
          stepNumber={triggerStep.stepNumber}
          title={triggerStep.title}
          tagline={triggerStep.tagline}
          description={triggerStep.description}
          bullets={triggerStep.bullets}
          icon={triggerStep.icon}
        />

        <div className="grid grid-cols-3 gap-3">
          <article className="bubble flex aspect-square items-center justify-center p-3 sm:p-4" aria-label="Email trigger">
            <MailSignalIcon />
          </article>
          <article className="bubble flex aspect-square items-center justify-center p-3 sm:p-4" aria-label="File trigger">
            <FileSignalIcon />
          </article>
          <article className="bubble flex aspect-square items-center justify-center p-3 sm:p-4" aria-label="Scheduled event trigger">
            <StopwatchSignalIcon />
          </article>
        </div>

        {otherSteps.map((step) => (
          <ProcessStepCard
            key={step.stepNumber}
            stepNumber={step.stepNumber}
            title={step.title}
            tagline={step.tagline}
            description={step.description}
            bullets={step.bullets}
            icon={step.icon}
          />
        ))}
      </div>
    </section>
  );
}
