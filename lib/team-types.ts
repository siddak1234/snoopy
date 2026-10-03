/**
 * The kinds of team a person picks from when creating one (the owner, build 7:
 * "project types should just be teams or departments" — the list confirmed
 * 2026-10-02; BUILD-PLAN 24.11.11). "Other" opens a field for their own words.
 * A team is its kind (the owner, build 9): the kind is also the team's name, so
 * their own words are 2 to 60 characters, the platform's limit on a name. The
 * mobile app offers the same list (`snoopy-mobile/lib/content/team-types.ts`).
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
] as const;

export const OTHER_TEAM_TYPE = "Other";
