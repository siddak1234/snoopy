import { site } from "@/lib/site";

export default function ContactPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      <section className="bubble p-6 sm:p-8 lg:col-span-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Contact</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Tell us which manual tasks consume the most time today, and we will design an AI workflow tailored to your business.
        </p>
      </section>

      <section className="bubble p-6 sm:p-7 lg:col-span-2">
        <h2 className="text-2xl font-semibold">Email us</h2>
        <p className="mt-3 text-[var(--muted)]">
          Reach us at
          {" "}
          <a href={`mailto:${site.email}`} className="font-semibold text-[var(--link)] underline underline-offset-4">
            {site.email}
          </a>
          .
        </p>

        <h3 className="mt-6 text-lg font-semibold">What to include</h3>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
            <span>Your industry, current process, and key bottlenecks.</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
            <span>The systems involved (ticketing, CRM, docs, or internal tools).</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
            <span>The outcome you want in the first 30 to 60 days.</span>
          </li>
        </ul>
      </section>

      <aside className="bubble-soft p-6 sm:p-7">
        <h2 className="text-xl font-semibold">Fastest way to start</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
          Send 2 to 3 sample tasks plus expected outcomes. We will propose a scoped, industry-fit automation pilot.
        </p>
      </aside>
    </div>
  );
}
