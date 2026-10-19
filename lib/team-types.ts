import type { components } from "@/lib/generated/platform-contracts/automations";

/**
 * The team kinds (the owner, build 7: "project types should just be teams or
 * departments" — the list confirmed 2026-10-02; BUILD-PLAN 24.11.11), which a
 * person reads as departments (Build 23's B1; the code keeps `team`). They are
 * also the catalog's categories (backend ADR-0036): a flow goes to the team of
 * its category, which the platform makes when it is first needed — no one picks
 * a team or creates one (the owner, 2026-10-14). A team is its kind (the owner,
 * build 9). The mobile app holds the same list
 * (`snoopy-mobile/lib/content/team-types.ts`), and both are held to the
 * platform's published `AutomationCatalogEntry.category` below, both ways, so a
 * kind added or renamed there fails the typecheck here.
 */
export const TEAM_TYPES = [
  "HR",
  "Accounting",
  "Finance",
  "Legal",
  "Compliance",
  "Data",
  "Operations",
  "Sales",
  "Marketing",
  "Customer Support",
  "IT",
  "Engineering",
  "Product",
  "Procurement",
  "Administration",
  "Research",
] as const satisfies readonly TeamKind[];

/** A team kind, as the platform publishes the catalog's categories. */
export type TeamKind =
  components["schemas"]["AutomationCatalogEntry"]["category"];

// Every published kind is listed here too: a kind the platform adds and this
// list lacks is a type error on this line.
const everyKindListed: readonly (typeof TEAM_TYPES)[number][] =
  [] as TeamKind[];
void everyKindListed;
