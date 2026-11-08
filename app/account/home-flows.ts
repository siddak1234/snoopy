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
 * Flows groups them), A–Z in each. Each carries what its card and its run
 * form need, read from the one subscriptions list and the catalog Home reads
 * — its icon (Home's compact card draws no description since the owner's
 * build 41, item 14), its pinned `runInput` and, for a flow with
 * items, its `items` declaration. The owner's builds 37 and 39, item 8:
 * "Your flows — on the right hand side department select drop down / Search
 * bar / Department name in sorted order / Quick access cards" — a drop-down
 * of its departments (`departmentChoices`) and a search by name
 * (`shownFlows`) choose which are drawn; each flow is a card of its own,
 * always open, and a flow with items starts on its newest ready job
 * (`newestReady`). ~~Recent runs and See all~~ until build 34; ~~a row per
 * flow that opened in place, its items read when it was opened, its job
 * chosen from "Choose"~~ until builds 37 and 39.
 */

/** The section's title; the dashboard draws it in small capitals, "YOUR FLOWS". */
export const YOUR_FLOWS = "Your flows";

/** One flow as Home draws it. */
export type HomeFlow = {
  id: string;
  name: string;
  category: string;
  /** The catalog's icon name: its card's (`FlowCard`). */
  icon: string;
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
        icon: entry.icon,
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

/** The department drop-down's first choice: every department's flows. */
export const ALL_DEPARTMENTS = "All departments";
/** Its value: no department's name, which is never empty. */
export const ALL = "";
/** The drop-down's name for a screen reader. */
export const DEPARTMENT = "Department";

/**
 * The department drop-down's choices (the owner's item 8): "All
 * departments", then each department Home draws, A–Z as its sections are.
 */
export function departmentChoices(
  departments: readonly Department<HomeFlow>[],
): Choice[] {
  return [
    { value: ALL, label: ALL_DEPARTMENTS },
    ...departments.map(({ department }) => ({
      value: department,
      label: department,
    })),
  ];
}

/**
 * The sections drawn: the department chosen (`ALL`, every one), and in it
 * the flows whose name holds what is typed, whatever its case; a section
 * left with none is not drawn.
 */
export function shownFlows(
  departments: readonly Department<HomeFlow>[],
  department: string,
  query: string,
): Department<HomeFlow>[] {
  const typed = query.trim().toLocaleLowerCase("en-US");
  return departments.flatMap((section) => {
    if (department !== ALL && section.department !== department) return [];
    const entries = typed
      ? section.entries.filter((flow) =>
          flow.name.toLocaleLowerCase("en-US").includes(typed),
        )
      : section.entries;
    return entries.length > 0 ? [{ ...section, entries }] : [];
  });
}

/**
 * The job a flow's card starts on (the owner's item 5: "pre selected with
 * the most recent job the user has uploaded"): the platform lists items
 * newest first (`listItems`, by `createdAt`), so the first ready one not
 * archived; none, "" (no choice).
 */
export function newestReady(items: readonly Item[]): string {
  return (
    items.find((item) => item.status === "ready" && !item.archivedAt)?.id ?? ""
  );
}
