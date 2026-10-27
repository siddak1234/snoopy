"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { decideApproval } from "@/app/account/flows/actions";
import type { Approval } from "@/lib/automations";
import { runLabel } from "@/lib/run-progress";
import { ROW_BAND, SPACING } from "@/lib/spacing";

/** The two decisions, as the platform names them (the API value stays `rejected`; the word is Deny). */
export type Decision = "approved" | "rejected";

/** Where a decision is: sent, saved, or refused — told to the page that shows it. */
export type DecisionState = "sending" | "saved" | "refused";

/**
 * Approve or Deny one held job (Build 24, P6; the session's S6: "Deny" and
 * "Denied", the owner's word, ~~Reject~~ until Build 24) — the one pair, on
 * Approvals and in a held run's step 4. One press each, no confirm; while it
 * saves both wait and the pressed one says "Approving…" or "Denying…". Deny is
 * the danger variant, the owner's call for this pair.
 *
 * The form carries the decision and the workspace the page showed, which is only
 * compared with the active one (register F28, F70). The actor and their
 * workspace role come from the session server-side — a body naming its own role is refused as an
 * unsupported field, because a caller choosing its own role would make the
 * approval's eligible roles a formality.
 */
export function ApprovalDecision({
  approvalId,
  canDecide,
  eligibleRoles,
  workspaceId,
  onDecision,
}: {
  approvalId: string;
  canDecide: boolean;
  /** Who may decide, as the approval says; named, in place of the buttons, to one who may not. */
  eligibleRoles: readonly string[];
  /** The workspace this page shows. */
  workspaceId: string;
  /** Told as the decision is sent, and again once it is saved or refused. */
  onDecision?: (decision: Decision, state: DecisionState) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [pressed, setPressed] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: Decision) => {
    setError(null);
    setPressed(decision);
    onDecision?.(decision, "sending");
    startTransition(async () => {
      const data = new FormData();
      data.append("approvalId", approvalId);
      data.append("decision", decision);
      data.append("workspaceId", workspaceId);
      const result = await decideApproval(data);
      if (!result.ok) setError(result.error);
      onDecision?.(decision, result.ok ? "saved" : "refused");
    });
  };

  // One place for the line a person who may not decide reads — Approvals' row and the run's step 4.
  if (!canDecide) {
    return (
      <p className="text-xs text-[var(--muted)]">
        Only {eligibleRoles.join(" or ")} can decide this.
      </p>
    );
  }

  return (
    <div className={`flex flex-col ${SPACING.inner.gap}`}>
      <div className={`flex items-center ${SPACING.inner.gap}`}>
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => decide("approved")}
        >
          {pending && pressed === "approved" ? "Approving…" : "Approve"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => decide("rejected")}
        >
          {pending && pressed === "rejected" ? "Denying…" : "Deny"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One row of Approvals, as its server read it. */
export type ApprovalRowView = {
  approval: Approval;
  /** The approval's own answer for this person's role; the server checks it again. */
  canDecide: boolean;
  /** How long is left, in words, drawn by the server ("in 23h"). */
  expires: string;
  /** "{flow} · {step title}", joined by the server (`approvalTitle`); never the step id. */
  title: string;
};

/** How long a decided row takes to fade and fold away (the app's 220 ms). */
const LEAVE_MS = 220;

/**
 * The server's rows, with every row this page is deciding, or saw decided,
 * kept where it stood until it has left: the decision's redraw (the action
 * revalidates Approvals) no longer lists it, and it must still fade out.
 */
function keepLeaving(
  next: readonly ApprovalRowView[],
  previous: readonly ApprovalRowView[],
  kept: ReadonlySet<string>,
): ApprovalRowView[] {
  const rows = [...next];
  previous.forEach((row, index) => {
    const id = row.approval.id;
    if (kept.has(id) && !rows.some((entry) => entry.approval.id === id))
      rows.splice(Math.min(index, rows.length), 0, row);
  });
  return rows;
}

/**
 * Approvals' rows (Build 24, P7): a decided row fades and folds away, its pill
 * saying the decision while it goes — never "Pending" beside a decision — and
 * then leaves; the last one leaving goes to Activity. Under reduced motion it
 * leaves at once. Arriving with nothing waiting is the page's empty screen
 * (`empty`), as before.
 */
export function ApprovalQueue({
  rows,
  workspaceId,
  empty,
}: {
  rows: ApprovalRowView[];
  workspaceId: string;
  empty: ReactNode;
}) {
  const router = useRouter();
  const [drawn, setDrawn] = useState(rows);
  const [shown, setShown] = useState(rows);
  // Each row pressed here, and what it was decided — until it has left.
  const [decided, setDecided] = useState<Record<string, Decision | null>>({});
  const [left, setLeft] = useState(0);
  if (drawn !== rows) {
    setDrawn(rows);
    setShown(keepLeaving(rows, shown, new Set(Object.keys(decided))));
  }

  useEffect(() => {
    if (left > 0 && shown.length === 0) router.push("/account/runs");
  }, [left, shown.length, router]);

  const onDecision =
    (id: string) => (decision: Decision, state: DecisionState) => {
      if (state === "refused") {
        // Still waiting: the row stays, with the refusal in words.
        setDecided((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        return;
      }
      setDecided((current) => ({
        ...current,
        [id]: state === "saved" ? decision : null,
      }));
      if (state !== "saved") return;
      const still = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setTimeout(
        () => {
          setShown((current) =>
            current.filter((row) => row.approval.id !== id),
          );
          setLeft((count) => count + 1);
        },
        still ? 0 : LEAVE_MS,
      );
    };

  if (shown.length === 0) return left > 0 ? null : empty;

  return shown.map(({ approval, canDecide, expires, title }) => {
    const decision = decided[approval.id] ?? null;
    return (
      <div
        key={approval.id}
        data-testid={`approval-row-${approval.id}`}
        data-leaving={decision ? "" : undefined}
        className={`group/row grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-[220ms] ${
          decision ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`flex flex-col ${SPACING.inner.gap} ${ROW_BAND}`}>
            <div
              className={`flex flex-wrap items-start justify-between ${SPACING.inner.gap}`}
            >
              <div className="min-w-0">
                <p className="text-sm text-[var(--text)]">{approval.reason}</p>
                <p
                  data-testid={`approval-title-${approval.id}`}
                  className="text-xs text-[var(--muted)]"
                >
                  {title} · expires {expires}
                </p>
              </div>
              <span data-testid={`approval-pill-${approval.id}`}>
                <StatusPill
                  status={
                    decision === "rejected"
                      ? "denied"
                      : (decision ?? approval.status)
                  }
                />
              </span>
            </div>

            <div className={`flex flex-wrap items-center ${SPACING.inner.gap}`}>
              <ApprovalDecision
                approvalId={approval.id}
                canDecide={canDecide}
                eligibleRoles={approval.eligibleRoles}
                workspaceId={workspaceId}
                onDecision={onDecision(approval.id)}
              />
              <Link
                href={`/account/runs/${approval.runId}`}
                prefetch={false}
                className="text-xs text-[var(--accent)] underline underline-offset-2"
              >
                View the run
              </Link>
              {/* The job it holds, by its full id (Build 21, spec A8; the owner's D4 and AM2). */}
              <span
                data-testid={`approval-run-${approval.id}`}
                className="text-xs break-all text-[var(--muted)]"
              >
                {runLabel(approval.runId)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  });
}
