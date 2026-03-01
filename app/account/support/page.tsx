import Link from "next/link";

export default function AccountSupportPage() {
  return (
    <div className="bubble p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-[var(--text)]">Support</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Get help and contact support. This page is a placeholder.
      </p>
      <Link
        href="/contact"
        className="btn-secondary mt-4 inline-flex px-5"
      >
        Contact us
      </Link>
    </div>
  );
}
