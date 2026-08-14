import type { Metadata } from "next";
import { Container } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/components/marketing/ContactForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Tell us what's slowing your team down. We find the fastest win and scope a pilot around it.",
};

const nextSteps = [
  {
    lead: "We review your workflow.",
    copy: "We reply within two business days.",
  },
  {
    lead: "We scope a pilot.",
    copy: "Focused on one workflow, so you see results quickly.",
  },
  {
    lead: "You see it working.",
    copy: "We build and deploy. You validate before we expand.",
  },
] as const;

const directLines = [
  { label: "General and partnerships", email: site.email },
  { label: "Pilots and sales", email: site.salesEmail },
  { label: "Product and support", email: site.supportEmail },
] as const;

export default function ContactPage() {
  return (
    <Container>
      <section className="pt-16 pb-14">
        <Kicker>Contact</Kicker>
        <h1 className="m-0 -ml-[0.06em] max-w-[20ch] text-[clamp(38px,4.4vw,60px)] leading-[1.1] font-medium tracking-[-0.016em]">
          Tell us what&apos;s slowing your team down.
        </h1>
        <p className="mt-6 max-w-[56ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
          We find the fastest win and scope a pilot around it.
        </p>
      </section>

      <section className="grid items-start gap-[clamp(28px,5vw,96px)] pb-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card padding="lg" className="shadow-[var(--shadow-md)]">
          <h2 className="m-0 text-[22px] font-medium">Scope a pilot</h2>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
            Email{" "}
            <a
              href={`mailto:${site.salesEmail}`}
              className="text-[var(--color-accent-300)] underline underline-offset-2 transition hover:text-[var(--color-accent)]"
            >
              {site.salesEmail}
            </a>
            , or use the form:
          </p>
          <ContactForm />
        </Card>

        <div className="flex flex-col gap-8">
          <div>
            <h2 className="m-0 text-lg font-medium">What happens next</h2>
            <div className="mt-4 flex flex-col gap-4">
              {nextSteps.map((step, index) => (
                <div key={step.lead} className="flex gap-4">
                  <span className="w-6 flex-none text-sm font-[var(--font-heading)] text-[var(--color-accent)] [font-feature-settings:'tnum'_1]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="m-0 text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_72%,transparent)]">
                    <span className="text-[var(--color-text)]">
                      {step.lead}
                    </span>{" "}
                    {step.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--color-neutral-700)] pt-6">
            <h2 className="m-0 text-lg font-medium">Direct lines</h2>
            <div className="mt-4 flex flex-col gap-3 text-[14.5px] leading-6">
              {directLines.map((line) => (
                <p
                  key={line.email}
                  className="m-0 text-[color-mix(in_srgb,var(--color-text)_72%,transparent)]"
                >
                  {line.label}:{" "}
                  <a
                    href={`mailto:${line.email}`}
                    className="text-[var(--color-accent-300)] underline underline-offset-2 transition hover:text-[var(--color-accent)]"
                  >
                    {line.email}
                  </a>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}
