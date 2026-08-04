import type { Metadata } from "next";
import Link from "next/link";
import LogoMark from "@/components/branding/LogoMark";
import { Button } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { NumberedStep } from "@/components/ui/NumberedStep";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { Marquee, type MarqueeItem } from "@/components/marketing/Marquee";
import { PipelineWindow } from "@/components/marketing/PipelineWindow";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";
import {
  ScrollStory,
  type StoryPhase,
} from "@/components/marketing/ScrollStory";
import { TiltCard } from "@/components/marketing/TiltCard";
import { TypingHeadline } from "@/components/marketing/TypingHeadline";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "Automation multiplied by AI. Repetitive work becomes agentic workflows — secure, scalable, autonomous.",
};

const signals: MarqueeItem[] = [
  {
    quote:
      "“Capturing this may depend less on new technological breakthroughs than on how organizations redesign workflows”",
    attribution: "McKinsey",
    href: "https://www.mckinsey.com/mgi/our-research/agents-robots-and-us-skill-partnerships-in-the-age-of-ai",
  },
  {
    quote: "“embed AI into how people think, work, and lead.”",
    attribution: "BCG",
    href: "https://www.bcg.com/2025/to-unlock-the-full-value-of-ai-invest-in-your-people",
  },
  {
    quote:
      "“Generative AI … represents a fundamentally different way of working.”",
    attribution: "Accenture",
    href: "https://www.accenture.com/us-en/insights/consulting/gen-ai-reinventing-enterprise-models",
  },
];

const storyPhases: StoryPhase[] = [
  {
    kicker: "The manual grind",
    title: "Inboxes, invoices, intake forms. All day. Every day.",
    sub: "Document work eats whole teams. It doesn't have to.",
    imageAlt: "Hands buried in paperwork",
  },
  {
    kicker: "Automation multiplied by AI",
    title: "Every repetitive task, done by an agent.",
    sub: "Extraction, classification, routing, posting. On their own.",
    imageAlt: "An automated workflow running on screen",
  },
  {
    kicker: "Your team, unburdened",
    title: "Your team reviews. The agents run.",
    sub: "Review points where judgment matters. Everything else just happens.",
    imageAlt: "A team free to do real work",
  },
];

const useCases = [
  {
    tag: "Finance & Legal",
    title: "From contracts to financial truth",
    copy: "Invoices captured, coded, and posted. You review exceptions.",
    imageAlt: "Invoices on a finance desk",
  },
  {
    tag: "Healthcare",
    title: "From documentation burden to care delivery",
    copy: "Intake and documentation run themselves.",
    imageAlt: "A clinical setting",
  },
  {
    tag: "HR & Governance",
    title: "From performance reviews to performance intelligence",
    copy: "Evidence gathered continuously. Reviews write themselves.",
    imageAlt: "A team review meeting",
  },
];

const heroValues = [
  { term: "Secure", detail: "Audit trails built in" },
  { term: "Scalable", detail: "Same process, any volume" },
  { term: "Autonomous", detail: "You review exceptions, not queues" },
] as const;

const howItWorks = [
  {
    label: "Review",
    title: "We map your workflow",
    copy: "We review the process within two business days.",
  },
  {
    label: "Pilot",
    title: "We scope one workflow",
    copy: "One pilot, one process. Results in weeks.",
  },
  {
    label: "Live",
    title: "You watch it run",
    copy: "We deploy. You validate before it expands.",
  },
] as const;

export default function Home() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Container>
        <section className="grid items-center gap-[clamp(28px,4vw,72px)] pt-16 pb-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <Kicker>Automation × AI</Kicker>
            <TypingHeadline />
            <p className="mt-6 max-w-[46ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
              Repetitive work becomes agentic workflows. The pipeline on the
              right is live.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button href="/automation-builder" variant="primary">
                Open the Builder
              </Button>
              <Button href="/contact" variant="ghost">
                Talk to our team
              </Button>
            </div>
            <dl className="mt-9 grid grid-cols-[max-content_1fr] items-baseline gap-x-6 gap-y-3 border-t border-[var(--color-neutral-800)] pt-5">
              {heroValues.map(({ term, detail }) => (
                <div key={term} className="contents">
                  <dt className="m-0 text-[15px] font-[var(--font-heading)] text-[var(--color-text)]">
                    {term}
                  </dt>
                  <dd className="m-0 text-[13px] leading-5 text-[var(--color-neutral-400)]">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <TiltCard>
            <PipelineWindow variant="home" />
          </TiltCard>
        </section>
      </Container>

      {/* ── Industry signals ─────────────────────────────────────────── */}
      <Marquee items={signals} />

      {/* ── Scroll story ─────────────────────────────────────────────── */}
      <ScrollStory phases={storyPhases} />

      {/* ── Use cases ────────────────────────────────────────────────── */}
      <Container>
        <RevealOnScroll>
          <section id="usecases" className="pt-24 pb-20">
            <Kicker>What Autom8x automates</Kicker>
            <div className="flex flex-wrap items-baseline justify-between gap-6">
              <h2 className="m-0 text-[clamp(28px,3vw,40px)] leading-tight font-medium">
                Any repetitive task. Start with these.
              </h2>
              <span className="text-[13px] text-[var(--color-neutral-400)]">
                scroll →
              </span>
            </div>
            <div className="mt-9 grid snap-x snap-mandatory auto-cols-[minmax(340px,420px)] grid-flow-col gap-6 overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)] px-1 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {useCases.map((useCase) => (
                <article
                  key={useCase.title}
                  className="interactive-card flex snap-start flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-neutral-700)] bg-[color-mix(in_srgb,var(--color-neutral-900)_55%,transparent)]"
                >
                  <div className="lighten">
                    <ImagePlaceholder
                      aspect="16/9"
                      alt={useCase.imageAlt}
                      rounded={false}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 px-6 pt-5 pb-6">
                    <p className="m-0 text-[11px] tracking-[0.14em] text-[var(--color-neutral-400)] uppercase">
                      {useCase.tag}
                    </p>
                    <h3 className="m-0 text-xl font-medium">{useCase.title}</h3>
                    <p className="m-0 flex-1 text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_72%,transparent)]">
                      {useCase.copy}
                    </p>
                    <Link
                      href="/solutions#usecases"
                      className="mt-1.5 text-sm text-[var(--color-accent-300)] transition hover:text-[var(--color-accent)]"
                    >
                      Read the use case →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </RevealOnScroll>
      </Container>

      {/* ── Industries band ──────────────────────────────────────────── */}
      <Section band id="industries">
        <Container className="grid gap-[clamp(24px,4vw,64px)] md:grid-cols-2">
          <div>
            <Kicker className="text-[var(--color-accent-200)]">
              Industries
            </Kicker>
            <h2 className="m-0 max-w-[20ch] text-[clamp(26px,2.6vw,36px)] leading-snug font-medium">
              Built for enterprise operations: secure, scalable, autonomous.
            </h2>
          </div>
          <div className="flex flex-col justify-center gap-5">
            {[
              { href: "/solutions#healthcare", label: "Healthcare operations" },
              { href: "/solutions#finance", label: "Finance & accounting" },
            ].map((industry) => (
              <Link
                key={industry.href}
                href={industry.href}
                className="flex items-baseline justify-between gap-4 border-b border-[color-mix(in_srgb,var(--color-text)_25%,transparent)] pb-4"
              >
                <span className="text-xl font-[var(--font-heading)] text-[var(--color-text)]">
                  {industry.label}
                </span>
                <span className="text-[var(--color-accent-200)]">→</span>
              </Link>
            ))}
            <p className="m-0 text-sm leading-relaxed text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
              Don&apos;t see yours? If it&apos;s repetitive, it qualifies.{" "}
              <Link
                href="/contact"
                className="text-[var(--color-accent-200)] hover:text-[var(--color-accent-300)]"
              >
                Tell us about your workflow →
              </Link>
            </p>
          </div>
        </Container>
      </Section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <Container>
        <RevealOnScroll>
          <section className="pt-20">
            <Kicker>How it works</Kicker>
            <h2 className="m-0 text-[clamp(26px,2.6vw,36px)] leading-snug font-medium">
              From first email to running workflow.
            </h2>
            <div className="mt-10 grid gap-[clamp(20px,3vw,44px)] sm:grid-cols-3">
              {howItWorks.map((step, index) => (
                <NumberedStep
                  key={step.label}
                  index={index + 1}
                  label={step.label}
                  title={step.title}
                >
                  {step.copy}
                </NumberedStep>
              ))}
            </div>
          </section>
        </RevealOnScroll>

        {/* ── Contact CTA ──────────────────────────────────────────── */}
        <RevealOnScroll>
          <section id="contact" className="pt-20 pb-14">
            <div className="grid items-center gap-[clamp(24px,5vw,96px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <div>
                <h3 className="m-0 text-[clamp(26px,2.6vw,36px)] leading-snug font-medium">
                  One workflow, this quarter.
                </h3>
                <p className="mt-4 max-w-[52ch] text-[15.5px] leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
                  Tell us what slows your team down. We scope a pilot and you
                  watch it run.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button href="/contact" variant="primary">
                    Start a conversation
                  </Button>
                  <a
                    href={`mailto:${site.salesEmail}`}
                    className="text-sm text-[var(--color-accent-300)] transition hover:text-[var(--color-accent)]"
                  >
                    {site.salesEmail}
                  </a>
                </div>
              </div>
              <figure className="m-0 hidden justify-center opacity-90 lg:flex">
                <LogoMark height={140} />
              </figure>
            </div>
          </section>
        </RevealOnScroll>
      </Container>
    </>
  );
}
