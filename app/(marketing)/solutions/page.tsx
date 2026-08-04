import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "We automate the document work that slows operations down — scoped to your industry and your workflow.",
};

const industries = [
  {
    id: "healthcare",
    number: "01",
    title: "Healthcare",
    copy: "Intake, documentation, and follow ups run themselves. Clinical teams stay with patients.",
    bullets: [
      "Patient intake and referral processing",
      "Clinical documentation and coding support",
      "Scheduling and care coordination",
    ],
    cta: "Talk about healthcare",
    imageAlt: "Clinical operations",
    imageFirst: false,
  },
  {
    id: "finance",
    number: "02",
    title: "Finance & accounting",
    copy: "Invoices, expenses, approvals, and audit prep. Less manual work, controls intact.",
    bullets: [
      "Invoice capture, GL coding, and posting",
      "Expense classification and approval routing",
      "Audit trails prepared as the work happens",
    ],
    cta: "Talk about finance",
    imageAlt: "Finance team working with ledgers",
    imageFirst: true,
  },
] as const;

const useCases = [
  {
    tag: "Healthcare",
    title: "From documentation burden to care delivery",
    copy: "Intake and documentation run themselves. Care teams stay with patients.",
    imageAlt: "A clinical setting",
  },
  {
    tag: "HR and Governance",
    title: "From performance reviews to performance intelligence",
    copy: "Evidence gathered continuously. Reviews write themselves.",
    imageAlt: "A team review meeting",
  },
  {
    tag: "Finance and Legal",
    title: "From contracts to financial truth",
    copy: "Terms extracted, obligations tracked, postings reconciled to source.",
    imageAlt: "Contracts on a finance desk",
  },
] as const;

export default function SolutionsPage() {
  return (
    <>
      <Container>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="pt-16 pb-14">
          <Kicker>Solutions</Kicker>
          <h1 className="m-0 -ml-[0.06em] max-w-[18ch] text-[clamp(38px,4.4vw,60px)] leading-[1.1] font-medium tracking-[-0.016em]">
            Scoped to an industry. Built around a workflow.
          </h1>
          <p className="mt-6 max-w-[56ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
            We automate the document work that slows operations down. Scoped to
            your industry and your workflow.
          </p>
        </section>

        {/* ── Industries ─────────────────────────────────────────────── */}
        {industries.map((industry) => (
          <RevealOnScroll key={industry.id}>
            <section
              id={industry.id}
              className="grid scroll-mt-24 items-center gap-[clamp(24px,5vw,96px)] border-t border-[var(--color-neutral-700)] py-10 lg:grid-cols-2"
            >
              <div className={industry.imageFirst ? "lg:order-2" : ""}>
                <p className="m-0 text-[15px] font-[var(--font-heading)] text-[var(--color-accent)] [font-feature-settings:'tnum'_1]">
                  {industry.number}
                </p>
                <h2 className="mt-3.5 text-[clamp(26px,2.8vw,38px)] leading-tight font-medium">
                  {industry.title}
                </h2>
                <p className="mt-4 max-w-[50ch] text-[15.5px] leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
                  {industry.copy}
                </p>
                <ul className="mt-5 flex list-none flex-col gap-2.5 p-0 text-[14.5px] leading-6 text-[color-mix(in_srgb,var(--color-text)_72%,transparent)]">
                  {industry.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-3 h-px w-4 flex-none bg-[var(--color-accent)]"
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Button href="/contact" variant="primary" className="mt-7">
                  {industry.cta}
                </Button>
              </div>
              <figure
                className={`lighten m-0 ${industry.imageFirst ? "lg:order-1" : ""}`}
              >
                <ImagePlaceholder aspect="4/3" alt={industry.imageAlt} />
              </figure>
            </section>
          </RevealOnScroll>
        ))}

        {/* ── Use cases ──────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section
            id="usecases"
            className="scroll-mt-24 border-t border-[var(--color-neutral-700)] pt-14 pb-18"
          >
            <Kicker>Use cases</Kicker>
            <h2 className="m-0 text-[clamp(26px,2.8vw,38px)] leading-tight font-medium">
              Real workflows, before and after.
            </h2>
            <div className="mt-9 grid gap-6 md:grid-cols-3">
              {useCases.map((useCase) => (
                <article
                  key={useCase.title}
                  className="interactive-card flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-neutral-700)] bg-[color-mix(in_srgb,var(--color-neutral-900)_55%,transparent)]"
                >
                  <div className="lighten">
                    <ImagePlaceholder
                      aspect="16/9"
                      alt={useCase.imageAlt}
                      rounded={false}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-5.5 pt-5 pb-6">
                    <p className="m-0 text-[11px] tracking-[0.14em] text-[var(--color-neutral-400)] uppercase">
                      {useCase.tag}
                    </p>
                    <h3 className="m-0 text-[19px] font-medium">
                      {useCase.title}
                    </h3>
                    <p className="m-0 flex-1 text-sm leading-6 text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
                      {useCase.copy}
                    </p>
                    <Link
                      href="/contact"
                      className="text-sm text-[var(--color-accent-300)] transition hover:text-[var(--color-accent)]"
                    >
                      Scope this workflow →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </RevealOnScroll>
      </Container>

      {/* ── Band CTA ─────────────────────────────────────────────────── */}
      <Section band className="mt-10">
        <Container className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <h2 className="m-0 max-w-[26ch] text-[clamp(24px,2.4vw,32px)] leading-tight font-medium">
              Don&apos;t see your industry? If it&apos;s repetitive, it
              qualifies.
            </h2>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
              If your team handles documents, approvals, or data entry, we can
              automate it.
            </p>
          </div>
          <Button href="/contact" variant="primary">
            Tell us about your workflow
          </Button>
        </Container>
      </Section>
    </>
  );
}
