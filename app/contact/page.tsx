import { site } from "@/lib/site";

export default function ContactPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      {/* Hero */}
      <section className="bubble p-6 sm:p-8 lg:col-span-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Contact Autom8x
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Tell us what repetitive work is slowing your team down, and
          we&rsquo;ll help identify where AI workflow automation can create the
          fastest operational impact for your organization.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          General inquiries:{" "}
          <a
            href={`mailto:${site.email}`}
            className="font-semibold text-[var(--link)] underline underline-offset-4"
          >
            {site.email}
          </a>
        </p>
      </section>

      {/* Card 1 — Start a conversation */}
      <section className="bubble-soft p-6 sm:p-7">
        <h2 className="text-xl font-semibold">Start a conversation</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
          Reach us at{" "}
          <a
            href={`mailto:${site.email}`}
            className="font-semibold text-[var(--link)] underline underline-offset-4"
          >
            {site.email}
          </a>
        </p>

        <h3 className="mt-6 text-lg font-semibold">Best for</h3>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>General questions</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>Partnerships</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>Early-stage conversations</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>Not sure where to start</span>
          </li>
        </ul>
      </section>

      {/* Card 2 — Fastest way to start */}
      <section className="bubble p-6 sm:p-7 lg:col-span-2">
        <h2 className="text-2xl font-semibold">Fastest way to start</h2>
        <p className="mt-3 text-[var(--muted)]">
          Email{" "}
          <a
            href={`mailto:${site.salesEmail}`}
            className="font-semibold text-[var(--link)] underline underline-offset-4"
          >
            {site.salesEmail}
          </a>{" "}
          with the following details so we can scope an automation pilot:
        </p>

        <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>Your industry and team function</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>The workflow you want to automate</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>
              Current tools involved (CRM, ticketing, internal tools, etc.)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>Approximate volume or frequency of the task</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]"
            />
            <span>What success looks like in the next 30–60 days</span>
          </li>
        </ul>
      </section>

      {/* What happens next */}
      <section className="bubble p-6 sm:p-7 lg:col-span-3">
        <h2 className="text-xl font-semibold">What happens next</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] text-xs font-semibold text-[var(--step-pill-text)]"
              aria-hidden
            >
              1
            </span>
            <h3 className="text-sm font-semibold text-[var(--text)]">
              We review your workflow
            </h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Within 1–2 business days, our team reviews your use case and
              identifies automation opportunities.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] text-xs font-semibold text-[var(--step-pill-text)]"
              aria-hidden
            >
              2
            </span>
            <h3 className="text-sm font-semibold text-[var(--text)]">
              We scope a pilot
            </h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              We propose a focused automation pilot — scoped to one workflow so
              you see results quickly.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] text-xs font-semibold text-[var(--step-pill-text)]"
              aria-hidden
            >
              3
            </span>
            <h3 className="text-sm font-semibold text-[var(--text)]">
              You see it working
            </h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              We build and deploy the workflow. You validate the results with
              your team before we expand.
            </p>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="bubble-soft p-6 sm:p-7 lg:col-span-3">
        <h2 className="text-xl font-semibold">Need support?</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
          For product, implementation, or account-related help, contact{" "}
          <a
            href={`mailto:${site.supportEmail}`}
            className="font-semibold text-[var(--link)] underline underline-offset-4"
          >
            {site.supportEmail}
          </a>
        </p>
      </section>
    </div>
  );
}
