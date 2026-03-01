import Link from "next/link";
import SectionCard from "@/components/dashboard/SectionCard";

export default function AccountSupportPage() {
  return (
    <SectionCard
      title="Support"
      primaryAction={
        <Link href="/contact" className="btn-secondary inline-flex px-5">
          Contact us
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">
          Get help and contact support. This page is a placeholder.
        </p>
      </div>
    </SectionCard>
  );
}
