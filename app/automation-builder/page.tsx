import Link from "next/link";

export default function AutomationBuilderPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      <section className="bubble p-6 sm:p-8 lg:col-span-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Automation Builder</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Turn a prompt into a working workflow.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-[var(--muted)] sm:text-base">
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
            <span>Describe what you want in plain language—we turn your prompt into a structured plan.</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
            <span>That plan is captured as JSON so steps, conditions, and integrations are explicit and editable.</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
            <span>The workflow runs end-to-end: from trigger to actions, with monitoring and iteration.</span>
          </li>
        </ul>

        <Link href="/contact" className="btn-primary mt-6 inline-block px-5">
          Request Access
        </Link>
      </section>
    </div>
  );
}
