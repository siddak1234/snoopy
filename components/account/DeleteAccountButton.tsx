"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function DeleteAccountButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirmDelete() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Could not delete account. Please try again.");
        setLoading(false);
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.replace("/login?deleted=1");
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-full border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400"
      >
        Delete Account
      </button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="bubble w-full max-w-md p-6 sm:p-8">
            <h2 id="delete-account-title" className="text-xl font-semibold text-[var(--text)]">
              Delete account?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This will permanently delete your account and data. You will need to sign up again to use the service. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loading}
                className="rounded-full border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
              >
                {loading ? "Deleting…" : "Yes, delete my account"}
              </button>
              <button
                type="button"
                onClick={() => !loading && setConfirmOpen(false)}
                disabled={loading}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
