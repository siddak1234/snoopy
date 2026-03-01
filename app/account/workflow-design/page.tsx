import Link from "next/link";
import SectionCard from "@/components/dashboard/SectionCard";

export default function AccountWorkflowDesignPage() {
  return (
    <SectionCard
      title="Workflow Design"
      primaryAction={
        <Link href="/automation-builder" className="btn-primary inline-flex px-5">
          Open Automation Builder
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">
          Design and manage workflows. This page is a placeholder.
        </p>
      </div>
    </SectionCard>
  );
}
