"use client";

import { useState } from "react";
import { resendDomainVerificationAction } from "@/app/account/domain-actions";
import { formatDateMediumUTC } from "@/lib/date";

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
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500"
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
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
          aria-hidden
        />
        <span className="font-mono text-[var(--text)]">{domain}</span>
        <span className="text-amber-500">· Unverified</span>
      </div>

      {status === "sent" ? (
        <p className="text-sm text-green-500">
          Verification email sent — check your inbox.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={handleResend}
            disabled={status === "sending"}
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Resend verification email"}
          </button>
          {status === "error" && errorMsg ? (
            <p className="text-xs text-red-400" role="alert">
              {errorMsg}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
