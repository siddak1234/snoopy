"use client";

import { useState } from "react";
import { saveAiDocumentReading } from "@/app/account/ai-consent-actions";
import { FormError } from "@/components/ui/FormError";
import { AI_SETTING } from "@/lib/ai-consent";

/**
 * Settings › AI (spec §3.H; backend ADR-0038): the account's answer to "AI
 * reads your documents", on or off, for every workspace. The switch moves at
 * the click and moves back if the platform refuses, saying so; the account
 * area is read again when it is saved, as the card's answer is.
 */
export function AiReadingSetting({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next);
    setSaving(true);
    setError(null);
    const result = await saveAiDocumentReading(next ? "allowed" : "declined");
    setSaving(false);
    if (!result.ok) {
      setOn(!next);
      setError(AI_SETTING.saveFailed);
    }
  }

  return (
    <div className="border-t border-[var(--ring)] py-5">
      <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
        {AI_SETTING.heading}
      </h2>
      <label className="mt-3 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          aria-checked={on}
          checked={on}
          disabled={saving}
          onChange={(event) => void change(event.target.checked)}
          className="size-4 rounded border-[var(--ring)] text-[var(--accent)] focus:ring-[var(--accent-strong)] disabled:opacity-60"
        />
        <span className="font-medium text-[var(--text)]">
          {AI_SETTING.label}
        </span>
      </label>
      <FormError message={error} className="mt-2" />
    </div>
  );
}
