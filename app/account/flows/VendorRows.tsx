"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import {
  CONNECTION_ROW,
  ConnectionMark,
  ConnectionRowBody,
  NoneMark,
} from "@/components/dashboard/ConnectionRow";
import {
  connectionLine,
  connectionState,
  type RowConnection,
  VENDOR_MEMBER_NOTE,
} from "@/lib/connection-rows";
import { NONE } from "@/lib/flow-steps";
import { startConnect } from "@/app/account/connections/start-connect";

/** One vendor a step may use: an optional connection its field names. */
export type VendorOption = {
  providerId: string;
  displayName: string;
  /** The provider's published icon name, which may name its mark. */
  icon: string | null;
  /** Whether it connects through the vendor's consent page, here. */
  connectable: boolean;
  /** The workspace's connection to it, or none. */
  connection: RowConnection | null;
};

export const VENDOR_ASK_ADMIN = "Ask an owner or admin to connect it.";
export const VENDOR_NONE_SUB = "Save the details only.";
export const VENDOR_SAVING = "Saving…";

/**
 * One step's vendor choice (backend ADR-0037, ADR-0040; Build 21's A2): a row
 * for each vendor the connection field names, in the manifest's order, then
 * None. Each row is the one connection row (spec A4) — the vendor's mark, its
 * name, the account's email or its state under it — and **the whole row is
 * the control**; a check (24) marks the chosen one, in place of a button.
 * Drawn on Connect integration, where a tap is saved at once, and on Set up, where
 * a tap is the choice its Turn on or Save sends (the owner's AM4: "set up
 * should be made simple. vendor connections can be specific but everything is
 * there"). The app's `snoopy-mobile/components/flows/vendor-choice.tsx` on the website.
 *
 * A tap on a connected vendor or None is the choice (`onChoose`). For an owner
 * or admin, a vendor not connected is connected first through the vendor's
 * sign-in — the browser comes back to `returnTo`, where it is chosen (the
 * owner's build 20 item 2: "If i need to connect then after i click and
 * connection happens then it shoukd take me back"); one that takes a pasted
 * key is connected where its key is pasted, Connections. For a member a
 * vendor not connected is no choice: "Ask an owner or admin to connect it."
 *
 * `readOnly` is a member who may not change the integration (Build 23's B3;
 * backend ADR-0043, the platform refuses a member's change): no row is a
 * choice, None and a connected vendor too, and under the list "Only an owner
 * or admin can change the integration." Connect integration passes it for a
 * member, and Set up for a member changing a flow already on. A new flow's Set
 * up stays a member's to choose (ADR-0043 §2: a flow with no stored choice
 * takes a member's first one, None or a vendor), as the app's Set up does
 * (Build 25, the review's R5c 3). ~~Every row read-only for a member, a new
 * flow's Set up too~~ until Build 25.
 */
export function VendorRows({
  label,
  options,
  chosen,
  canManage,
  readOnly,
  workspaceId,
  saving,
  returnTo,
  onChoose,
}: {
  /** The group's name, for a screen reader: "Connect integration", or the step's choice on Set up. */
  label: string;
  options: VendorOption[];
  /** The vendor chosen now, or `none`. */
  chosen: string;
  canManage: boolean;
  /** A member who may not change the integration: every row inert, and the line that says so. */
  readOnly: boolean;
  /** The workspace this page shows; a connect is refused once it is not active. */
  workspaceId: string;
  /** The choice being saved: its row says "Saving…" and the rest wait. */
  saving: string | null;
  /** Where a connect started here comes back to. */
  returnTo: string;
  onChoose: (choice: string) => void;
}) {
  const router = useRouter();
  const [connecting, startConnecting] = useTransition();
  const [connectingFor, setConnectingFor] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    providerId: string;
    message: string;
  } | null>(null);
  const busy = saving ?? (connecting ? connectingFor : null);
  // Each row is named by its vendor alone and described by its line — its
  // state, "Saving…", or who connects it — so a screen reader says both.
  const lineIds = useId();
  const lineId = (choice: string) => `${lineIds}-${choice}`;

  const connect = (option: VendorOption) => {
    setConnectingFor(option.providerId);
    startConnecting(async () => {
      const started = await startConnect(
        workspaceId,
        option.providerId,
        returnTo,
      );
      if (started.status === "already") onChoose(option.providerId);
      if (started.status === "refused")
        setRowError({
          providerId: option.providerId,
          message: started.message,
        });
    });
  };

  const tap = (option: VendorOption | null) => {
    if (busy || readOnly) return;
    setRowError(null);
    if (!option) {
      onChoose(NONE);
      return;
    }
    if (connectionState(option.connection ?? undefined) === "connected") {
      onChoose(option.providerId);
      return;
    }
    if (!canManage) return;
    if (!option.connectable) {
      router.push("/account/connections");
      return;
    }
    connect(option);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-col divide-y divide-[var(--ring)]"
    >
      {options.map((option) => {
        const connection = option.connection ?? undefined;
        const connected = connectionState(connection) === "connected";
        const isChosen = chosen === option.providerId;
        // Connected, or connectable by this person: the row is the choice —
        // never when read-only.
        const tappable = !readOnly && (connected || canManage);
        const line =
          busy === option.providerId
            ? { text: VENDOR_SAVING, tone: "muted" as const }
            : !connected && !canManage
              ? { text: VENDOR_ASK_ADMIN, tone: "muted" as const }
              : connectionLine(connection);
        return (
          <div key={option.providerId}>
            <button
              type="button"
              role="radio"
              aria-checked={isChosen}
              aria-label={option.displayName}
              aria-describedby={lineId(option.providerId)}
              disabled={
                !tappable || (busy !== null && busy !== option.providerId)
              }
              aria-disabled={!tappable || undefined}
              onClick={tappable ? () => tap(option) : undefined}
              data-testid={`vendor-${option.providerId}`}
              className={`${CONNECTION_ROW} rounded-[var(--radius-md)] px-2 transition enabled:cursor-pointer enabled:hover:bg-[var(--surface-hover)]`}
            >
              <ConnectionRowBody
                mark={<ConnectionMark icon={option.icon} />}
                name={option.displayName}
                line={line.text}
                lineTone={line.tone}
                lineId={lineId(option.providerId)}
                right={<ChoiceMark chosen={isChosen} />}
              />
            </button>
            {rowError?.providerId === option.providerId ? (
              <p
                role="alert"
                className="px-2 pb-3 text-xs text-[var(--error-text)]"
              >
                {rowError.message}
              </p>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={chosen === NONE}
        aria-label="None"
        aria-describedby={lineId(NONE)}
        disabled={readOnly || (busy !== null && busy !== NONE)}
        aria-disabled={readOnly || undefined}
        onClick={readOnly ? undefined : () => tap(null)}
        data-testid="vendor-none"
        className={`${CONNECTION_ROW} rounded-[var(--radius-md)] px-2 transition enabled:cursor-pointer enabled:hover:bg-[var(--surface-hover)]`}
      >
        <ConnectionRowBody
          mark={<NoneMark />}
          name="None"
          line={busy === NONE ? VENDOR_SAVING : VENDOR_NONE_SUB}
          lineId={lineId(NONE)}
          right={<ChoiceMark chosen={chosen === NONE} />}
        />
      </button>
      {readOnly ? (
        <p
          data-testid="vendor-member-note"
          className="px-2 pt-3 text-xs text-[var(--muted)]"
        >
          {VENDOR_MEMBER_NOTE}
        </p>
      ) : null}
    </div>
  );
}

/** The check (24) on the chosen row; the row's own state says it to a screen reader. */
function ChoiceMark({ chosen }: { chosen: boolean }) {
  return (
    <span aria-hidden className="inline-flex size-6 shrink-0">
      {chosen ? (
        <CheckCircleIcon
          size={24}
          weight="fill"
          className="text-[var(--accent-strong)]"
        />
      ) : null}
    </span>
  );
}
