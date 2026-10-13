import Link from "next/link";
import SectionCard from "@/components/dashboard/SectionCard";
import { site } from "@/lib/site";

/**
 * Where a signed-in person finds help, and where Intuit's app review is
 * pointed (Account → Support). The support email is the way named: Contact us
 * opens the contact page, whose form is stored and nobody is told (backend
 * SYSTEM-MANIFEST §12.1 #36), so this page never says the form reaches
 * support. It promises no reply time.
 */
export default function AccountSupportPage() {
  return (
    <SectionCard
      title="Support"
      primaryAction={
        <Link
          prefetch={false}
          href="/contact"
          className="btn-secondary inline-flex px-5"
        >
          Contact us
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">
          For help, email{" "}
          <a
            href={`mailto:${site.supportEmail}`}
            className="text-[var(--accent)] underline underline-offset-2"
          >
            {site.supportEmail}
          </a>
          .
        </p>
      </div>
    </SectionCard>
  );
}
