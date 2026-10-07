"use client";

import { useState } from "react";
import { setDomainOnlyAction } from "@/app/account/organization/actions";
import { FormError } from "@/components/ui/FormError";
import { DOMAIN_ONLY_SUB, DOMAIN_ONLY_TITLE } from "@/lib/domain-only";

/**
 * The organization's domain-only setting (the owner's build 13 decision 8B):
 * while on, only people whose every sign-in address is at a verified domain can
 * join, and a member cannot link an account outside them. The switch moves at
 * the click and moves back if the platform refuses, saying why; the page is
 * read again when it is saved.
 */
export function OrgDomainOnly({
  workspaceId,
  initialOn,
}: {
  workspaceId: string;
  initialOn: boolean;
}) {
  const [on, setOn] = useState(initialOn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next);
    setSaving(true);
    setError(null);
    const result = await setDomainOnlyAction(workspaceId, next);
    setSaving(false);
    if (!result.ok) {
      setOn(!next);
      setError(result.error);
    }
  }

  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          aria-checked={on}
          checked={on}
          disabled={saving}
          onChange={(event) => void change(event.target.checked)}
          data-testid="organization-domain-only"
          className="mt-0.5 size-4 rounded border-[var(--ring)] text-[var(--accent)] focus:ring-[var(--accent-strong)] disabled:opacity-60"
        />
        <span>
          <span className="font-medium text-[var(--text)]">
            {DOMAIN_ONLY_TITLE}
          </span>
          <span className="mt-0.5 block text-[var(--muted)]">
            {DOMAIN_ONLY_SUB}
          </span>
        </span>
      </label>
      <FormError message={error} className="mt-2" />
    </div>
  );
}
