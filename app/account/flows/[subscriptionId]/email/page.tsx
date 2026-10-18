import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  readFlowEmailRecipients,
} from "@/lib/automations";
import { EMAIL_TITLE } from "@/lib/flow-email";
import { flowPath } from "@/lib/flow-steps";
import { PlatformServerError } from "@/lib/platform-server";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { EmailRecipientsForm } from "./EmailRecipientsForm";

/**
 * Who gets the email — one flow's run emails (Build 22, P5; spec §4; the
 * owner's build 21 item 5: "When i select this step it should take me to the
 * page where i can edit in a screen the email it should send to"). Opened from
 * the flow page's step 5. Top to bottom:
 *
 * 1. Back · "Who gets the email" · "For {flow}";
 * 2. **Always** — the workspace's owners and admins, each its address and its
 *    role, then "The person who starts the run": who always gets it (the
 *    session's D1, approved by the owner 21:12Z — "It should go to the
 *    owner/admin and the person that uploaded the document");
 * 3. **Also send to** — the flow's extra addresses, or None; for an owner or
 *    admin each with its remove button, then the address field and Add —
 *    "You can add up to 10." once there are ten — and for a member "Ask an
 *    owner or admin to change this." (the session's S12).
 *
 * Read here, on the server, each time the page is drawn; written through a
 * server action beside the vendor page's (`saveEmailRecipients`), which
 * revalidates the flow's pages. A flow this person cannot see, or an archived
 * one, is the same "not found" any other id is; a read the platform refuses
 * otherwise goes to the account area's error page, with its Try again — the
 * website's existing error state (spec §4).
 */

export const dynamic = "force-dynamic";

export default async function FlowEmailPage(
  props: PageProps<"/account/flows/[subscriptionId]/email">,
) {
  const { subscriptionId } = await props.params;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const [subscriptions, catalog] = await Promise.all([
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
  ]);
  const subscription = subscriptions.subscriptions.find(
    (candidate) =>
      candidate.id === subscriptionId && candidate.status !== "archived",
  );
  if (!subscription) notFound();
  const name =
    subscription.name ??
    catalog.automations.find(
      (candidate) => candidate.templateId === subscription.templateId,
    )?.name ??
    subscription.templateId;

  let recipients;
  try {
    recipients = await readFlowEmailRecipients(workspaceId, subscription.id);
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404)
      notFound();
    throw error;
  }

  return (
    <SectionCard
      title={EMAIL_TITLE}
      subheader={`For ${name}`}
      back={<BackLink href={flowPath(subscription.id)} />}
    >
      <EmailRecipientsForm
        workspaceId={workspaceId}
        subscriptionId={subscription.id}
        initial={recipients}
      />
    </SectionCard>
  );
}
