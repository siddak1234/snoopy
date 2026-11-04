import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/dashboard/BackLink";
import { Group } from "@/components/dashboard/Group";
import SectionCard from "@/components/dashboard/SectionCard";
import { readWorkspaceDocument } from "@/lib/agreements";
import { getAppSession } from "@/lib/app-session";
import { formatDateMediumUTC } from "@/lib/date";
import { acceptedBy, documentName } from "@/lib/health-agreement";
import { administers, listWorkspaces } from "@/lib/tenancy";

/**
 * One signed document of the organization (backend ADR-0049, C3): the copy
 * kept when its owner accepted it — the agreement with the organization's
 * name and the day filled in, and its signature section — read only here,
 * when its row on the organization page is opened. Headed as its row is,
 * "Business Associate Agreement · Version {n}" over "Accepted by {name} on
 * {date}", with the way back to the organization page. Shown to whom that
 * page is shown (its owners and admins); another workspace's document, or a
 * kind this build does not know, is not found.
 */

export const dynamic = "force-dynamic";

export default async function DocumentPage(
  props: PageProps<"/account/organization/documents/[documentId]">,
) {
  const { documentId } = await props.params;
  const session = await getAppSession();
  if (!session?.user.id) redirect("/account");
  const workspace = (await listWorkspaces()).find(
    (candidate) =>
      candidate.id === session.user.workspaceId &&
      candidate.type === "organization" &&
      administers(candidate.role),
  );
  if (!workspace) redirect("/account");

  const copy = await readWorkspaceDocument(workspace.id, documentId);
  const name = copy ? documentName(copy) : null;
  if (!copy || !name) notFound();

  return (
    <SectionCard
      title={name}
      subheader={acceptedBy(
        copy.signerName,
        formatDateMediumUTC(copy.acceptedAt),
      )}
      back={<BackLink href="/account/organization" />}
    >
      <Group>
        <div
          data-testid="document-copy"
          className="text-sm whitespace-pre-wrap text-[var(--text)]"
        >
          {copy.text}
        </div>
      </Group>
    </SectionCard>
  );
}
