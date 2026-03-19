export type BlockType =
  | "Trigger"
  | "AI Agent"
  | "Data Source"
  | "Condition"
  | "Action";

export interface WorkflowNodeData {
  label: string;
  blockType: BlockType;
  [key: string]: unknown;
}

export const BLOCK_DEFS: { type: BlockType; label: string }[] = [
  { type: "Trigger", label: "Trigger" },
  { type: "AI Agent", label: "AI Agent" },
  { type: "Data Source", label: "Data Source" },
  { type: "Condition", label: "Condition" },
  { type: "Action", label: "Action" },
];
