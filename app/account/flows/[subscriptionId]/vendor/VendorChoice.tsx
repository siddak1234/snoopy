"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/ui/FormError";
import { connectionState } from "@/lib/connection-rows";
import { flowPath } from "@/lib/flow-steps";
import { PENDING_CONNECT } from "@/app/account/connections/pending-connect";
import { saveVendorChoice } from "../../actions";
import { VendorRows, type VendorOption } from "../../VendorRows";

function pendingConnect(): string | null {
  try {
    return sessionStorage.getItem(PENDING_CONNECT);
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

/** A save refused: said under the card, and the page stays (spec A2). */
export const VENDOR_SAVE_FAILED = "Could not save. Try again.";

/**
 * Connect integration's rows, saved at the tap (spec A2): a connected vendor or
 * None → the flow's choice for this step is saved → back to the flow's page;
 * the choice it holds already → straight back. A vendor not connected, for an
 * owner or admin, goes to its sign-in, and back here connected it is saved and
 * the page goes back; cancelled or not completed, the page stays and says so
 * in the existing words. While it saves, the tapped row says "Saving…" and
 * the rest wait. ~~Done, Save, Saving… as buttons~~ until Build 21.
 */
export function VendorChoice({
  workspaceId,
  subscriptionId,
  field,
  saved,
  options,
  canManage,
  returnTo,
  callbackStatus,
}: {
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  /** The connection setting this page chooses for. */
  field: string;
  /** The choice the flow holds now. */
  saved: string;
  options: VendorOption[];
  canManage: boolean;
  /** This page, for a connect's way back. */
  returnTo: string;
  /** Back from a vendor's sign-in, as Connections was told it ended. */
  callbackStatus: "connected" | "error" | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read in the browser only: which vendor this tab's last connect left for.
  const returnedFor = useSyncExternalStore(
    noSubscription,
    pendingConnect,
    () => null,
  );

  const save = (choice: string) => {
    if (saving) return;
    if (choice === saved) {
      router.push(flowPath(subscriptionId));
      return;
    }
    setError(null);
    setSaving(choice);
    startTransition(async () => {
      const data = new FormData();
      data.set("workspaceId", workspaceId);
      data.set("subscriptionId", subscriptionId);
      data.set("field", field);
      data.set("choice", choice);
      const result = await saveVendorChoice(data);
      if (!result.ok) {
        setSaving(null);
        setError(VENDOR_SAVE_FAILED);
        return;
      }
      router.push(flowPath(subscriptionId));
    });
  };

  // Back from a vendor's sign-in that connected the vendor the connect left
  // for: that vendor is the choice, saved once, and the page goes back.
  const returned = useRef(false);
  useEffect(() => {
    if (returned.current || callbackStatus !== "connected" || !returnedFor)
      return;
    const option = options.find(
      (candidate) => candidate.providerId === returnedFor,
    );
    if (
      !option ||
      connectionState(option.connection ?? undefined) !== "connected"
    )
      return;
    // Saved once the page has settled, and only once.
    const timer = setTimeout(() => {
      if (returned.current) return;
      returned.current = true;
      save(option.providerId);
    }, 0);
    return () => clearTimeout(timer);
    // `save` is this render's; the effect runs once, on the way back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackStatus, returnedFor, options]);

  return (
    <div className="py-5 first:pt-0">
      {callbackStatus === "error" ? (
        <p role="alert" className="mb-4 text-sm text-[var(--error-text)]">
          The connection could not be completed. Try again or contact an owner.
        </p>
      ) : null}
      <VendorRows
        label="Connect integration"
        options={options}
        chosen={saved}
        canManage={canManage}
        workspaceId={workspaceId}
        saving={saving}
        returnTo={returnTo}
        onChoose={save}
      />
      <FormError message={error} className="mt-4" />
    </div>
  );
}
