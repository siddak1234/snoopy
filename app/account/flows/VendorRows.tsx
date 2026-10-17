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
} from "@/lib/connection-rows";
import { NONE } from "@/lib/flow-steps";
import { beginConnectionAuthorization } from "@/app/account/connections/actions";
import { rememberConnect } from "@/app/account/connections/pending-connect";

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
 * Drawn on Connect vendor, where a tap is saved at once, and on Set up, where
 * a tap is the choice its Turn on or Save sends (the owner's AM4: "set up
 * should be made simple. vendor connections can be specific but everything is
 * there"). The app's `components/flows/vendor-choice.tsx` on the website.
 *
 * A tap on a connected vendor or None is the choice (`onChoose`). A vendor not
 * connected is connected first, for an owner or admin, through the vendor's
 * sign-in — the browser comes back to `returnTo`, where it is chosen (the
 * owner's build 20 item 2: "If i need to connect then after i click and
 * connection happens then it shoukd take me back"); one that takes a pasted
 * key is connected where its key is pasted, Connections. For a member a vendor
 * not connected is no choice: "Ask an owner or admin to connect it."
 */
export function VendorRows({
  label,
  options,
  chosen,
  canManage,
  workspaceId,
  saving,
  returnTo,
  onChoose,
}: {
  /** The group's name, for a screen reader: "Connect vendor", or the step's choice on Set up. */
  label: string;
  options: VendorOption[];
  /** The vendor chosen now, or `none`. */
  chosen: string;
  canManage: boolean;
  /** The workspace this page shows; a connect is refused once it is not active. */
  workspaceId: string;
  /** The choice being saved: its row says "Saving…" and the rest wait. */
  saving: string | null;
  /** Where a connect started here comes back to. */
  returnTo: string;
  onChoose: (choice: string) => void;
}) {
  const router = useRouter();
  const [connecting, startConnect] = useTransition();
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
    startConnect(async () => {
      const result = await beginConnectionAuthorization(
        workspaceId,
        option.providerId,
      );
      if (result.ok && result.alreadyConnectedAs) {
        onChoose(option.providerId);
        return;
      }
      if (!result.ok || !result.authorizationUrl) {
        setRowError({
          providerId: option.providerId,
          message: result.ok ? "Could not start the connection" : result.error,
        });
        return;
      }
      rememberConnect(option.providerId, returnTo);
      window.location.assign(result.authorizationUrl);
    });
  };

  const tap = (option: VendorOption | null) => {
    if (busy) return;
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
        // Connected, or connectable by this person: the row is the choice.
        const tappable = connected || canManage;
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
              onClick={() => tap(option)}
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
        disabled={busy !== null && busy !== NONE}
        onClick={() => tap(null)}
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
