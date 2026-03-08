import SectionCard from "@/components/dashboard/SectionCard";
import DeleteAccountButton from "@/components/account/DeleteAccountButton";
import LinkedAccountsSection from "@/components/account/LinkedAccountsSection";

export default function AccountSettingsPage() {
  return (
    <SectionCard title="Settings">
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">
          Account and workspace settings. Connect integrations here.
        </p>
      </div>
      <LinkedAccountsSection />
      <div className="border-t border-[var(--ring)] pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Danger zone
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Permanently delete your account and all associated data.
        </p>
        <div className="mt-3">
          <DeleteAccountButton />
        </div>
      </div>
    </SectionCard>
  );
}
