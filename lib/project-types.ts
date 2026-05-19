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
