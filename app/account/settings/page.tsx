import SectionCard from "@/components/dashboard/SectionCard";

export default function AccountSettingsPage() {
  return (
    <SectionCard title="Settings">
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">
          Account and workspace settings. Connect integrations here. This page is a placeholder.
        </p>
      </div>
    </SectionCard>
  );
}
