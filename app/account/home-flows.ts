import type {
  AutomationCatalogEntry,
  AutomationItems,
  AutomationRunInputField,
  Item,
  Subscription,
} from "@/lib/automations";
import type { Choice } from "@/lib/choices";
import { groupItems } from "@/lib/flow-items";
import { byDepartment, type Department } from "./flows/departments";

/**
 * Home's YOUR FLOWS (the owner's build 34 F5: "Rather than recent runs from
 * now on we will list the flows the account has … The goal of this section
 * is quick and easy access to start a run"): the workspace's live flows, in
 * sections by department A–Z (`byDepartment`, the catalog's `category`, as
 * Flows groups them), A–Z in each. Each carries what its run form needs,
 * read from the one subscriptions list Home reads — its pinned `runInput`
 * and, for a flow with items, its `items` declaration — so no row reads
 * anything of its own until it is opened. ~~Recent runs and See all~~ until
 * then.
 */

/** The section's title; the dashboard draws it in small capitals, "YOUR FLOWS". */
export const YOUR_FLOWS = "Your flows";

/** One flow as Home draws it. */
export type HomeFlow = {
  id: string;
  name: string;
  category: string;
  runInput: AutomationRunInputField[];
  /** A flow with items starts a run on one of them (backend ADR-0046). */
  items: AutomationItems | null;
  /**
   * Its run can start here: the flow answers and declares run input, and a
   * flow with items only for an owner or admin, as an item's page offers it
   * (`canAddRun`). Otherwise the row opens the flow's page.
   */
  startable: boolean;
  /** The first run's key, made with the page (`RunStart`). */
  initialKey: string;
};

const byName = (a: HomeFlow, b: HomeFlow) =>
  a.name.localeCompare(b.name, "en-US", { sensitivity: "base" });

/**
 * The live flows, each with its catalog entry's department and name; a flow
 * whose entry the catalog no longer lists is not drawn, as Flows draws no
 * card for one.
 */
export function homeFlows(
  subscriptions: readonly Subscription[],
  catalog: readonly AutomationCatalogEntry[],
  canManage: boolean,
  newKey: () => string,
): Department<HomeFlow>[] {
  const entries = new Map(catalog.map((entry) => [entry.templateId, entry]));
  const flows = subscriptions.flatMap((subscription): HomeFlow[] => {
    const entry = entries.get(subscription.templateId);
    if (subscription.status !== "live" || !entry) return [];
    const runInput = subscription.runInput ?? [];
    const items = subscription.items ?? null;
    return [
      {
        id: subscription.id,
        name: subscription.name ?? entry.name,
        category: entry.category,
        runInput,
        items,
        startable:
          entry.available &&
          runInput.length > 0 &&
          (items === null || canManage),
        initialKey: newKey(),
      },
    ];
  });
  return byDepartment(flows.sort(byName));
}

/**
 * A flow's items a run can start on, as the job drop-down's choices: the
 * ready ones, not archived, under their group's value A–Z, A–Z in each
 * (`groupItems`, as the flow's page lists them) — "select the department
 * and job that is already existing".
 */
export function jobChoices(
  items: readonly Item[],
  groupField: string | undefined,
): Choice[] {
  const ready = items.filter(
    (item) => item.status === "ready" && !item.archivedAt,
  );
  return groupItems(
    ready,
    groupField ? { key: groupField } : undefined,
  ).flatMap(({ title, items: inGroup }) =>
    inGroup.map((item) =>
      title === null
        ? { value: item.id, label: item.title }
        : { value: item.id, label: item.title, group: title },
    ),
  );
}
