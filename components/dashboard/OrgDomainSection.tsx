"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  claimOrganizationDomainAction,
  revokeOrganizationDomainAction,
  updateOrganizationDomainAction,
  verifyOrganizationDomainAction,
} from "@/app/account/organization/actions";
import { FormError } from "@/components/ui/FormError";
import type {
  OrganizationDomain,
  OrganizationDomainJoinPolicy,
} from "@/lib/tenancy";

export function OrgDomainSection({
  workspaceId,
  domains,
}: {
  workspaceId: string;
  domains: OrganizationDomain[];
}) {
  const router = useRouter();
  const [claimDomain, setClaimDomain] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationRecordValue, setVerificationRecordValue] = useState<
    string | null
  >(null);

  async function claimDomainAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const joinPolicy = data.get("joinPolicy") as OrganizationDomainJoinPolicy;
    setClaiming(true);
    setError(null);
    setVerificationRecordValue(null);
    const result = await claimOrganizationDomainAction(
      workspaceId,
      claimDomain,
      joinPolicy,
    );
    setClaiming(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setClaimDomain("");
    setVerificationRecordValue(result.verificationRecordValue ?? null);
    router.refresh();
  }

  async function updateDomain(
    event: React.FormEvent<HTMLFormElement>,
    domainId: string,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setWorkingId(domainId);
    setError(null);
    const result = await updateOrganizationDomainAction(
      workspaceId,
      domainId,
      data.get("joinPolicy") as OrganizationDomainJoinPolicy,
      data.get("discoveryEnabled") === "on",
    );
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function verifyDomain(domainId: string) {
    setWorkingId(domainId);
    setError(null);
    const result = await verifyOrganizationDomainAction(workspaceId, domainId);
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function revokeDomain(domainId: string) {
    setWorkingId(domainId);
    setError(null);
    const result = await revokeOrganizationDomainAction(workspaceId, domainId);
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {domains.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No domain associated with this workspace.
        </p>
      ) : (
        <ul className="space-y-3">
          {domains.map((domain) => {
            const busy = workingId === domain.id;
            return (
              <li
                key={domain.id}
                className="rounded-xl border border-[var(--ring)] p-3"
              >
                <form onSubmit={(event) => updateDomain(event, domain.id)}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-sm text-[var(--text)]">
                      {domain.domain}
                    </span>
                    <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--chip-text)] capitalize">
                      {domain.status}
                    </span>
                  </div>
                  {domain.status !== "verified" ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Add the DNS record named {domain.verificationRecordName},
                      then verify this domain.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="text-xs text-[var(--muted)]">
                      Joining
                      <select
                        name="joinPolicy"
                        defaultValue={domain.joinPolicy}
                        disabled={busy}
                        className="ml-2 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none"
                      >
                        <option value="approval">Approval</option>
                        <option value="automatic">Automatic</option>
                        <option value="invite_only">Invite only</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        name="discoveryEnabled"
                        type="checkbox"
                        defaultChecked={domain.discoveryEnabled}
                        disabled={busy}
                        className="size-4 rounded border-[var(--ring)] text-[var(--accent)] focus:ring-[var(--accent-strong)]"
                      />
                      Show for matching verified email domains
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="text-xs text-[var(--muted)] underline hover:text-[var(--text)] disabled:opacity-60"
                    >
                      Save settings
                    </button>
                    {domain.status !== "verified" ? (
                      <button
                        type="button"
                        onClick={() => verifyDomain(domain.id)}
                        disabled={busy}
                        className="text-xs text-[var(--muted)] underline hover:text-[var(--text)] disabled:opacity-60"
                      >
                        {busy ? "Verifying…" : "Verify DNS"}
                      </button>
                    ) : null}
                    {domain.status !== "revoked" ? (
                      <button
                        type="button"
                        onClick={() => revokeDomain(domain.id)}
                        disabled={busy}
                        className="text-xs text-[var(--error-text)] underline hover:text-[var(--error-text-hover)] disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={claimDomainAction}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
          Add domain
          <input
            name="domain"
            value={claimDomain}
            onChange={(event) => setClaimDomain(event.target.value)}
            disabled={claiming}
            className="rounded-lg border border-[var(--ring)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Joining
          <select
            name="joinPolicy"
            defaultValue="approval"
            disabled={claiming}
            className="rounded-lg border border-[var(--ring)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60"
          >
            <option value="approval">Approval</option>
            <option value="automatic">Automatic</option>
            <option value="invite_only">Invite only</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={claiming}
          className="btn-secondary inline-flex px-4 py-2 text-sm disabled:opacity-60"
        >
          {claiming ? "Adding…" : "Add domain"}
        </button>
      </form>
      {verificationRecordValue ? (
        <p className="text-xs text-[var(--muted)]">
          DNS verification value: {verificationRecordValue}
        </p>
      ) : null}
      <FormError message={error} />
    </div>
  );
}
