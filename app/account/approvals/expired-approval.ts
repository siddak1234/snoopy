import { listConnectionProviders } from "@/lib/connections";
import { disconnectedName } from "@/lib/connection-rows";
import { PlatformServerError } from "@/lib/platform-server";
import { approveExpiredBy, expiredByDisconnect } from "@/lib/run-progress";

/**
 * An Approve the platform refused because a disconnect expired its approval
 * (backend §12.1 #252, S1-8b: 409 `approval_expired` with `expiredBy`), as
 * `decideApproval` answers it: Stage 1's two lines where Approve was —
 * "Expired · {provider} was disconnected", then "Reconnect {provider}, then
 * start the run again." — the provider named as its connection row names
 * it (`disconnectedName`), from one read of the providers made on this
 * refusal only; unread, its id. `null` for any other refusal, a plain
 * expiry included, which keeps the platform's words.
 */
export async function expiredApproval(
  error: unknown,
): Promise<{ ok: false; error: string; state: "approval-expired" } | null> {
  if (!(error instanceof PlatformServerError)) return null;
  const providerId = approveExpiredBy(error.status, error.details);
  if (!providerId) return null;
  const listed = await listConnectionProviders().then(
    ({ providers }) =>
      providers.find((provider) => provider.providerId === providerId)
        ?.displayName,
    () => undefined,
  );
  const lines = expiredByDisconnect(
    {
      status: "expired",
      expiredBy: { reason: "connection-disconnected", providerId },
    },
    (id) => disconnectedName(id, listed ?? id),
  );
  return lines
    ? {
        ok: false,
        error: `${lines.title}\n${lines.next}`,
        state: "approval-expired",
      }
    : null;
}
