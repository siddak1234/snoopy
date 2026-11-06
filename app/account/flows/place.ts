import type { AutomationCatalogEntry, Subscription } from "@/lib/automations";
import type { Project } from "@/lib/tenancy";

/**
 * Where a flow is, in words (spec §3.A, §3.D): "Department: {kind}" (~~"Team:
 * {kind}"~~ until Build 23's B1) — a team is its
 * kind (the owner, build 9), and a flow's team is the one of its category
 * (backend ADR-0036), so a team this person cannot list is still named by the
 * category. A flow added to the whole workspace before teams says so. Said on
 * a flow's page and its Set up — pages, not cards (~~Home's Run a flow~~
 * until Build 22; ~~the Flows card~~ until build 34's F4; ~~an archived
 * flow's row~~ until builds 37 and 39: it is the flow card, `FlowCard`).
 */
export function placeOf(
  projects: readonly Project[],
  catalog: ReadonlyMap<string, AutomationCatalogEntry>,
) {
  const teamKind = new Map(
    projects.map((project) => [project.id, project.type]),
  );
  return (subscription: {
    templateId: Subscription["templateId"];
    projectId?: Subscription["projectId"] | undefined;
  }): string => {
    if (!subscription.projectId) return "Whole workspace";
    const kind =
      teamKind.get(subscription.projectId) ??
      catalog.get(subscription.templateId)?.category;
    return kind ? `Department: ${kind}` : "Department";
  };
}
