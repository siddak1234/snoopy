import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { NumberedStep } from "@/components/ui/NumberedStep";
import { PipelineWindow } from "@/components/marketing/PipelineWindow";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";

export const metadata: Metadata = {
  title: "Automation Builder",
  description:
    "Draw the workflow. Watch it run. Design visually, wire in AI agents, set review points — then put it to work.",
};

const features = [
  {
    title: "Blocks, not code",
    copy: "Triggers, agents, and actions snap together on a canvas. Anyone can read it.",
  },
  {
    title: "Review points built in",
    copy: "Mark where a person approves. Everything else moves on its own.",
  },
  {
    title: "Draft with your team",
    copy: "Sticky notes, shared drafts, versions. Refine together, then go live.",
  },
] as const;

export default function AutomationBuilderPage() {
  return (
    <>
      <Container>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="pt-16 pb-14">
          <Kicker>Automation Builder</Kicker>
          <h1 className="m-0 -ml-[0.06em] max-w-[18ch] text-[clamp(38px,4.4vw,60px)] leading-[1.1] font-medium tracking-[-0.016em]">
            Draw the workflow. Watch it run.
          </h1>
          <p className="mt-6 max-w-[56ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
            Design visually, wire in AI agents, set review points. Then put it
            to work.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button
              href="/login?callbackUrl=%2Faccount%2Fbuilder"
              variant="primary"
            >
              Log in to the Builder
            </Button>
            <Button href="/contact" variant="ghost">
              Get a guided demo
            </Button>
          </div>
        </section>

        {/* ── Full-width pipeline ────────────────────────────────────── */}
        <RevealOnScroll>
          <section className="pb-16">
            <PipelineWindow variant="builder" />
          </section>
        </RevealOnScroll>

        {/* ── Features ───────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section className="grid gap-[clamp(20px,3vw,44px)] pb-20 sm:grid-cols-3">
            {features.map((feature, index) => (
              <NumberedStep
                key={feature.title}
                index={index + 1}
                title={feature.title}
              >
                {feature.copy}
              </NumberedStep>
            ))}
          </section>
        </RevealOnScroll>
      </Container>

      {/* ── Customer band ────────────────────────────────────────────── */}
      <Section band>
        <Container className="flex flex-wrap items-center justify-between gap-8">
          <h2 className="m-0 max-w-[26ch] text-[clamp(24px,2.4vw,32px)] leading-tight font-medium">
            Already a customer? Your automations are waiting.
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <Button
              href="/login?callbackUrl=%2Faccount%2Fbuilder"
              variant="primary"
            >
              Log in
            </Button>
            <Button href="/contact" variant="ghost">
              Contact support
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
