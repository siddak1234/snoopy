import SectionCard from "@/components/dashboard/SectionCard";
import { getAppSession } from "@/lib/app-session";
import { formatWhen } from "@/lib/automations";
import {
  billingWhenUnavailable,
  listPlans,
  readWorkspaceBilling,
} from "@/lib/billing";
import { PlatformServerError } from "@/lib/platform-server";
import { listWorkspaces, resolveActiveWorkspaceId } from "@/lib/tenancy";
import { BillingPanel } from "./BillingPanel";

/**
 * Billing — the workspace's plan and the way to change it (BUILD-PLAN 8.3).
 *
 * Everything on this page is one of ADR-0025's four operations. The plan list
 * is what a purchase decision is made from; the workspace's own billing state,
 * checkout and the portal are owner-or-admin operations, and the server refuses
 * every other role — the gate here only avoids offering what would be refused.
 */

export const dynamic = "force-dynamic";

const REFUSED = "refused" as const;

export default async function AccountBillingPage() {
  const session = await getAppSession();
  const workspaces = session ? await listWorkspaces() : [];
  const workspaceId = await resolveActiveWorkspaceId(session);
  const role = workspaces.find((w) => w.id === workspaceId)?.role;

  if (!workspaceId) {
    return (
      <SectionCard title="Billing">
        <Empty text="No workspace is active yet." />
      </SectionCard>
    );
  }

  // A plan, its dunning status and its renewal date are not a member's to see
  // (ADR-0025), so the read is not attempted for one: the gate is the page's,
  // the refusal would be the server's.
  if (role !== "owner" && role !== "admin") {
    return (
      <SectionCard title="Billing">
        <Empty text="Billing is managed by the owners and admins of this workspace." />
      </SectionCard>
    );
  }

  const [plans, billing] = await Promise.all([
    billingWhenUnavailable(listPlans),
    billingWhenUnavailable(() => readWorkspaceBilling(workspaceId)).catch(
      (error: unknown) => {
        // Authoritative refusals, not breakage — and only from the workspace's
        // billing read, the one operation that documents them: the list said
        // owner or admin a moment ago, but the server, which decides, refuses
        // (403: the role changed) or no longer knows the workspace for this
        // person (404). Anything else, from either read, is a broken platform
        // and is rethrown rather than dressed up as a state.
        if (
          error instanceof PlatformServerError &&
          (error.status === 403 || error.status === 404)
        ) {
          return REFUSED;
        }
        throw error;
      },
    ),
  ]);

  if (billing === REFUSED) {
    return (
      <SectionCard title="Billing">
        <Empty text="You no longer have access to this workspace's billing." />
      </SectionCard>
    );
  }

  // Unavailable is an honest state — no backend, or no billing provider
  // configured yet — never a false plan.
  if (!plans || !billing) {
    return (
      <SectionCard title="Billing">
        <Empty text="Billing is unavailable right now." />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Billing">
      <div className="py-5 first:pt-0">
        <BillingPanel
          workspaceId={workspaceId}
          billing={billing}
          plans={plans.plans}
          periodEnd={
            billing.currentPeriodEnd
              ? formatWhen(billing.currentPeriodEnd)
              : null
          }
        />
      </div>
    </SectionCard>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-5 first:pt-0">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}
