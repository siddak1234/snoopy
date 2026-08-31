import type { Metadata } from "next";
import { Container } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { LegalLink, LegalSection } from "@/components/marketing/Legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern use of Autom8x.",
};

const LEGAL_EMAIL = "singh@autom8x.ai";

export default function TermsPage() {
  return (
    <Container>
      <section className="pt-16 pb-4">
        <Kicker>Legal</Kicker>
        <h1 className="m-0 -ml-[0.06em] max-w-[20ch] text-[clamp(38px,4.4vw,60px)] leading-[1.1] font-medium tracking-[-0.016em]">
          Terms of Service
        </h1>
        <p className="mt-6 max-w-[56ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
          Effective and last updated: August 28, 2026. These terms are an
          agreement between you and Snoopy LLC, 14355 Francis Lane, Frisco,
          Texas 75035 (&quot;Autom8x&quot;, &quot;we&quot;, &quot;us&quot;), the
          operator of Autom8x. Questions:{" "}
          <LegalLink href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</LegalLink>.
        </p>
      </section>

      <div className="pb-24">
        <LegalSection heading="Agreement and eligibility">
          <p>
            By creating an account or using the service you agree to these terms
            and to our Privacy Policy, which is incorporated into them. You must
            be at least 18 years old (or the age of majority where you live) to
            use the service. If you use the service on behalf of a company or
            other entity, you represent that you have authority to bind that
            entity, and &quot;you&quot; means that entity.
          </p>
        </LegalSection>

        <LegalSection heading="Your account">
          <p>
            You sign in with a Google, Microsoft, or Apple account and are
            responsible for activity under your Autom8x account. Workspace
            owners and admins control membership, roles, and approvals for their
            workspace; adding a member gives that person the access their role
            grants.
          </p>
        </LegalSection>

        <LegalSection heading="The service">
          <p>
            Automations act only within what you configure and approve: they run
            when their triggers fire, use only the provider accounts you have
            explicitly connected, and hold for human approval where the
            automation or your configuration requires it. You are responsible
            for what you configure automations to do and for having the right to
            connect the provider accounts you connect.
          </p>
          <p>
            We do not promise any particular level of availability, and
            automations may be delayed, fail, or produce incorrect results; you
            are responsible for reviewing automation output and for using the
            approval controls your workspace provides before relying on it. The
            service is a tool, not advice: nothing an automation produces is
            accounting, tax, legal, or other professional advice, and you should
            have a qualified professional review any output you rely on for
            those purposes. We may modify, suspend, or discontinue features with
            reasonable notice where practicable.
          </p>
        </LegalSection>

        <LegalSection heading="Connected provider accounts">
          <p>
            Connecting a provider account grants the platform the scoped access
            you approve on the provider&apos;s own consent page, used solely to
            run your automations. You can disconnect at any time in Settings,
            which revokes and deletes stored tokens. Third-party providers are
            independent services: we are not responsible for their availability,
            their content, or changes they make, and your use of each provider
            remains governed by that provider&apos;s own terms.
          </p>
        </LegalSection>

        <LegalSection heading="Acceptable use">
          <p>
            Don&apos;t use the service to break the law, to infringe
            others&apos; rights, to send spam, to attempt unauthorized access to
            systems or data, or to interfere with the service&apos;s operation.
            You may not use the service in violation of US export control or
            sanctions laws, and you represent that you are not located in an
            embargoed country and are not on any US government restricted-party
            list. We may suspend accounts that violate this section.
          </p>
        </LegalSection>

        <LegalSection heading="Fees and subscriptions">
          <p>
            Paid features are billed as described at purchase; prices shown in
            the product are the sum of the published prices of the automations
            you subscribe to. Subscriptions renew automatically each billing
            period until you cancel; you can cancel any time in Settings,
            effective at the end of the current period, by the same online
            method you used to subscribe. We will give reasonable advance notice
            before a price increase takes effect at your next renewal. Except
            where law requires otherwise, fees are non-refundable and are
            exclusive of taxes, which you are responsible for (other than taxes
            on our income). If payment fails, we may suspend paid features after
            notice and a reasonable opportunity to cure.
          </p>
        </LegalSection>

        <LegalSection heading="Intellectual property">
          <p>
            You own your workspace content, and you grant us the license needed
            to operate the service on it — nothing more. We own the platform.
            Subject to these terms, we grant you a limited, non-exclusive,
            non-transferable, revocable right to access and use the service for
            your internal business purposes. Except as law permits
            notwithstanding this limit, you may not copy, modify, or create
            derivative works of the platform, reverse engineer it, resell or
            sublicense it, scrape it, or access it to build a competing product.
            If you send us feedback, we may use it without restriction or
            obligation.
          </p>
        </LegalSection>

        <LegalSection heading="Copyright complaints">
          <p>
            If you believe content on the service infringes your copyright, send
            a notice complying with 17 U.S.C. §512(c)(3) to {LEGAL_EMAIL} or to
            Snoopy LLC, 14355 Francis Lane, Frisco, Texas 75035. We will remove
            or disable access to material identified in valid notices and will
            terminate the accounts of repeat infringers in appropriate
            circumstances.
          </p>
        </LegalSection>

        <LegalSection heading="Disclaimers">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
            AVAILABLE&quot;. TO THE MAXIMUM EXTENT PERMITTED BY LAW, AUTOM8X
            DISCLAIMS ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
            THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, TITLE, AND NON-INFRINGEMENT, AND DOES NOT WARRANT THAT THE
            SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE. Some
            jurisdictions do not allow the exclusion of implied warranties, so
            parts of this section may not apply to you.
          </p>
        </LegalSection>

        <LegalSection heading="Limitation of liability">
          <p>
            To the maximum extent permitted by law, neither party is liable for
            indirect, incidental, special, consequential, or punitive damages,
            or lost profits, revenue, or data, and each party&apos;s aggregate
            liability for all claims is limited to the greater of the amounts
            you paid us in the twelve months before the first claim arose and US
            $100. These limits do not apply to a party&apos;s gross negligence
            or willful misconduct, to your payment obligations, to your
            indemnification obligations, or to liability that cannot be limited
            by law, and they apply even if a remedy fails of its essential
            purpose. Some jurisdictions do not allow these limitations, so they
            may not apply to you.
          </p>
        </LegalSection>

        <LegalSection heading="Indemnification">
          <p>
            You will defend, indemnify, and hold harmless Autom8x and its
            officers, employees, and agents from any third-party claim, and
            resulting damages, costs, and reasonable attorneys&apos; fees,
            arising from your workspace content, your configuration or use of
            automations, your connection of a provider account you lacked the
            right to connect, or your violation of these terms or of law. We
            will notify you promptly of any such claim and may participate in
            the defense with our own counsel at our expense.
          </p>
        </LegalSection>

        <LegalSection heading="Termination">
          <p>
            You may stop using the service and delete your account at any time.
            We may suspend or terminate accounts that violate these terms, with
            notice where practicable. On termination your right to use the
            service ends; workspace export remains available in Settings or on
            request for a reasonable period after termination (other than
            termination we must act on immediately), after which we delete your
            data as described in the Privacy Policy. Sections that by their
            nature should survive termination — including intellectual property,
            disclaimers, limitation of liability, indemnification, and governing
            law — survive.
          </p>
        </LegalSection>

        <LegalSection heading="Governing law and disputes">
          <p>
            These terms and any dispute arising out of them or the service are
            governed by the laws of the State of Texas, without regard to its
            conflict-of-laws rules. Any claim must be brought exclusively in the
            state or federal courts located in Collin County, Texas, and both
            parties consent to personal jurisdiction and venue there. TO THE
            EXTENT PERMITTED BY LAW, YOU AND AUTOM8X EACH WAIVE THE RIGHT TO A
            JURY TRIAL AND TO PARTICIPATE IN A CLASS OR REPRESENTATIVE ACTION.
            Before filing any claim, you agree to email {LEGAL_EMAIL} a
            description of the dispute and give us 30 days to resolve it
            informally.
          </p>
        </LegalSection>

        <LegalSection heading="Changes and general">
          <p>
            If these terms change materially, we will notify account holders by
            email or in the product before the change takes effect; continued
            use after the effective date is acceptance. These terms and the
            policies they reference are the entire agreement between you and us
            about the service and supersede prior agreements. If any provision
            is held unenforceable, it will be enforced to the maximum extent
            permitted and the rest remains in effect. You may not assign these
            terms without our consent; we may assign them in connection with a
            merger, acquisition, or sale of assets. A failure to enforce a
            provision is not a waiver. Neither party is liable for delay or
            failure caused by events beyond its reasonable control. We may give
            notices by email to your account address or in the product; legal
            notices to us go to the address above.
          </p>
        </LegalSection>
      </div>
    </Container>
  );
}
