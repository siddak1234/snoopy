import { notFound } from "next/navigation";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { FileView } from "@/components/dashboard/FileView";
import { SectionRows } from "@/components/dashboard/SectionRows";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listSubscriptions,
  readItem,
  readItemFile,
  type RunFileLink,
} from "@/lib/automations";
import { EMAIL_UNAVAILABLE } from "@/lib/flow-email";
import { itemPath } from "@/lib/flow-items";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
} from "@/lib/platform-server";
import { FILE_GONE, fileViewHref, itemFilePath } from "@/lib/run-files";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";

/**
 * The file an item was made from (Round 19, build 28; the owner's item 4:
 * "Click it and takes you to a page. Shows the original document
 * downloadable. Below it you scroll and get the data in drop downs"): headed
 * by the flow's word for it ("Job description", `items.file.title`), under
 * the item's title; the file itself, Download and Share (`FileView`); then
 * what was read from it, each section a row that opens, all closed
 * (`SectionRows`). A file the platform no longer keeps says so, and the
 * sections stay. An item of another workspace, or of another flow than the
 * path's, is the same "not found" as on the item's page.
 */

export const dynamic = "force-dynamic";

/** The item's file and its link, or what to say instead. */
async function readFile(
  workspaceId: string,
  itemId: string,
): Promise<RunFileLink | string> {
  try {
    return await readItemFile(workspaceId, itemId);
  } catch (error) {
    if (error instanceof PlatformServerError && error.status === 404)
      return FILE_GONE;
    if (
      error instanceof PlatformServerError ||
      error instanceof PlatformNotConfiguredError
    )
      return EMAIL_UNAVAILABLE;
    throw error;
  }
}

export default async function ItemFilePage(
  props: PageProps<"/account/flows/[subscriptionId]/items/[itemId]/file">,
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
  const { item } = answer;
  if (item.subscriptionId !== subscriptionId) notFound();
  const [subscriptions, file] = await Promise.all([
    emptyWhenUnavailable(() => listSubscriptions(workspaceId), {
      subscriptions: [],
    }),
    readFile(workspaceId, item.id),
  ]);
  const declared = subscriptions.subscriptions.find(
    (candidate) =>
      candidate.id === subscriptionId && candidate.status !== "archived",
  )?.items;
  if (!declared) notFound();

  return (
    <SectionCard
      title={declared.file.title}
      subheader={item.title}
      back={<BackLink href={itemPath(subscriptionId, item.id)} />}
    >
      <div className="py-5 first:pt-0">
        {typeof file === "string" ? (
          <EmptyRow text={file} />
        ) : (
          <FileView
            file={file.file}
            viewHref={fileViewHref(itemFilePath(subscriptionId, item.id))}
            linkPath={`/v1/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(item.id)}/file`}
          />
        )}
      </div>
      {item.sections && item.sections.length > 0 ? (
        <section aria-label={declared.file.title} className="py-5">
          <SectionRows sections={item.sections} testId="item-section" />
        </section>
      ) : null}
    </SectionCard>
  );
}
