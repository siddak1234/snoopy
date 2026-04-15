"use client";

import { useState } from "react";
import { resendDomainVerificationAction } from "@/app/account/domain-actions";

type Props = {
  domain: string;
};

export function DomainVerificationBanner({ domain }: Props) {
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
    <div className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:items-center">
      {/* Icon */}
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 sm:mt-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>

      {/* Text */}
      <div className="min-w-0 flex-1">
        {status === "sent" ? (
          <p className="text-sm text-amber-400">
            Verification email sent to your inbox. Check your email and click the link to verify{" "}
            <span className="font-mono font-medium">{domain}</span>.
          </p>
        ) : (
          <>
            <p className="text-sm text-amber-300">
              <span className="font-medium">Verify your domain</span> to enable automatic team
              joining for{" "}
              <span className="font-mono font-medium">@{domain}</span> users.
            </p>
            {status === "error" && errorMsg ? (
              <p className="mt-0.5 text-xs text-red-400">{errorMsg}</p>
            ) : null}
          </>
        )}
      </div>

      {/* Button — hidden once sent */}
      {status !== "sent" ? (
        <button
          type="button"
          onClick={handleResend}
          disabled={status === "sending"}
          className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Resend verification email"}
        </button>
      ) : null}
    </div>
  );
}
