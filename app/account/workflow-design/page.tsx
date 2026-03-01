import Link from "next/link";

export default function AccountWorkflowDesignPage() {
  return (
    <div className="bubble p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-[var(--text)]">
        Workflow Design
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Design and manage workflows. This page is a placeholder.
      </p>
      <Link
        href="/automation-builder"
        className="btn-primary mt-4 inline-flex px-5"
      >
        Open Automation Builder
      </Link>
    </div>
  );
}
