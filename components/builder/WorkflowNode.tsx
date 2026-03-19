import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNodeData } from "./types";
import { BlockIconTile } from "./block-icons";

export function WorkflowNode({
  data,
  selected,
}: NodeProps & { data: WorkflowNodeData }) {
  return (
    <div className={`workflow-node${selected ? " selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2.5">
        <BlockIconTile type={data.blockType} size="sm" />
        <span className="text-xs font-semibold text-[var(--text)]">
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
