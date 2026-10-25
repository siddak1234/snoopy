/**
 * The Flows list by department (plan §3; the owner's build 28 item 1: "It
 * should be easy to know which department a flow is for … A-Z by department
 * type. So this one is in HR section"): one group per catalog `category` —
 * the team kind a flow goes to (backend ADR-0036) — the departments A–Z, and
 * in each the flows in the catalog's own order. ~~One grid in the catalog's
 * order, each card saying its category~~ until build 28.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */
/**
 * A department's group: its name, its flows, and the id its header carries —
 * from its place, "department-1", never from its name, which may hold a
 * space ("Customer Support") and break `aria-labelledby`.
 */
export type Department<T> = { department: string; id: string; entries: T[] };

export function byDepartment<T extends { category: string }>(
  entries: readonly T[],
): Department<T>[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries)
    groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry]);
  return [...groups.keys()]
    .sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }))
    .map((department, at) => ({
      department,
      id: `department-${at + 1}`,
      entries: groups.get(department) ?? [],
    }));
}
