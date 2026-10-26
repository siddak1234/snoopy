import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listAutomations,
  listSubscriptions,
  readItem,
} from "@/lib/automations";
import { PlatformServerError, newIdempotencyKey } from "@/lib/platform-server";
import {
  administers,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import { ItemLive } from "./ItemLive";

/**
 * One of a flow's items (Round 19, plan §5.3; backend ADR-0046): its title,
 * its group's value and where it is; its body as the platform sends it
 * (backend ADR-0048: its tiles, its file's row, the form for one of its runs
 * — for an owner or admin — and its runs, ranked); and, for an owner or
 * admin, Archive. Every word in the body is the platform's.
 * ~~"What AI read"~~ until build 28 (the owner's item 4): the reading is on
 * the item's file page, `file/page.tsx`.
 *
 * Read with the page, and then kept live by `ItemLive`. An item of another
 * workspace, or of another flow than the path's, is the same "not found" one
 * that does not exist is; so is an item of a flow that declares none.
 */

export const dynamic = "force-dynamic";

export default async function ItemPage(
  props: PageProps<"/account/flows/[subscriptionId]/items/[itemId]">,
) {
  const { subscriptionId, itemId } = await props.params;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  let answer;
  try {
    answer = await readItem(workspaceId, itemId);
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404)
      notFound();
    throw error;
  }
  if (answer.item.subscriptionId !== subscriptionId) notFound();

  const [subscriptions, catalog, role] = await Promise.all([
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    emptyWhenUnavailable(() => listAutomations(workspaceId), {
      automations: [],
      categories: [],
    }),
    roleInWorkspace(workspaceId),
  ]);
  const subscription = subscriptions.subscriptions.find(
    (candidate) =>
      candidate.id === subscriptionId && candidate.status !== "archived",
  );
  const declared = subscription?.items;
  if (!subscription || !declared) notFound();
  const entry = catalog.automations.find(
    (candidate) => candidate.templateId === subscription.templateId,
  );

  return (
    <ItemLive
      workspaceId={workspaceId}
      subscriptionId={subscription.id}
      declared={declared}
      initial={answer}
      runInput={subscription.runInput ?? []}
      live={subscription.status === "live"}
      available={entry?.available === true}
      canGoLive={subscription.unmetConnections.length === 0}
      canManage={administers(role)}
      initialKey={newIdempotencyKey("run")}
    />
  );
}
