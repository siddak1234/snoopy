"use client";

import { useState } from "react";
import { updateWorkspaceNameAction } from "@/app/account/organization/actions";

type Props = {
  workspaceId: string;
  initialName: string;
};

export function OrgNameEditor({ workspaceId, initialName }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (value.trim() === initialName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateWorkspaceNameAction(workspaceId, value);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(result.error);
    }
  }

  function handleCancel() {
    setValue(initialName);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          disabled={saving}
          maxLength={80}
          className="w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60 sm:max-w-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="btn-primary inline-flex px-4 py-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="btn-secondary inline-flex px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--text)]">{value}</span>
      {saved ? (
        <span className="text-xs text-green-500">Saved</span>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
        >
          Edit
        </button>
      )}
    </div>
  );
}
