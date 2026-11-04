import { PageRow } from "@/components/dashboard/PageRow";
import { LIST_CARD } from "@/components/dashboard/SectionRows";
import { formatDateMediumUTC } from "@/lib/date";
import { NO_DOCUMENTS, acceptedBy, documentName } from "@/lib/health-agreement";
import { SPACING } from "@/lib/spacing";

/** A signed document as the list reads it (`WorkspaceDocument`, `lib/agreements.ts`). */
export type OrgDocument = {
  id: string;
  kind: string;
  version: number;
  signerName: string;
  acceptedAt: string;
};

/** Where one document's signed copy is read. */
export function documentPath(id: string): string {
  return `/account/organization/documents/${encodeURIComponent(id)}`;
}

/**
 * The organization's Documents (backend ADR-0049, C3; the owner's item 3:
 * "it stays in the user or orgs docs"): a row per signed document, newest
 * first as the platform lists them — "Business Associate Agreement · Version
 * {n}", "Accepted by {name} on {date}" under it — each opening its signed
 * copy's page; "No documents yet." when there is none. A kind this build does
 * not know is left out. Read once with the page; the copy only when a row is
 * opened.
 */
export function OrgDocumentList({ documents }: { documents: OrgDocument[] }) {
  const named = documents.flatMap((document) => {
    const name = documentName(document);
    return name ? [{ document, name }] : [];
  });
  if (named.length === 0)
    return (
      <p className={`${SPACING.title.top} text-sm text-[var(--muted)]`}>
        {NO_DOCUMENTS}
      </p>
    );
  return (
    <ul
      data-testid="org-documents"
      className={`${SPACING.title.top} ${LIST_CARD}`}
    >
      {named.map(({ document, name }) => (
        <li key={document.id}>
          <PageRow href={documentPath(document.id)} boxed={false}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-[var(--text)]">{name}</span>
              <span className="text-xs text-[var(--muted)]">
                {acceptedBy(
                  document.signerName,
                  formatDateMediumUTC(document.acceptedAt),
                )}
              </span>
            </span>
          </PageRow>
        </li>
      ))}
    </ul>
  );
}
