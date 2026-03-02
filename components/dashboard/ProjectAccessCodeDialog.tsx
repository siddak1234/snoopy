"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "snoopy:latestProjectAccessCode";

export function ProjectAccessCodeDialog() {
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setAccessCode(stored);
    }
  }, []);

  function close() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    setCopied(false);
    setAccessCode(null);
  }

  async function copyCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!accessCode) return;
    try {
      if (typeof navigator?.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(accessCode);
      } else if (typeof document !== "undefined") {
        const input = document.createElement("input");
        input.value = accessCode;
        input.readOnly = true;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!accessCode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-hidden
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="project-access-code-title"
        aria-describedby="project-access-code-desc"
        className="relative w-full max-w-md rounded-3xl border border-[var(--ring)] bg-[var(--surface)] p-6 shadow-xl [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <h2
          id="project-access-code-title"
          className="text-xl font-semibold text-[var(--text)]"
        >
          Project access code
        </h2>
        <p
          id="project-access-code-desc"
          className="mt-1 text-sm text-[var(--muted)]"
        >
          Share this access code with your team so they can join.
        </p>
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3">
            <code className="flex-1 font-mono text-lg tracking-wider text-[var(--text)]">
              {accessCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            This code is shown once. Store it securely; you can generate a new
            one later from the project.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="btn-primary inline-flex px-5"
            >
              Done
            </button>
            <button
              type="button"
              onClick={close}
              className="text-sm text-[var(--muted)] underline hover:text-[var(--text)]"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

