import Link from "next/link";

const solutions = [
  {
    title: "Industry Workflow Design",
    bullets: [
      "Map your current process and identify manual task bottlenecks.",
      "Design AI workflow steps aligned to your compliance and operating rules.",
      "Tailor automations to your industry's terminology and outcomes.",
    ],
  },
  {
    title: "Task Automation Pipelines",
    bullets: [
      "Automate repetitive actions from inboxes, forms, and business documents.",
      "Transform unstructured inputs into structured outputs and decisions.",
      "Route work into the right systems without adding manual handoffs.",
    ],
  },
  {
    title: "Human-in-the-Loop Controls",
    bullets: [
      "Add review checkpoints where confidence or risk is high.",
      "Apply approval gates before sensitive updates are executed.",
      "Track quality, exceptions, and throughput for continuous improvement.",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Solutions</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          We build AI workflow automations for manual business tasks, tailored to your industry, systems, and team structure.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Solution categories</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {solutions.map((solution) => (
            <article key={solution.title} className="bubble p-5 sm:p-6">
              <h3 className="text-xl font-semibold">{solution.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
                {solution.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">Discuss your workflow priorities</h2>
        <p className="mt-3 text-[var(--muted)]">
          Share your use case and industry context, and we will shape a workflow plan around your specific needs.
        </p>
        <Link href="/contact" className="btn-primary mt-5 px-5">
          Go to Contact
        </Link>
      </section>
    </div>
  );
}
