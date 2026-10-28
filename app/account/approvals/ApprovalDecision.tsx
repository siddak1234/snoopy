"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { decideApproval } from "@/app/account/flows/actions";
import type { Approval } from "@/lib/automations";
import {
  offeredDecisions,
  type DecisionAnswer,
  type OfferedDecision,
} from "@/lib/pending-contract";
import {
  ACCEPT,
  ANSWER_EACH,
  DENY,
  REVIEW_MEMBER_NOTE,
  REVIEW_NOT_SAVED,
  SAVE_REVIEW,
  changeLine,
  reviewChanges,
  runLabel,
} from "@/lib/run-progress";
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
 *
 * An approval that offers changes (`decisions`; Round 21, the platform
 * round's F2) is a review instead: `ReviewDecisions`, each change accepted or
 * denied, then Save review.
 */
export function ApprovalDecision({
  approvalId,
  canDecide,
  eligibleRoles,
  workspaceId,
  onDecision,
  decisions = [],
  role,
}: {
  approvalId: string;
  canDecide: boolean;
  /** Who may decide, as the approval says; named, in place of the buttons, to one who may not. */
  eligibleRoles: readonly string[];
  /** The workspace this page shows. */
  workspaceId: string;
  /** Told as the decision is sent, and again once it is saved or refused. */
  onDecision?: (decision: Decision, state: DecisionState) => void;
  /** The changes the held run offers; none is the plain pair. */
  decisions?: readonly OfferedDecision[];
  /** This person's role: a member is told who may review. */
  role?: string;
}) {
  if (decisions.length > 0)
    return (
      <ReviewDecisions
        approvalId={approvalId}
        canDecide={canDecide}
        eligibleRoles={eligibleRoles}
        workspaceId={workspaceId}
        onDecision={onDecision}
        decisions={decisions}
        role={role}
      />
    );
  return (
    <DecisionPair
      approvalId={approvalId}
      canDecide={canDecide}
      eligibleRoles={eligibleRoles}
      workspaceId={workspaceId}
      onDecision={onDecision}
    />
  );
}

/** The plain pair: Approve and Deny. */
function DecisionPair({
  approvalId,
  canDecide,
  eligibleRoles,
  workspaceId,
  onDecision,
}: {
  approvalId: string;
  canDecide: boolean;
  eligibleRoles: readonly string[];
  workspaceId: string;
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

  if (!canDecide) return <MayNotDecide eligibleRoles={eligibleRoles} />;

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

/** One place for the line a person who may not decide reads — Approvals' row and the run's page. */
function MayNotDecide({ eligibleRoles }: { eligibleRoles: readonly string[] }) {
  return (
    <p className="text-xs text-[var(--muted)]">
      Only {eligibleRoles.join(" or ")} can decide this.
    </p>
  );
}

/**
 * A held run's review (Round 21, the platform round's F2; words.md section
 * 3): each change a row, "{label} · {detail}", and to one who may decide two
 * pills, Accept and Deny (Deny the danger one), each pressed or not; "Save
 * review" once every row has an answer, "Accept or deny each change." until
 * then. Saving sends every answer (`decisions`), and the job always goes on,
 * even with every change denied. While it saves the pills and the save wait;
 * a refusal, or no answer, says "The review wasn't saved. Try again." and
 * keeps the answers. A member reads the rows and "Only an owner or admin can
 * review this."; anyone else not named, who may.
 */
function ReviewDecisions({
  approvalId,
  canDecide,
  eligibleRoles,
  workspaceId,
  onDecision,
  decisions,
  role,
}: {
  approvalId: string;
  canDecide: boolean;
  eligibleRoles: readonly string[];
  workspaceId: string;
  onDecision?: (decision: Decision, state: DecisionState) => void;
  decisions: readonly OfferedDecision[];
  role?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, DecisionAnswer>>({});
  const [refused, setRefused] = useState(false);
  const answered = decisions.every((change) => answers[change.id]);

  const save = () => {
    if (!answered) return;
    setRefused(false);
    onDecision?.("approved", "sending");
    startTransition(async () => {
      const data = new FormData();
      data.append("approvalId", approvalId);
      data.append(
        "decisions",
        JSON.stringify(
          decisions.map((change) => ({
            id: change.id,
            decision: answers[change.id],
          })),
        ),
      );
      data.append("workspaceId", workspaceId);
      const result = await decideApproval(data);
      if (!result.ok) setRefused(true);
      onDecision?.("approved", result.ok ? "saved" : "refused");
    });
  };

  return (
    <div
      data-testid="review-decisions"
      className={`flex flex-col ${SPACING.inner.gap}`}
    >
      <ul className={`flex flex-col ${SPACING.inner.gap}`}>
        {decisions.map((change) => {
          const answer = answers[change.id];
          const pick = (next: DecisionAnswer) =>
            setAnswers((current) => ({ ...current, [change.id]: next }));
          return (
            <li
              key={change.id}
              data-testid={`review-change-${change.id}`}
              className={`flex flex-wrap items-center justify-between ${SPACING.inner.gap}`}
            >
              <p className="min-w-0 text-sm text-[var(--text)]">
                {changeLine(change)}
              </p>
              {canDecide ? (
                <div
                  role="group"
                  aria-label={change.label}
                  className={`flex items-center ${SPACING.inner.gap}`}
                >
                  <Button
                    variant={answer === "denied" ? "secondary" : "primary"}
                    size="sm"
                    aria-pressed={answer === "accepted"}
                    aria-label={`${ACCEPT}: ${change.label}`}
                    disabled={pending}
                    onClick={() => pick("accepted")}
                  >
                    {ACCEPT}
                  </Button>
                  <Button
                    variant={answer === "accepted" ? "secondary" : "danger"}
                    size="sm"
                    aria-pressed={answer === "denied"}
                    aria-label={`${DENY}: ${change.label}`}
                    disabled={pending}
                    onClick={() => pick("denied")}
                  >
                    {DENY}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canDecide ? (
        <div className={`flex flex-wrap items-center ${SPACING.inner.gap}`}>
          <Button
            variant="primary"
            size="sm"
            disabled={!answered || pending}
            onClick={save}
          >
            {SAVE_REVIEW}
          </Button>
          {answered ? null : (
            <p className="text-xs text-[var(--muted)]">{ANSWER_EACH}</p>
          )}
        </div>
      ) : role === "member" ? (
        <p className="text-xs text-[var(--muted)]">{REVIEW_MEMBER_NOTE}</p>
      ) : (
        <MayNotDecide eligibleRoles={eligibleRoles} />
      )}
      {refused ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {REVIEW_NOT_SAVED}
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
    // A review is answered on its run's page (the platform round's F2).
    const changes = offeredDecisions(approval).length;
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
              {changes > 0 && canDecide ? (
                <Button
                  href={`/account/runs/${encodeURIComponent(approval.runId)}`}
                  variant="primary"
                  size="sm"
                  prefetch={false}
                  data-testid={`approval-review-${approval.id}`}
                >
                  {reviewChanges(changes)}
                </Button>
              ) : (
                <ApprovalDecision
                  approvalId={approval.id}
                  canDecide={canDecide}
                  eligibleRoles={approval.eligibleRoles}
                  workspaceId={workspaceId}
                  onDecision={onDecision(approval.id)}
                />
              )}
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
