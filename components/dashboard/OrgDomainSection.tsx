"use client";

import { useState } from "react";
import { resendDomainVerificationAction } from "@/app/account/domain-actions";
import { formatDateMediumUTC } from "@/lib/date";
import { FormError } from "@/components/ui/FormError";

type Props =
  | { state: "none" }
  | { state: "verified"; domain: string; verifiedAt: string }
  | { state: "unverified"; domain: string };

export function OrgDomainSection(props: Props) {
  if (props.state === "none") {
    return (
      <p className="text-sm text-[var(--muted)]">
        No domain associated — automatic team joining is not available.
      </p>
    );
  }

  if (props.state === "verified") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* Green dot */}
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--success-text)]"
          aria-hidden
        />
        <span className="font-mono text-[var(--text)]">{props.domain}</span>
        <span className="text-[var(--muted)]">
          · Verified {formatDateMediumUTC(props.verifiedAt)}
        </span>
      </div>
    );
  }

  // unverified
  return <UnverifiedDomain domain={props.domain} />;
}

function UnverifiedDomain({ domain }: { domain: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleResend() {
    setStatus("sending");
    setErrorMsg(null);
    const result = await resendDomainVerificationAction();
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        {/* Amber dot */}
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--warning-text)]"
          aria-hidden
        />
        <span className="font-mono text-[var(--text)]">{domain}</span>
        <span className="text-[var(--warning-text)]">· Unverified</span>
      </div>

      {status === "sent" ? (
        <p className="text-sm text-[var(--success-text)]">
          Verification email sent — check your inbox.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={handleResend}
            disabled={status === "sending"}
            className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-1 text-xs font-medium text-[var(--warning-text)] transition hover:bg-[var(--warning-bg)] disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Resend verification email"}
          </button>
          {status === "error" && errorMsg ? (
            <FormError message={errorMsg} className="text-xs" />
          ) : null}
        </>
      )}
    </div>
  );
}
