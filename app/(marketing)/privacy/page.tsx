import type { Metadata } from "next";
import { Container } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { LegalLink, LegalSection } from "@/components/marketing/Legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What information Autom8x collects, why, and what we do with it.",
};

const LEGAL_EMAIL = "singh@autom8x.ai";

export default function PrivacyPage() {
  return (
    <Container>
      <section className="pt-16 pb-4">
        <Kicker>Legal</Kicker>
        <h1 className="m-0 -ml-[0.06em] max-w-[20ch] text-[clamp(38px,4.4vw,60px)] leading-[1.1] font-medium tracking-[-0.016em]">
          Privacy Policy
        </h1>
        <p className="mt-6 max-w-[56ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
          Effective and last updated: August 28, 2026. This policy explains what
          information Autom8x collects, why, and what we do with it. It is
          written to be read; if anything is unclear, contact us at{" "}
          <LegalLink href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</LegalLink>.
        </p>
      </section>

      <div className="pb-24">
        <LegalSection heading="Who we are">
          <p>
            Autom8x is a service operated by Snoopy LLC, 14355 Francis Lane,
            Frisco, Texas 75035, United States (&quot;Autom8x&quot;,
            &quot;we&quot;, &quot;us&quot;). For account, billing, and usage
            information, Snoopy LLC is the data controller. For workspace
            content and data processed by the automations a business enables,
            that business is the controller and Autom8x processes the data on
            its documented instructions; business customers can request our data
            processing terms at {LEGAL_EMAIL}.
          </p>
          <p>
            The service is offered from the United States and is not currently
            directed to persons in the European Economic Area or the United
            Kingdom.
          </p>
        </LegalSection>

        <LegalSection heading="What we collect">
          <p>
            <strong>Account information.</strong> You sign in with a Google,
            Microsoft, or Apple account — Autom8x has no passwords. From your
            sign-in provider we receive your name, email address, and profile
            picture, and we use them to create and identify your Autom8x
            account. We do not receive your provider password, and signing in
            does not give Autom8x access to your files, mail, or any other
            content in that provider account.
          </p>
          <p>
            <strong>Workspace content.</strong> What you and your team put into
            the platform: workspaces, team membership, automation subscriptions
            and their configuration, runs and their results, and approval
            decisions.
          </p>
          <p>
            <strong>Connected accounts for automations.</strong> If you connect
            a provider account so an automation can use it, you approve that
            access on the provider&apos;s own consent page — it is always a
            separate, explicit grant, never something sign-in creates silently.
            The access tokens the provider issues are stored encrypted
            (AES-256-GCM envelope encryption). Automations never hold your
            credentials; the platform makes each provider call on their behalf
            and records what was done.
          </p>
          <p>
            <strong>Usage and log data.</strong> Standard operational logs
            (request metadata, IP addresses, timestamps, errors) used to run,
            secure, and debug the service.
          </p>
        </LegalSection>

        <LegalSection heading="Cookies">
          <p>
            Autom8x uses only strictly necessary cookies: HttpOnly, Secure
            session cookies that keep you signed in to the web app, and
            short-lived values that protect the sign-in flow (such as OAuth
            state). We set no advertising, social media, or third-party
            analytics cookies. Because we do not track you across other sites,
            our sites do not respond differently to &quot;Do Not Track&quot;
            signals; because we do not sell or share personal information, a
            Global Privacy Control signal does not change how we already treat
            your data.
          </p>
        </LegalSection>

        <LegalSection heading="Google user data">
          <p>
            For sign-in, Autom8x requests only basic profile information from
            Google (name, email address, profile picture) and uses it solely to
            create and operate your account. If, in the future, an automation
            you enable requests access to additional Google data, that access
            will be requested separately on Google&apos;s consent screen and
            used only to provide the feature you enabled.
          </p>
          <p>
            Autom8x&apos;s use and transfer to any other app of information
            received from Google APIs will adhere to the{" "}
            <LegalLink href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </LegalLink>
            , including the Limited Use requirements. We do not sell Google user
            data, do not transfer it for advertising, and do not permit humans
            to read it except with your affirmative agreement, for security
            purposes such as investigating abuse, to comply with applicable law,
            or where the data has been aggregated and anonymized and is used for
            internal operations.
          </p>
        </LegalSection>

        <LegalSection heading="How we use information">
          <p>
            To provide the service: run the automations you subscribe to,
            enforce your workspace&apos;s roles and approvals, show you what
            happened, and bill for what you use. To secure it: authentication,
            abuse prevention, and audit. To improve it: aggregate, de-identified
            usage analysis. We do not sell personal information, we do not share
            it for cross-context behavioral advertising, and we do not use your
            data for advertising of any kind.
          </p>
        </LegalSection>

        <LegalSection heading="Who we share it with">
          <p>
            Only service providers that host and operate the platform for us,
            each processing data in the United States under an agreement with
            us: Supabase (authentication and database), DigitalOcean
            (application hosting), Vercel (website hosting), Backblaze
            (encrypted off-site backups), and Datadog (operational logs and
            monitoring). We will update this policy before adding or replacing a
            subprocessor category.
          </p>
          <p>
            Your sign-in provider (Google, Microsoft, or Apple) and the
            providers you choose to connect for automations are independent
            services governed by their own privacy policies — they are not our
            service providers.
          </p>
          <p>
            We disclose information if required by law, and in a merger or
            acquisition we would require the successor to honor this policy.
          </p>
        </LegalSection>

        <LegalSection heading="Retention and deletion">
          <p>
            Your data is retained while your account is active. You can delete
            your account from Settings; deletion removes your account data from
            live systems promptly, and nightly encrypted backups rotate on a
            fixed schedule, so deleted data leaves the backup set as those
            backups age out. Operational logs are kept for a limited period for
            security and debugging. Billing records are kept as long as tax and
            accounting law requires. Disconnecting a connected provider account
            revokes and deletes its stored tokens immediately.
          </p>
        </LegalSection>

        <LegalSection heading="Security">
          <p>
            All traffic is encrypted in transit (TLS). Provider tokens are
            envelope-encrypted at rest under keys held separately from the
            database. Access is workspace-scoped and fails closed: an
            unconfigured or unauthorized path refuses rather than degrades. If
            we learn of a breach of security affecting your personal
            information, we will notify affected account holders and, where
            required, regulators without undue delay and in accordance with
            applicable law; where we process workspace content on a business
            customer&apos;s behalf, we will notify that customer without undue
            delay after becoming aware of the breach.
          </p>
        </LegalSection>

        <LegalSection heading="Your rights">
          <p>
            You can access, correct, export, or delete your personal
            information. Account deletion and workspace export are available
            directly in Settings, and you can make any request at {LEGAL_EMAIL}.
            We respond to verifiable requests within the time applicable law
            requires and will never discriminate against you for exercising a
            right.
          </p>
        </LegalSection>

        <LegalSection heading="California and other US state residents">
          <p>
            In the preceding 12 months we collected these categories of personal
            information: identifiers (name, email address, account IDs, IP
            address); commercial information (subscriptions and billing
            records); internet or network activity (log and usage data);
            professional information (your workspace and role); audio/visual
            information (your profile picture); and sensitive personal
            information limited to credentials for the provider accounts you
            choose to connect, stored encrypted. We collect them directly from
            you, from your sign-in provider, from providers you connect, and
            automatically from your use of the service; we disclose them for
            business purposes only to the service providers listed above; we
            retain them as described in Retention and deletion.
          </p>
          <p>
            We do not sell personal information and we do not share it for
            cross-context behavioral advertising, as those terms are defined by
            the California Consumer Privacy Act, and we have not done either in
            the preceding 12 months. We have no actual knowledge of selling or
            sharing the personal information of consumers under 16. Because we
            do not sell or share personal information, we do not provide a
            &quot;Do Not Sell or Share My Personal Information&quot; link, and
            we use sensitive personal information only to provide the service
            you request. Submit requests at {LEGAL_EMAIL} or in Settings; an
            authorized agent may act for you with signed permission. If you live
            in a state whose privacy law grants an appeal right and we decline
            your request, you may appeal by replying to our decision, and if we
            deny the appeal we will tell you how to contact your state attorney
            general.
          </p>
        </LegalSection>

        <LegalSection heading="Children">
          <p>
            The service is a business tool and is not directed to children. We
            do not knowingly collect personal information from anyone under 13.
            If you believe a child has provided us personal information, contact{" "}
            {LEGAL_EMAIL} and we will delete it.
          </p>
        </LegalSection>

        <LegalSection heading="Changes">
          <p>
            The date at the top is the date this policy was last updated. We
            review this policy at least once every 12 months. Material changes
            are announced by email or in the product before they take effect;
            non-material clarifications take effect when posted. Prior versions
            are available on request.
          </p>
        </LegalSection>

        <LegalSection heading="Contact">
          <p>
            <LegalLink href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</LegalLink>{" "}
            · Snoopy LLC, 14355 Francis Lane, Frisco, Texas 75035, United
            States.
          </p>
        </LegalSection>
      </div>
    </Container>
  );
}
