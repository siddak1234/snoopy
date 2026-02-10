import Link from "next/link";

function HealthcareIconCluster() {
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="absolute inset-0 h-20 w-20 text-[var(--icon-text)]"
        aria-hidden
      >
        <circle cx="16" cy="14" r="3.5" />
        <circle cx="32" cy="14" r="3.5" />
        <circle cx="12" cy="28" r="3.5" />
        <circle cx="24" cy="34" r="3.5" />
        <circle cx="36" cy="28" r="3.5" />
        <path d="M19 14H28" />
        <path d="M14.6 17L12.9 24.3" />
        <path d="M33.4 17L35.1 24.3" />
        <path d="M15.4 29.8L20.8 33" />
        <path d="M32.6 29.8L27.2 33" />
      </svg>
      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-[var(--bullet)] opacity-80" />
      <span className="absolute right-0 top-8 h-1.5 w-1.5 rounded-full bg-[var(--bullet)] opacity-75" />
      <span className="absolute bottom-1 left-2 h-1.5 w-1.5 rounded-full bg-[var(--bullet)] opacity-70" />
    </div>
  );
}

function FinanceIconCluster() {
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="absolute inset-0 h-20 w-20 text-[var(--icon-text)]"
        aria-hidden
      >
        <rect x="8" y="27" width="6" height="11" rx="1.2" />
        <rect x="19" y="21" width="6" height="17" rx="1.2" />
        <rect x="30" y="15" width="6" height="23" rx="1.2" />
        <path d="M8 13.5H40" />
        <path d="M11 13.5L17 8.8L24 13.5L33 7.5L40 11.8" />
      </svg>
      <span className="absolute left-1 top-4 h-2 w-2 rounded-full bg-[var(--bullet)] opacity-80" />
      <span className="absolute right-1 top-2 h-1.5 w-1.5 rounded-full bg-[var(--bullet)] opacity-75" />
      <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-[var(--bullet)] opacity-70" />
    </div>
  );
}

export default function SolutionsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="bubble p-6 sm:p-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Solutions</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          We build AI workflow automations for manual business tasks.
        </p>
      </section>

      <section>
        <h2 className="sr-only">Industry-specific solutions</h2>
        <div className="space-y-4">
          <article className="bubble p-5 sm:p-6">
            <h3 className="text-2xl font-semibold sm:text-3xl">Pick your industry</h3>
          </article>

          <Link
            href="/solutions/healthcare"
            className="bubble group block p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] sm:p-6"
          >
            <article>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="max-w-3xl">
                  <h3 className="text-xl font-semibold">Healthcare</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
                    Modernize clinic operations with secure automation for intake, documentation, care coordination, and patient follow-ups.
                  </p>
                  <span className="mt-4 inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition group-hover:bg-[var(--surface-hover)]">
                    Learn more
                  </span>
                </div>
                <div className="self-end md:self-auto">
                  <HealthcareIconCluster />
                </div>
              </div>
            </article>
          </Link>

          <Link
            href="/solutions/finance"
            className="bubble group block p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] sm:p-6"
          >
            <article>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="max-w-3xl">
                  <h3 className="text-xl font-semibold">Financial Services</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
                    Streamline reviews, reporting, and client operations with compliant workflow automation for finance and investment teams.
                  </p>
                  <span className="mt-4 inline-flex rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition group-hover:bg-[var(--surface-hover)]">
                    Learn more
                  </span>
                </div>
                <div className="self-end md:self-auto">
                  <FinanceIconCluster />
                </div>
              </div>
            </article>
          </Link>
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
