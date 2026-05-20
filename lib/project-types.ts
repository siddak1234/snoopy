export const PROJECT_TYPES = [
  "Invoice Processing",
  "Document Review",
  "Data Entry Automation",
  "GL Code Classification",
  "Custom Workflow",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value);
}

export const PROJECT_SCOPES = ["personal", "team"] as const;

export type ProjectScope = (typeof PROJECT_SCOPES)[number];

export function isProjectScope(value: string): value is ProjectScope {
  return (PROJECT_SCOPES as readonly string[]).includes(value);
}
