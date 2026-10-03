"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Copy join link (the owner, build 9), on the organization page its owners and
 * admins alone reach: the join page's address for this organization. The
 * platform takes a request through it only from a person at the organization's
 * verified email domain — today's rule, unchanged — and that domain's joining
 * policy decides what follows; the line under it says which (`joinLinkLine`).
 *
 * The clipboard can be refused (a permission, or an origin the browser does not
 * trust); the address is then shown in a field, selected, to copy by hand.
 */
export function OrgJoinLink({
  workspaceId,
  line,
}: {
  workspaceId: string;
  /** What the link does, from the organization's domains (`joinLinkLine`). */
  line: string;
}) {
  const [copied, setCopied] = useState(false);
  const [byHand, setByHand] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!byHand) return;
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, [byHand]);

  async function copy() {
    const link = new URL(
      `/onboarding/join-org?w=${encodeURIComponent(workspaceId)}`,
      window.location.origin,
    ).href;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(link);
      setByHand(null);
      setCopied(true);
    } catch {
      setByHand(link);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          Copy join link
        </Button>
        <p role="status" className="text-xs text-[var(--muted)]">
          {copied ? "Copied" : ""}
        </p>
      </div>
      {byHand ? (
        <input
          ref={fieldRef}
          type="text"
          readOnly
          value={byHand}
          aria-label="Join link"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--text)]"
        />
      ) : null}
      <p className="mt-2 text-xs text-[var(--muted)]">{line}</p>
    </div>
  );
}
